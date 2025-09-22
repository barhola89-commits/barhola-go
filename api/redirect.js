// api/redirect.js
export default async function handler(req, res) {
  try {
    const BEMOB_TARGET = process.env.BEMOB_TARGET || 'https://example.com';

    const allowed = new Set(['cost','click_id','zoneid','geo','cid','utm_source','utm_medium']);
    const incoming = new URL(req.url, `https://${req.headers.host}`);
    const params = [];
    for (const [k, v] of incoming.searchParams.entries()) {
      if (allowed.has(k)) params.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    const final = params.length ? `${BEMOB_TARGET}${BEMOB_TARGET.includes('?') ? '&' : '?'}${params.join('&')}` : BEMOB_TARGET;

    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const botSigns = ['bot','spider','crawl','bingpreview','facebookexternalhit','twitterbot','phantomjs','headless','wget','curl'];
    let isBot = botSigns.some(s => ua.includes(s));

    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
      ua,
      referer: req.headers.referer || null,
      final,
      isBot
    }));

    if (isBot) return res.status(200).send('OK');

    res.setHeader('Referrer-Policy', 'origin');
    return res.redirect(302, final);
  } catch (err) {
    console.error('redirect error', err);
    return res.redirect(302, process.env.BEMOB_TARGET || 'https://example.com');
  }
}
