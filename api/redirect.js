// api/redirect.js — Vercel serverless (Adsterra-friendly, fast 302)
// Improvements vs original:
// - fixed template literal bug
// - avoid logging canonical/sign to external webhook
// - minimal, anonymized async logging (click hash only)
// - safer datacenter CIDR/prefix checks (basic IPv4 CIDR support)
// - no await before redirect, synchronous HMAC (keeps latency)
// - defensive header handling

import crypto from 'crypto';

// Allowed incoming params to forward to BeMob
const ALLOWED_PARAMS = new Set(['cost','click_id','zoneid','geo','cid','utm_source','utm_medium']);

const BOT_SIGNS = [
  'bot','spider','crawler','curl','wget','phantomjs','headless',
  'selenium','puppeteer','playwright','python-requests','python-urllib',
  'axios','node-fetch','libwww-perl','java/','scrapy'
];

const BEMOB = process.env.BEMOB_URL || '';
const SECRET = process.env.SECRET_SIGN || '';
const DC_PREFIXES_RAW = (process.env.DC_PREFIXES || '13.,18.,23.,34.,35.,52.,54.,104.,107.,144.217.,192.0.2.').split(',').map(s=>s.trim()).filter(Boolean);
const LOG_WEBHOOK = process.env.LOG_WEBHOOK || ''; // optional
const ASYNC_LOG = String(process.env.ASYNC_LOG || '0') === '1';

if (BEMOB && !BEMOB.startsWith('https://')) {
  console.warn('Warning: BEMOB_URL should use https://');
}
if (SECRET.length < 16) {
  console.warn('Warning: SECRET_SIGN is short (<16). Consider using 32+ bytes.');
}

// helpers -------------------------------------------------
function getClientIP(req) {
  const header = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  return String(header).split(',')[0].trim();
}

function isClearBotUA(ua = '') {
  if (!ua) return true; // empty UA suspicious
  const low = ua.toLowerCase();
  return BOT_SIGNS.some(s => low.includes(s));
}

// basic IPv4 conversion and CIDR check (lightweight)
function ipv4ToInt(ip) {
  if (!ip) return null;
  const m = ip.match(/^(?:\d{1,3}\.){3}\d{1,3}$/);
  if (!m) return null;
  return ip.split('.').reduce((acc, oct) => (acc<<8) + (parseInt(oct,10) & 0xff), 0) >>> 0;
}
function inCidr(ip, cidr) {
  // cidr like "192.0.2.0/24"
  const parts = cidr.split('/');
  if (parts.length !== 2) return false;
  const base = ipv4ToInt(parts[0]);
  const mask = parseInt(parts[1],10);
  const ipInt = ipv4ToInt(ip);
  if (base === null || ipInt === null || Number.isNaN(mask)) return false;
  if (mask < 0 || mask > 32) return false;
  const shift = 32 - mask;
  return (ipInt >>> shift) === (base >>> shift);
}

function isDatacenterIP(ip = '') {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  // Check each prefix: allow either plain prefix startsWith OR CIDR notation
  for (const p of DC_PREFIXES_RAW) {
    if (!p) continue;
    if (p.includes('/')) {
      if (inCidr(ip, p)) return true;
    } else {
      // plain string prefix match (fast)
      if (ip.startsWith(p)) return true;
    }
  }
  return false;
}

function canonicalQsFromParams(params) {
  const entries = Array.from(params.entries()).sort((a,b) => a[0].localeCompare(b[0]));
  return entries.map(([k,v]) => `${k}=${v}`).join('&');
}

function signParamsWithTsAndNonce(params) {
  const ts = Math.floor(Date.now()/1000).toString();
  const nonce = crypto.randomBytes(6).toString('hex');
  params.set('ts', ts);
  params.set('nonce', nonce);
  const canonical = canonicalQsFromParams(params);
  // synchronous HMAC - small CPU cost, avoids async
  const h = crypto.createHmac('sha256', SECRET);
  h.update(canonical);
  const sign = h.digest('hex');
  return { sign, ts, nonce };
}

function buildFinalUrl(base, params) {
  const qs = params.toString();
  return base + (qs ? (base.includes('?') ? '&' : '?') + qs : '');
}

// produce short anonymized hash of click_id to include in logs
function anonymizeClickId(click_id = '') {
  if (!click_id) return null;
  try {
    const h = crypto.createHmac('sha256', SECRET.slice(0,16));
    h.update(String(click_id));
    return h.digest('hex').slice(0,12); // short fingerprint
  } catch (e) { return null; }
}

function asyncLog(payload) {
  if (!ASYNC_LOG || !LOG_WEBHOOK) return;
  try {
    // keep payload minimal and non-PII
    fetch(LOG_WEBHOOK, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(()=>{});
  } catch (e) { /* swallow errors - non-blocking */ }
}

// handler -------------------------------------------------
export default async function handler(req, res) {
  try {
    if (!BEMOB || !SECRET) {
      console.error('Missing BEMOB_URL or SECRET_SIGN in environment');
      return res.status(500).send('Server misconfiguration');
    }

    const ua = (req.headers['user-agent'] || '').toString();
    const ip = getClientIP(req);
    const referer = req.headers['referer'] || '';

    const clearBot = isClearBotUA(ua);
    const dc = isDatacenterIP(ip);
    if (clearBot && dc) {
      asyncLog({ event: 'blocked', reason: 'bot_and_dc', time: new Date().toISOString(), ip: ip ? ip.replace(/(\d+\.\d+)\.\d+\.\d+/, '$1.*.*') : null, ua: ua ? ua.slice(0,120) : null });
      return res.status(403).send('Forbidden');
    }

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (ALLOWED_PARAMS.has(k) && v != null && v !== '') params.set(k, String(v));
    }

    if (referer) params.set('ref', referer);

    // sign (mutates params) - synchronous HMAC
    const { sign, ts, nonce } = signParamsWithTsAndNonce(params);
    params.set('sign', sign);

    const finalUrl = buildFinalUrl(BEMOB, params);

    // minimal anonymized async log
    const clickHash = anonymizeClickId(params.get('click_id') || '');
    asyncLog({ event: 'redirect', time: new Date().toISOString(), ip: ip ? ip.replace(/(\d+\.\d+)\.\d+\.\d+/, '$1.*.*') : null, ua: ua ? ua.slice(0,120) : null, zoneid: params.get('zoneid') || null, click_hash: clickHash });

    // immediate redirect - NO AWAIT, preserve latency
    return res.redirect(302, finalUrl);

  } catch (e) {
    console.error('Error in redirect handler:', e);
    return res.status(500).send('Internal Server Error');
  }
}
