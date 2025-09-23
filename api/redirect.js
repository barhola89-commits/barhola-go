// api/redirect.js — keep 302, better logging of click_id/zoneid/geo
const ALLOWED_PARAMS = new Set(['cost','click_id','zoneid','geo','cid','utm_source','utm_medium']);
const BOT_SIGNS = ['bot','spider','crawl','bingpreview','facebookexternalhit','twitterbot','phantomjs','headless','wget','curl'];
const REDIRECT_TARGET = process.env.REDIRECT_TARGET || 'https://smz1q.bemobtrcks.com/go/fe89afc8-fe3e-4715-a5b1-a2997d09f905';
const LOG_ENDPOINT = process.env.LOG_ENDPOINT || '';
const APP_SOURCE_TAG = process.env.APP_SOURCE_TAG || ''; // optional, e.g. 'bemob' — if you want to append non-sensitive source tag

export default async function handler(req, res) {
  try {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const referer = req.headers['referer'] || req.headers['referrer'] || '';

    // Simple bot filter (kept as in your code)
    if (BOT_SIGNS.some(s => ua.includes(s))) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).send('OK');
    }

    // Build final url preserving allowed params
    let finalUrl = REDIRECT_TARGET;
    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
    const params = new URLSearchParams(queryString || '');
    const keep = new URLSearchParams();
    for (const [k, v] of params.entries()) {
      if (ALLOWED_PARAMS.has(k)) keep.append(k, v);
    }

    // Optional: append non-sensitive source tag for audit (doesn't break 302)
    if (APP_SOURCE_TAG && !keep.has('src')) {
      keep.append('src', APP_SOURCE_TAG);
    }

    if (keep.toString()) finalUrl += (finalUrl.includes('?') ? '&' : '?') + keep.toString();

    // Security headers
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

    // Extract key params for easy audit
    const click_id = keep.get('click_id') || null;
    const zoneid = keep.get('zoneid') || null;
    const geo = keep.get('geo') || null;

    // Log minimal info to Vercel logs (useful for audits) — avoid storing PII long-term
    const logObj = {
      t: new Date().toISOString(),
      ip,
      ua,
      referer_present: referer ? true : false,
      path: req.url,
      target: finalUrl,
      click_id,
      zoneid,
      geo
    };
    console.log(JSON.stringify(logObj));

    // If you have an external logging endpoint, POST there (non-blocking)
    if (LOG_ENDPOINT) {
      fetch(LOG_ENDPOINT, {
        method: 'POST',
        headers: {'content-type':'application/json'},
        body: JSON.stringify(logObj)
      }).catch(()=>{});
    }

    // Final redirect (302) — زي ما انت عايز
    return res.redirect(302, finalUrl);

  } catch (err) {
    console.error('redirect error', err);
    res.setHeader('Cache-Control', 'no-cache');
    return res.redirect(302, REDIRECT_TARGET);
  }
}
