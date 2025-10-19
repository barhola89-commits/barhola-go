<!doctype html>
<html lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Loading…</title>
  <meta name="monetag" content="2b8a73a5f80912d1cfa704905bdf81f0"> <!-- verification meta -->
  <style>
    body{font-family: Arial, sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0b0b0b;color:#fff}
    .box{text-align:center;max-width:480px;padding:20px}
    .btn{display:inline-block;padding:10px 18px;border-radius:6px;background:#1a73e8;color:#fff;text-decoration:none;margin-top:12px}
    .small{font-size:13px;color:#bdbdbd}
  </style>
</head>
<body>
  <div class="box">
    <h2>جاري التحميل…</h2>
    <p class="small">الصفحة هتتحول للتجربة المناسبة حالًا. لو معلق، اضغط متابعة.</p>
    <a id="continueBtn" class="btn" href="SMARTLINK_HERE" style="display:none">اضغط للمتابعة</a>
    <p id="status" class="small" style="margin-top:10px">جاري عرض الإعلان...</p>
  </div>

  <!-- ========================
       ضع هنا Monetag interstitial snippet بالظبط
       مثال: ألصق السكربت اللي Monetag ادهولك هنا
       المهم: لا تعدّل في السكربت
     ======================== -->
  <script>
    /* Monetag interstitial snippet should go here.
       Replace this placeholder with the exact Monetag code.
       If Monetag offers a callback for ad close, use it to call onMonetagAdClosed().
    */
    (function mockMonetagInterstitial(){
      // REMOVE this mock when you paste real Monetag code
      console.log('Monetag placeholder: simulate ad shown and then closed (2.5s)');
      setTimeout(function(){
        // simulate monetag closed event
        window.postMessage({monetag:'closed'}, window.location.origin);
      }, 2500);
    })();
  </script>

  <script>
    const SMARTLINK = "SMARTLINK_HERE"; // <-- استبدل بالرابط الحقيقي للـ Smartlink

    function goToSmartlink(){
      // optional: attach tracking params here before redirect if لازم
      window.location.href = SMARTLINK;
    }

    // handle monetag close (expect monetag to postMessage or call callback)
    function onMonetagAdClosed(){
      // safety: mark closed and redirect
      window.__monetagAdClosed = true;
      goToSmartlink();
    }

    // listen for postMessage fallback (many tags use postMessage)
    window.addEventListener('message', function(e){
      try{
        if(e.origin === window.location.origin && e.data && e.data.monetag === 'closed'){
          onMonetagAdClosed();
        } else if(e.data && e.data.monetag === 'closed'){
          // in case origin differs but message valid
          onMonetagAdClosed();
        }
      } catch(err){}
    }, false);

    // fallback UI/timeouts
    // show continue button after 4s if nothing happened
    setTimeout(()=> {
      if(!window.__monetagAdClosed){
        document.getElementById('status').textContent = 'اضغط للمتابعة إذا لم يبدأ الإعلان';
        document.getElementById('continueBtn').style.display = 'inline-block';
      }
    }, 4000);

    // hard fallback redirect after 12s
    setTimeout(()=> {
      if(!window.__monetagAdClosed){
        goToSmartlink();
      }
    }, 12000);

    document.getElementById('continueBtn').addEventListener('click', function(e){
      e.preventDefault();
      goToSmartlink();
    });
  </script>
</body>
</html>
