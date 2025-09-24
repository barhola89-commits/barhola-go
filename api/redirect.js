// api/redirect.js — Vercel serverless (fast 302 + light security + HMAC + interstitial + optional geo-check)
// Requires Node 18+ (global fetch available on Vercel)
import crypto from 'crypto';

const ALLOWED_PARAMS = new Set(['cost','click_id','zoneid','geo','cid','utm_source','utm_medium']);
const BOT_SIGNS = ['bot','spider','curl','wget','phantomjs','headless','selenium','puppeteer','playwright','python-requests','axios','node-fetch'];
const DC_RANGES = [/^104\.128\./, /^107\.170\./, /^144\.217\./, /^192\.0\.2\./];

const BEMOB = process.env.BEMOB_URL || 'https://smz1q.bemobtrcks.com/go/fe89afc8-fe3e-4715-a5b1-a2997d09f905';
const SECRET = process.env.SECRET_SIGN || 'change_this_secret';
const GEO_CHECK_ENABLED = (process.env.GEO_CHECK === '1'); // set to '1' to enable geo-check (optional)
const GEO_API_TIMEOUT_MS = 250; // short timeout to avoid latency

function isDatacenterIP(ip = '') {
  // IMPORTANT: don't treat missing IP as datacenter (fix requested)
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  return DC_RANGES.some(rx => rx.test(ip));
}

function signParams(qs) {
  const h = crypto.createHmac('sha256', SECRET);
  h.update(qs);
  return h.digest('hex').slice(0, 20);
}

function buildFinalUrl(base, params) {
  const qs = params.toString();
  return base + (qs ? (base.includes('?') ? '&' : '?') + qs : '');
}

function quickInterstitialAutoRedirect(finalUrl, reason = '') {
  // Very lightweight interstitial that runs JS checks and redirects asap.
  // Keeps latency minimal and preserves visits.
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
      // basic bot-detect: navigator.webdriver quick check
      const isHeadless = !!navigator.webdriver;
      if (!isHeadless) {
        // micro delay to allow any client-side checks (very small)
        setTimeout(() => { location.replace(${JSON.stringify(finalUrl)}); }, 120);
      } else {
        // if headless detected, don't redirect — show message
        document.write('<p>Detected automated browser. Request blocked.</p>');
      }
    } catch (e) {
      location.replace(${JSON.stringify(finalUrl)});
    }
  </script>
</body>
</html>`;
}

async function getCountryFromIP(ip) {
  // Optional: simple fetch to ipapi.co (no API key required for basic info) with short timeout.
  // If you prefer another provider, change the URL and handling accordingly.
  if (!ip) return null;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), GEO_API_TIMEOUT_MS);
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    const txt = (await res.text()).trim();
    return txt || null; // returns country code like "EG", "US", etc.
  } catch (e) {
    return null;
  }
}

// PLACEHOLDER: S3 logging function
// If you want to enable, uncomment AWS SDK import and implement the function below.
// Keep it async and non-blocking if you can (fire-and-forget) to avoid latency.
// Example:
// import AWS from 'aws-sdk';
// const s3 = new AWS.S3({ region: process.env.AWS_REGION });
// async function logToS3(obj) {
//   const key = `adlogs/${new Date().toISOString().replace(/[:.]/g,'-')}-${Math.random().toString(36).slice(2,8)}.json`;
//   await s3.putObject({ Bucket: process.env.S3_BUCKET, Key: key, Body: JSON.stringify(obj), ContentType: 'application/json' }).promise();
// }

export default async function handler(req, res) {
  try {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const ip = ((req.headers['x-forwarded-for'] || req.socket.remoteAddress)
