// api/redirect.js — Vercel serverless (Adstera-friendly, fast 302)
// - Full HMAC(ts+nonce) over canonicalized params
// - Smart getClientIP (cf-connecting-ip preferred)
// - DC prefixes configurable via env (DC_PREFIXES)
// - Optional async fire-and-forget logging (LOG_WEBHOOK + ASYNC_LOG = "1")
// - No await before redirect -> happy-path latency preserved

import crypto from 'crypto';

const ALLOWED_PARAMS = new Set([
  'cost',
  'click_id',
  'zoneid',
  'geo',
  'cid',
  'utm_source',
  'utm_medium'
]);

const BOT_SIGNS = [
  'bot','spider','crawler','curl','wget','phantomjs','headless',
  'selenium','puppeteer','playwright','python-requests','python-urllib',
  'axios','node-fetch','libwww-perl','java/','scrapy'
];

const BEMOB = process.env.BEMOB_URL;
const SECRET = process.env.SECRET_SIGN || '';
const DC_PREFIXES = (process.env.DC_PREFIXES ||
  '13.,18.,23.,34.,35.,52.,54.,104.,107.,144.217.,192.0.2.'
).split(',').map(s => s.trim()).filter(Boolean);

const LOG_WEBHOOK = process.env.LOG_WEBHOOK || ''; // optional
const ASYNC_LOG = String(process.env.ASYNC_LOG || '0') === '1'; // '1' to enable

// quick config warnings (no blocking)
if (BEMOB && !BEMOB.startsWith('https://')) {
  console.warn('Warning: BEMOB_URL should use https://');
}
if (SECRET.length < 16) {
  console.warn('Warning: SECRET_SIGN is short (<16). Consider using 32+ bytes.');
}

// helper: prefer cf-connecting-ip then x-forwarded-for then socket
function getClientIP(req) {
  const header = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  return String(header).split(',')[0].trim();
}

// fast datacenter prefix check (string startsWith)
function isDatacenterIP(ip = '') {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  return DC_PREFIXES.some(p => ip.startsWith(p));
}

// detect clear bot UA (only obvious bot substrings or empty UA)
function isClearBotUA(ua = '') {
  if (!ua) return true; // treat empty UA as suspicious
  const low = ua.toLowerCase();
  return BOT_SIGNS.some(s => low.includes(s));
}

function canonicalQsFromParams(params) {
  const entries = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([k, v]) => `${k}=${v}`).join('&');
}

function signParamsWithTsAndNonce(params) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(6).toString('hex');
  params.set('ts', ts);
  params.set('nonce', nonce);
  const canonical = canonicalQsFromParams(params);
  const h = crypto.createHmac('sha256', SECRET);
  h.update(canonical);
  const sign = h.digest('hex'); // full hex
  return { sign, ts, nonce, canonical };
}

function buildFinalUrl(base, params) {
  const qs = params.toString();
  return base + (qs ? (base.includes('?') ? '&' : '?') + qs : '');
}

// fire-and-forget async log (non-blocking)
function asyncLog(payload) {
  if (!ASYNC_LOG || !LOG_WEBHOOK) return;
  try {
    fetch(LOG_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => { /* swallow errors */ });
  } catch (e) {
    // ignore - must not throw before redirect
  }
}

export default async function handler(req, res) {
  try {
    if (!BEMOB || !SECRET) {
      console.error('Missing BEMOB_URL or SECRET_SIGN in environment');
      return res.status(500).send('Server misconfiguration');
    }

    const ua = (req.headers['user-agent'] || '').toString();
    const ip = getClientIP(req);
    const referer = req.headers['referer'] || '';

    // conservative block: only when UA is clear bot AND ip is datacenter
    const clearBot = isClearBotUA(ua);
    const dc = isDatacenterIP(ip);
    if (clearBot && dc) {
      asyncLog({ event: 'blocked', reason: 'bot_and_dc', ip, ua, referer, time: new Date().toISOString() });
      return res.status(403).send('Forbidden');
    }

    // collect allowed params quickly
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (ALLOWED_PARAMS.has(k) && v != null && v !== '') params.set(k, String(v));
    }

    // optionally forward referer for mapping
    if (referer) params.set('ref', referer);

    // sign with ts + nonce (mutates params)
    const { sign, ts, nonce, canonical } = signParamsWithTsAndNonce(params);
    params.set('sign', sign);

    // build final URL and redirect
    const finalUrl = buildFinalUrl(BEMOB, params);

    // async minimal audit log (non-blocking)
    asyncLog({
      event: 'redirect',
      time: new Date().toISOString(),
      ip,
      ua,
      referer,
      click_id: params.get('click_id') || null,
      zoneid: params.get('zoneid') || null,
      ts,
      nonce,
      canonical
    });

    // immediate 302 redirect (happy path)
    return res.redirect(302, finalUrl);

  } catch (e) {
    console.error('Error in redirect handler:', e);
    return res.status(500).send('Internal Server Error');
  }
}
