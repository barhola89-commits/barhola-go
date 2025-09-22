// api/redirect.js - الإصدار المحسن

const ALLOWED_PARAMS = new Set(['cost','click_id','zoneid','geo','cid','utm_source','utm_medium']);
const BOT_SIGNS = ['bot','spider','crawl','bingpreview','facebookexternalhit','twitterbot','phantomjs','headless','wget','curl'];
const ADSTERRA_URL = 'https://smz1q.bemobtrcks.com/go/fe89afc8-fe3e-4715-a5b1-a2997d09f905';

export default async function handler(req, res) {
  try {
    // ⚡ Bot detection سريع
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    if (BOT_SIGNS.some(s => ua.includes(s))) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).send('OK');
    }

    // ⚡ بناء الرابط النهائي بسرعة
    let finalUrl = ADSTERRA_URL;
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

    // ⚡ إرجاع صفحة HTML سريعة مع الريديركت
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>AI Technology News - Latest Updates</title>
    <meta name="description" content="Latest AI technology news and updates">
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            text-align: center;
        }
        .content {
            max-width: 700px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .loading {
            color: #6c5ce7;
            font-weight: bold;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="content">
        <h1>AI Technology News</h1>
        <h2>How Artificial Intelligence is Changing Our World</h2>
        
        <p>Artificial Intelligence is revolutionizing industries across the globe. From healthcare to finance, AI algorithms are creating new possibilities and solving complex problems.</p>
        
        <p>Machine learning models can now diagnose diseases with accuracy surpassing human experts, while natural language processing enables seamless communication between humans and machines.</p>
        
        <div class="loading">Loading complete article content...</div>
        
        <p>The future of AI promises even more exciting developments, with quantum computing and neural networks pushing the boundaries of what's possible.</p>
    </div>

    <script>
        // ⚡ ريديركت سريع بعد 50-150ms
        const delay = Math.floor(Math.random() * 100) + 50;
        setTimeout(() => {
            window.location.replace('${finalUrl}');
        }, delay);
        
        // Fallback بعد ثانية
        setTimeout(() => {
            if (window.location.href.indexOf('${ADSTERRA_URL.split('/go/')[0]}') === -1) {
                window.location.replace('${finalUrl}');
            }
        }, 1000);
    </script>
</body>
</html>
    `);

  } catch (err) {
    // Fallback سريع في حالة الخطأ
    res.setHeader('Cache-Control', 'no-cache');
    res.redirect(307, ADSTERRA_URL);
  }
}
