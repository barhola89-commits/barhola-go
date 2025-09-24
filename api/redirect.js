// api/redirect.js — Vercel serverless (fast 302 + light security + HMAC + interstitial + optional geo-check)
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
const GEO_CHECK_ENABLED = (process.env.GEO_CHECK === '1');
const GEO_API_TIMEOUT_MS = 250;

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

// Simple interstitial with JS redirect
function quickInterstitialAutoRedirect(finalUrl) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Continue</title>
</head>
<body>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${finalUrl}">
    <p>Please <a href="${finalUrl}">click here to continue</a>.</p>
  </noscript>
  <script>
    try {
      const isHeadless = !!navigator.webdriver;
      if (!isHeadless) {
        setTimeout(() => { location.replace(${JSON.stringify(finalUrl)}); }, 120);
      } else {
        document.write('<p>Detected automated browser. Request blocked.</p>');
      }
    } catch (e) {
      location.replace(${JSON.stringify(finalUrl)});
    }
  </script>
</body>
</html>`;
}

// Geo check via ipapi.co
async function getCountryFromIP(ip) {
  if (!ip) return null;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), GEO_API_TIMEOUT_MS);
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    const txt = (await res.text()).trim();
    return txt || null;
  } catch (e) {
    return null;
  }
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

    // geo-check if enabled
    if (GEO_CHECK_ENABLED) {
      const country = await getCountryFromIP(ip);
      if (country && req.query.geo && country.toUpperCase() !== req.query.geo.toUpperCase()) {
        return res.status(403).send('Geo Mismatch');
      }
    }

    // final redirect
    const finalUrl = buildFinalUrl(BEMOB, params);
    const html = quickInterstitialAutoRedirect(finalUrl);

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);

  } catch (e) {
    console.error('Error in redirect handler:', e);
    return res.status(500).send('Internal Server Error');
  }
}
