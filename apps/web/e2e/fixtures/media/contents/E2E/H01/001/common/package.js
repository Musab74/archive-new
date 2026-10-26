/* E2E packaged lesson (Type A) — the package's own player script (the real packages ship one per lesson).
 * Exposes what player2.php / the SPA look for: .time1 .playerText (mm:ss playhead), ._nextBtn, completeStudy(),
 * window.contentsData.menus + currentPageNo + gotoMenu(n), and calls the parent bridge (PlayStudyInfo / PlayStudyCounsel). */
(function () {
  var cfg = window.E2E_SECTION || { page: 0, lectureCode: 'E2EH01', contentsIdx: 9131 };
  window.contentsData = { menus: [{ title: '1. 들어가며', url: '../01/index.html' }, { title: '2. 핵심 정리', url: '../02/index.html' }] };
  window.currentPageNo = cfg.page;
  window.gotoMenu = function (n) { var m = window.contentsData.menus[n]; if (m) location.href = m.url; };
  window.completeStudy = function () { document.body.setAttribute('data-complete', 'Y'); return true; };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(sec) { sec = Math.max(0, Math.floor(sec || 0)); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); }
  document.addEventListener('DOMContentLoaded', function () {
    var v = document.querySelector('video');
    var t = document.querySelector('.time1 .playerText');
    var src = document.createElement('source');
    src.src = 'video/01.mp4'; // main.js-style run-time source (hls-published.ts: <lesson>/<NN>/video/*.mp4)
    src.type = 'video/mp4';
    v.appendChild(src);
    v.load();
    v.addEventListener('timeupdate', function () { if (t) t.textContent = fmt(v.currentTime); });
    v.addEventListener('ended', function () { window.completeStudy(); });
    var info = document.querySelector('[data-act=info]');
    if (info) info.addEventListener('click', function () { if (parent && parent.PlayStudyInfo) parent.PlayStudyInfo(cfg.lectureCode, cfg.contentsIdx); });
    var ask = document.querySelector('[data-act=counsel]');
    if (ask) ask.addEventListener('click', function () { if (parent && parent.PlayStudyCounsel) parent.PlayStudyCounsel(cfg.lectureCode, cfg.contentsIdx); });
    var lis = document.querySelectorAll('.menu li');
    for (var i = 0; i < lis.length; i++) if (i === cfg.page) lis[i].className = 'on';
  });
})();
