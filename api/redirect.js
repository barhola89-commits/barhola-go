// api/redirect.js — Vercel serverless (Monetag-optimized, ultra-permissive + HMAC)
// Goals:
// - Maximize Monetag counted clicks (permissive checks)
// - Keep fast 302 happy-path
// - Provide HMAC(ts+nonce) proof for forensics (sent to Bemob)
// - No external logging, minimal CPU work

import crypto from 'crypto';

const ALLOWED_PARAMS = new Set([
  'cost','click_id','zoneid','geo','cid','utm_source','utm_medium',
  'subid','aff_sub','pubid','source' // added common tracking params
]);

const BOT_SIGNS = [
  'bot','spider','crawler','curl','wget','phantomjs','headless',
  'selenium','puppeteer','playwright','python-requests','python-urllib',
  'axios','node-fetch','libwww-perl','java/','scrapy'
];

// Conservative DC prefixes by default (override via DC_PREFIXES env if needed)
const DC_PREFIXES = (process.env.DC_PREFIXES || '104.,107.').split(',').map(s => s.trim()).filter(Boolean);

const BEMOB = process.env.BEMOB_URL;           // e.g. https://track.bemob.example/redirect
const SECRET = process.env.SECRET_SIGN || ''; // MUST be strong (use openssl rand -hex 32)

// ---------------- helpers ----------------
function getClientIP(req) {
  const header = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  return String(header).split(',')[0].trim();
}

function isDatacenterIP(ip = '') {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  return DC_PREFIXES.some(p => ip.startsWith(p));
}

// Permissive bot detection: only when UA explicitly contains known bot substrings.
// NOTE: empty UA is NOT treated as bot (Monetag-friendly)
function isClearBotUA(ua = '') {
  if (!ua) return false;
  const low = ua.toLowerCase();
  return BOT_SIGNS.some(s => low.includes(s));
}

function canonicalQsFromParams(params) {
  const entries = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([k, v]) => `${k}=${v}`).join('&');
}

// sign with ts + short nonce (fast)
function signParamsWithTsAndNonce(params) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(4).toString('hex'); // 8 hex chars — fast
  params.set('ts', ts);
  params.set('nonce', nonce);
  const canonical = canonicalQsFromParams(params);
  const h = crypto.createHmac('sha256', SECRET);
  h.update(canonical);
  const sign = h.digest('hex');
  return { sign, ts, nonce };
}

function buildFinalUrl(base, params) {
  const qs = params.toString();
  return base + (qs ? (base.includes('?') ? '&' : '?') + qs : '');
}

// ---------------- handler ----------------
export default function handler(req, res) {
  try {
    if (!BEMOB || !SECRET) {
      console.error('Missing BEMOB_URL or SECRET_SIGN in environment');
      return res.status(500).send('Server misconfiguration');
    }

    const ua = (req.headers['user-agent'] || '').toString();
    const ip = getClientIP(req);
    const referer = req.headers['referer'] || '';

    // block only when UA clearly a bot AND IP matches datacenter prefix
    const clearBot = isClearBotUA(ua);
    const dc = isDatacenterIP(ip);
    if (clearBot && dc) {
      return res.status(403).send('Forbidden');
    }

    // collect allowed params fast
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (ALLOWED_PARAMS.has(k) && v != null && v !== '') params.set(k, String(v));
    }

    // forward referer for mapping (optional, helpful for verification)
    if (referer) params.set('ref', referer);

    // sign (adds ts + nonce)
    const { sign } = signParamsWithTsAndNonce(params);
    params.set('sign', sign);

    // immediate 302 to Bemob
    const finalUrl = buildFinalUrl(BEMOB, params);
    return res.redirect(302, finalUrl);

  } catch (err) {
    console.error('Redirect error:', err);
    return res.status(500).send('Internal Server Error');
  }
}
