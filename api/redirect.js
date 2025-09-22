// api/redirect.js - الإصدار المحسن بـ 302 Redirect

const ALLOWED_PARAMS = new Set(['cost','click_id','zoneid','geo','cid','utm_source','utm_medium']);
const BOT_SIGNS = ['bot','spider','crawl','bingpreview','facebookexternalhit','twitterbot','phantomjs','headless','wget','curl'];
const REDIRECT_TARGET = process.env.REDIRECT_TARGET || 'https://smz1q.bemobtrcks.com/go/fe89afc8-fe3e-4715-a5b1-a2997d09f905';

export default async function handler(req, res) {
  try {
    // Bot detection
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    if (BOT_SIGNS.some(s => ua.includes(s))) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).send('OK');
    }

    // بناء الرابط النهائي
    let finalUrl = REDIRECT_TARGET;
    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
    
    if (queryString) {
      const params = new URLSearchParams();
      const searchParams = new URLSearchParams(queryString);
      
      for (const [k, v] of searchParams.entries()) {
        if (ALLOWED_PARAMS.has(k)) {
          params.append(k, v);
        }
      }
      
      if (params.toString()) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + params.toString();
      }
    }

    // ⚡ استخدام 302 Redirect بدلاً من HTML
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'origin');
    
    // 302 Redirect فوري
    return res.redirect(302, finalUrl);

  } catch (err) {
    // Fallback
    res.setHeader('Cache-Control', 'no-cache');
    return res.redirect(302, REDIRECT_TARGET);
  }
}
