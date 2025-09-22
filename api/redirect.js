// api/redirect.js

// ⚡ تحسينات الأداء - يتم تحميلها مرة واحدة عند التشغيل
const ALLOWED_PARAMS = new Set(['cost','click_id','zoneid','geo','cid','utm_source','utm_medium']);
const BOT_SIGNS = ['bot','spider','crawl','bingpreview','facebookexternalhit','twitterbot','phantomjs','headless','wget','curl'];
const DEFAULT_TARGET = 'https://earnwithbarhoola.blogspot.com/p/redirect.html';

// 🚀 Cache للبيانات الثابتة
const BLOGGER_TARGET = process.env.BLOGGER_TARGET || DEFAULT_TARGET;

export default async function handler(req, res) {
  try {
    // ⚡ التوجيه السريع للبوتات بدون معالجة إضافية
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    if (BOT_SIGNS.some(s => ua.includes(s))) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).send('OK');
    }

    // ⚡ معالجة URL بأقل عمليات ممكنة
    let finalUrl = BLOGGER_TARGET;
    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
    
    if (queryString) {
      const params = [];
      const searchParams = new URLSearchParams(queryString);
      
      for (const [k, v] of searchParams.entries()) {
        if (ALLOWED_PARAMS.has(k)) {
          params.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
        }
      }
      
      if (params.length > 0) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + params.join('&');
      }
    }

    // 🚀 إعدادات headers للأداء الأمثل
    res.setHeader('Referrer-Policy', 'origin');
    res.setHeader('Cache-Control', 'public, max-age=60'); // cache لمدة دقيقة
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    
    // ⚡ استخدام 307 بدلاً من 302 لأداء أفضل
    return res.redirect(307, finalUrl);

  } catch (err) {
    // 🚀 fallback سريع في حالة الخطأ
    console.error('Redirect error:', err.message);
    res.setHeader('Cache-Control', 'no-cache');
    return res.redirect(307, BLOGGER_TARGET);
  }
}
