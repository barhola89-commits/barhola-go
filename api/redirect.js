// api/redirect.js — Vercel serverless (fast 302 redirect + security + HMAC)
import crypto from 'crypto';

const ALLOWED_PARAMS = new Set(['cost','click_id','zoneid','geo','cid','utm_source','utm_medium']);
const BOT_SIGNS = [
  'bot','spider','curl','wget','phantomjs','headless',
  'selenium','puppeteer','playwright','python-requests',
  'axios','node-fetch'
];
const DC_RANGES = [/^104\.128\./, /^107\.170\./, /^144\.217\./, /^192\.0\.2\./];

const BEMOB = process.env.BEMOB_URL || 'https://smz1q.bemobtrcks.com/go/fe89afc8-fe3e-4715-a5b1-a2997d09f905';
const SECRET = process.env.SECRET_SIGN || 'change_this_secret';

// Detect DC IP ranges
function isDatacenterIP(ip = '') {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  return DC_RANGES.some(rx => rx.test(ip));
}

// Sign params
function signParams(qs) {
  const h = crypto.createHmac('sha256', SECRET);
  h.update(qs);
  return h.digest('hex').slice(0, 20);
}

// Build URL
function buildFinalUrl(base, params) {
  const qs = params.toString();
  return base + (qs ? (base.includes('?') ? '&' : '?') + qs : '');
}

export default async function handler(req, res) {
  try {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    // bot filter
    if (BOT_SIGNS.some(sig => ua.includes(sig)) || isDatacenterIP(ip)) {
      return res.status(403).send('Forbidden');
    }

    // allowed params
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (ALLOWED_PARAMS.has(k)) params.set(k, v);
    }

    // add sign
    const sign = signParams(params.toString());
    params.set('sign', sign);

    // final redirect (302)
    const finalUrl = buildFinalUrl(BEMOB, params);
    return res.redirect(302, finalUrl);

  } catch (e) {
    console.error('Error in redirect handler:', e);
    return res.status(500).send('Internal Server Error');
  }
}
