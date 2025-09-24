// api/redirect.js - الإصدار المحسن
const ALLOWED_PARAMS = new Set(['cost','click_id','zoneid','geo','cid','utm_source','utm_medium']);
const BOT_SIGNS = ['bot','spider','crawl','bingpreview','facebookexternalhit','twitterbot','phantomjs','headless','wget','curl','scraper','selenium','puppeteer','playwright'];

// أضف بوتات إضافية
const ADVANCED_BOT_SIGNS = [
    'python-requests', 'java/', 'go-http-client', 'node-fetch',
    'axios/', 'postman', 'insomnia', 'apache-httpclient'
];

const REDIRECT_TARGET = process.env.REDIRECT_TARGET || 'https://smz1q.bemobtrcks.com/go/fe89afc8-fe3e-4715-a5b1-a2997d09f905';

export default async function handler(req, res) {
  try {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    
    // فلترة بوتات محسنة
    if (BOT_SIGNS.some(s => ua.includes(s)) || ADVANCED_BOT_SIGNS.some(s => ua.includes(s))) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      console.log('Bot blocked:', { ua: ua.substring(0, 100), ip });
      return res.status(200).send('OK');
    }

    // تحقق من IP مريب (إضافة جديدة)
    const suspiciousIPPatterns = [
        /^104\.128\./, /^107\.170\./, /^144\.217\./, // IP ranges معروفة للبوتات
        ip.startsWith('192.0.2.'), // IPs تجريبية
        ip === '127.0.0.1' || ip === 'localhost'
    ];
    
    if (suspiciousIPPatterns.some(pattern => pattern.test && pattern.test(ip) || pattern === ip)) {
        console.log('Suspicious IP blocked:', { ip, ua: ua.substring(0, 50) });
        return res.status(200).send('OK');
    }

    // الباقي كما هو مع تحسين طفيف في التسجيل
    const referer = req.headers['referer'] || req.headers['referrer'] || '';
    let finalUrl = REDIRECT_TARGET;
    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
    const params = new URLSearchParams(queryString || '');
    const keep = new URLSearchParams();
    
    for (const [k, v] of params.entries()) {
      if (ALLOWED_PARAMS.has(k)) keep.append(k, v);
    }

    // إضافة صغيرة: تحقق من البيانات المطلوبة
    if (!keep.get('click_id')) {
        console.warn('Missing click_id - potential invalid request');
    }

    if (keep.toString()) finalUrl += (finalUrl.includes('?') ? '&' : '?') + keep.toString();

    // Security headers (كما هي)
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer'); // تغيير بسيط لزيادة الخصوصية
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

    // التسجيل المحسن
    const logObj = {
      t: new Date().toISOString(),
      ip,
      ua_snippet: ua.substring(0, 80), // تقليل حجم اللوج
      has_referer: !!referer,
      click_id: keep.get('click_id'),
      zoneid: keep.get('zoneid'),
      geo: keep.get('geo'),
      status: 'redirected'
    };
    
    console.log(JSON.stringify(logObj));

    return res.redirect(302, finalUrl);

  } catch (err) {
    console.error('Redirect error:', err.message);
    res.setHeader('Cache-Control', 'no-cache');
    return res.redirect(302, REDIRECT_TARGET);
  }
}
