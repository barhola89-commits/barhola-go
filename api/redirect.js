<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Loading…</title>
  <meta name="monetag" content="2b8a73a5f80912d1cfa704905bdf81f0"> <!-- verification meta -->
  <style>
    body{font-family: Arial, sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#fff}
    .box{text-align:center}
    .btn{display:inline-block;padding:10px 18px;border-radius:6px;background:#1a73e8;color:#fff;text-decoration:none;margin-top:12px}
  </style>
</head>
<body>
  <div class="box">
    <h2>جاري التحميل…</h2>
    <p>الصفحة هتتحول للتجربة المناسبة حالًا.</p>
    <a id="continueBtn" class="btn" href="SMARTLINK_URL" style="display:none">اضغط للمتابعة</a>
  </div>

  <!-- ====== لصق كود Monetag interstitial هنا (استبدل البلوك ده بالكود الحقيقي) ====== -->
  <script>
    // *** هذا مجرد placeholder — استبدله بكود Monetag الرسمي الذي سيعرض الإعلان ***
    (function mockMonetagInterstitial(){
      console.log('Monetag interstitial placeholder running');
      setTimeout(function(){
        window.__monetagAdClosed = true;
        document.getElementById('continueBtn').style.display = 'inline-block';
      }, 2500);
    })();
  </script>
  <!-- ================================================================================ -->

  <script>
    const SMARTLINK = "SMARTLINK_URL"; // استبدل بالرابط الحقيقي للـ Smartlink
    function goToSmartlink(){ window.location.href = SMARTLINK; }

    // fallback بعد 4 ثواني لعرض زر المتابعة
    setTimeout(()=> {
      if(!window.__monetagAdClosed){
        document.getElementById('continueBtn').style.display = 'inline-block';
      }
    }, 4000);

    // fallback auto redirect بعد 12 ثانية لو الإعلان ما غلقش
    setTimeout(()=> {
      if(!window.__monetagAdClosed){
        goToSmartlink();
      }
    }, 12000);

    document.getElementById('continueBtn').addEventListener('click', e=>{
      e.preventDefault();
      goToSmartlink();
    });
  </script>
</body>
</html>
