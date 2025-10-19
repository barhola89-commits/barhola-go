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
    <p class="small">صفحة الفحص والتحويل — انت بتوصل للتجربة المناسبة حالًا.</p>
    <a id="continueBtn" class="btn" href="SMARTLINK_HERE" style="display:none">اضغط للمتابعة</a>
    <p id="status" class="small" style="margin-top:10px">جارٍ التحقق من جودة الترافيك…</p>
  </div>

  <!-- ====== 1) Adscore SNIPPET ======
       استبدل التعليق ده بكود Adscore الرسمي اللي عندك
       الهدف: يفحص الزائر، لو عدّى الفلترة نقدر نكمل لعرض الإعلان.
  -->
  <script>
    /* --- START PLACEHOLDER: Adscore snippet --- 
       استبدل البلوك ده بالسكربت الحقيقي من Adscore (عادة بيحط window.adscore = {...} أو يستدعي callback)
    */
    (function mockAdscore(){
      console.log('Adscore placeholder running');
      // Simulate async check (pass after 800ms)
      window.adscoreReady = false;
      setTimeout(function(){
        window.adscoreReady = true;
        window.adscorePassed = true; // true = visitor passed, false = suspected bot
        // call callback if exists
        if(window.onAdscoreDone) window.onAdscoreDone(window.adscorePassed);
      }, 800);
    })();
    /* --- END PLACEHOLDER --- */
  </script>

  <!-- ====== 2) Monetag interstitial SNIPPET ======
       ضع كود Monetag الرسمي هنا (الـ interstitial tag).
       لو Monetag بيدي callback عند اغلاق الإعلان استعمله.
  -->
  <script>
    /* Monetag placeholder — استبدله بكود Monetag الحقيقي */
    (function mockMonetagInterstitial(){
      console.log('Monetag interstitial placeholder running (will "close" in 2500ms)');
      // Simulate that Monetag will show ad only after adscore passed
      window.__monetagReady = false;
      setTimeout(function(){
        window.__monetagReady = true;
        // simulate ad closed after shown (callback)
        setTimeout(function(){
          // Monetag closed the ad -> fire event/callback
          if(window.onMonetagAdClosed) window.onMonetagAdClosed();
          // also postMessage for fallback listeners
          window.postMessage({monetag:'closed'}, window.location.origin);
        }, 2500);
      }, 300); // small delay to simulate ad show time
    })();
  </script>

  <!-- ====== Main flow logic ====== -->
  <script>
    const SMARTLINK = "SMARTLINK_HERE"; // <-- استبدل بالرابط الحقيقي للـ Smartlink

    function goToSmartlink(){
      // Optional: ممكن تبع tracking params قبل الredirect
      window.location.href = SMARTLINK;
    }

    // CALLBACKs expected:
    // - onAdscoreDone(passed) -> adscore finished check
    // - onMonetagAdClosed() -> monetag ad closed

    // when adscore done:
    window.onAdscoreDone = function(passed){
      document.getElementById('status').textContent = passed ? 'الزائر صالح — عرض الإعلان الآن...' : 'الزائر مش صالح — تحويل مباشر...';
      if(!passed){
        // لو Adscore رفض الزائر: مش هنعرض إعلانات، نوديهم للـ Smartlink (أو ممكن تبطّله تمامًا)
        // ممكن تكون سياسة تانية، لكن هنا نعمل redirect فورًا عشان متفقدش impression.
        goToSmartlink();
      } else {
        // لو عدّي الفحص: نسمح لكود Monetag انه يعرض الإعلان (الكود اتحط فوق)
        // بعد عرض الإعلان Monetag لازم يكالّلنا عبر callback onMonetagAdClosed
        // لو ما بيدّيش callback، فfallback timers موجودة تحت
      }
    };

    // Monetag callback on close:
    window.onMonetagAdClosed = function(){
      window.__monetagAdClosed = true;
      // فورًا اعمل redirect للـ Smartlink
      goToSmartlink();
    };

    // listen for postMessage fallback
    window.addEventListener('message', function(e){
      try{
        if(e.data && e.data.monetag === 'closed'){
          window.onMonetagAdClosed();
        }
      }catch(err){}
    }, false);

    // fallback: لو Adscore ما خلصش بعد 2.5s، اعرض زر متابعة
    setTimeout(function(){
      if(!window.adscoreReady){
        document.getElementById('status').textContent = 'تأخر في التحقق — اضغط للمتابعة';
        document.getElementById('continueBtn').style.display = 'inline-block';
      }
    }, 2500);

    // fallback: لو بعد 6s ما فيش ad close أو pass -> نعرض الزر
    setTimeout(function(){
      if(!window.__monetagAdClosed && window.adscoreReady){
        document.getElementById('status').textContent = 'انتهى الوقت — اضغط للمتابعة';
        document.getElementById('continueBtn').style.display = 'inline-block';
      }
    }, 6000);

    // زر المتابعة
    document.getElementById('continueBtn').addEventListener('click', function(e){
      e.preventDefault();
      goToSmartlink();
    });
  </script>
</body>
</html>
