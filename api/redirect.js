// api/redirect.js — Vercel serverless
// Fast 302 redirect + HMAC(ts+nonce) + stronger UA + expanded DC ranges

import crypto from 'crypto';

const ALLOWED_PARAMS = new Set(['cost','click_id','zoneid','geo','cid','utm_source','utm_medium']);

// common bot substrings (lowercase)
const BOT_SIGNS = [
  'bot','spider','crawler','curl','wget','phantomjs','headless',
  'selenium','puppeteer','playwright','python-requests','python-urllib',
  'axios','node-fetch','libwww-perl','java/', 'scrapy'
];

// expanded (basic) DC / cloud provider prefixes (not exhaustive). Use an IP-intel service for production.
const DC_RANGES = [
  /^13\./, /^18\./, /^23\./, /^34\./, /^35\./, /^34\./, /^52\./, /^54\./,
  /^104\./, /^107\./, /^144\.217\./, /^192\.0\.2\./
];

const BEMOB = process.env.BEMOB_URL; // must set in Vercel env
const SECRET = process.env.SECRET_SIGN; // must set in Vercel env

// helper: detect datacenter IP by prefix (fast, no network calls)
function isDatacenterIP(ip = '') {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  return DC_RANGES.some(rx => rx.test(ip));
}

// helper: stronger UA check
function isLikelyBotUA(ua = '') {
  if (!ua) return true; // empty UA is suspicious
  const low = ua.toLowerCase();

  // direct known bot substrings
  if (BOT_SIGNS.some(sig => low.includes(sig))) return true;

  // simple heuristics for fake/minimal UAs:
  // - too short (many real UAs are > 20 chars)
  if (ua.length < 20) return true;

  // - typical real UA contains a product/version like 'Mozilla/5.0' or 'Chrome/'
  if (!(/[a-z]+\/\d+/i.test(ua))) return true;

  // - contains at least one space (product + details)
  if (!ua.includes(' ')) return true;

  return false;
}

// canonicalize URLSearchParams into sorted key=value&... string
function canonicalQsFromParams(params) {
  const entries = Array.from(params.entries()).sort((a,b) => a[0].localeCompare(b[0]));
  return entries.map(([k,v]) => `${k}=${v}`).join('&');
}

// sign params by adding ts + nonce then HMAC over canonicalized string
function signParamsWithTsAndNonce(params) {
  const ts = Math.floor(Date.now()/1000).toString();
  const nonce = crypto.randomBytes(6).toString('hex');
  params.set('ts', ts);
  params.set('nonce', nonce);
  const canonical = canonicalQsFromParams(params);
  const h = crypto.createHmac('sha256', SECRET);
  h.update(canonical);
  const sign = h.digest('hex').slice(0, 20);
  return { sign, ts, nonce, canonical };
}

function buildFinalUrl(base, params) {
  const qs = params.toString();
  return base + (qs ? (base.includes('?') ? '&' : '?') + qs : '');
}

export default async function handler(req, res) {
  try {
    // ensure secrets present
    if (!BEMOB || !SECRET) {
      console.error('Missing BEMOB_URL or SECRET_SIGN in environment');
      return res.status(500).send('Server misconfiguration');
    }

    const ua = (req.headers['user-agent'] || '').toString();
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const referer = req.headers['referer'] || '';

    // quick bot / datacenter checks
    if (isLikelyBotUA(ua) || isDatacenterIP(ip)) {
      console.log(JSON.stringify({ event: 'blocked', reason: 'bot_or_dc', ip, ua, referer, time: new Date().toISOString() }));
      return res.status(403).send('Forbidden');
    }

    // collect allowed params
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (ALLOWED_PARAMS.has(k) && v != null && v !== '') params.set(k, String(v));
    }

    // optionally forward referer (useful for verification mapping)
    if (referer) params.set('ref', referer);

    // sign with ts + nonce (this mutates params)
    const { sign, ts, nonce } = signParamsWithTsAndNonce(params);
    params.set('sign', sign);

    // build final URL and redirect (302) - performance preserved
    const finalUrl = buildFinalUrl(BEMOB, params);

    // minimal structured log (no secrets)
    console.log(JSON.stringify({ event: 'redirect', time: new Date().toISOString(), ip, ua, referer, click_id: params.get('click_id') || null, zoneid: params.get('zoneid') || null, ts, nonce }));

    return res.redirect(302, finalUrl);

  } catch (e) {
    console.error('Error in redirect handler:', e);
    return res.status(500).send('Internal Server Error');
  }
}
