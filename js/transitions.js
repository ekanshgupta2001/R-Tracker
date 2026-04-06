// ── R-Tracker Page Transition — Scan Line + Logo Flash ───────────────────────
// A thin burgundy line sweeps the screen with a centered "R-" logo flash.
// Requires #rt-transition, #rt-scan-line, #rt-logo-flash in every page's <body>.

(function () {
  'use strict';

  var transition = document.getElementById('rt-transition');
  var scanLine = document.getElementById('rt-scan-line');
  var logoFlash = document.getElementById('rt-logo-flash');
  if (!transition || !scanLine || !logoFlash) return;

  function getContent() {
    return document.querySelector('main, #main-content, #app');
  }

  // === PAGE ARRIVAL: scan up to reveal ===
  function playEntrance() {
    if (sessionStorage.getItem('rt-navigating') !== '1') return;
    sessionStorage.removeItem('rt-navigating');

    var content = getContent();
    if (content) content.classList.add('fade-hidden');

    transition.style.display = 'block';

    scanLine.className = '';
    void scanLine.offsetWidth;
    scanLine.style.top = '100%';

    requestAnimationFrame(function () {
      scanLine.classList.add('scanning-up');

      setTimeout(function () { logoFlash.classList.add('flash'); }, 100);

      setTimeout(function () {
        if (content) content.classList.remove('fade-hidden');
      }, 150);

      setTimeout(function () {
        transition.style.display = 'none';
        scanLine.className = '';
        logoFlash.className = '';
        scanLine.style.top = '-4px';
        if (content) {
          content.classList.remove('transitioning-out');
          content.classList.remove('fade-hidden');
        }
      }, 450);
    });
  }

  if (document.readyState === 'complete') {
    playEntrance();
  } else {
    window.addEventListener('load', playEntrance);
  }

  // === PAGE EXIT: scan down to cover ===
  function playExit(href) {
    var content = getContent();

    sessionStorage.setItem('rt-navigating', '1');

    if (content) content.classList.add('transitioning-out');

    transition.style.display = 'block';

    scanLine.className = '';
    scanLine.style.top = '-4px';
    void scanLine.offsetWidth;

    scanLine.classList.add('scanning');

    setTimeout(function () { logoFlash.classList.add('flash'); }, 120);

    setTimeout(function () { window.location.href = href; }, 350);
  }

  // === INTERCEPT NAVIGATION LINKS ===
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;

    var href = link.getAttribute('href');
    if (!href) return;
    if (href.startsWith('#') || href.startsWith('javascript:') ||
        href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (href.startsWith('http') && href.indexOf(window.location.host) === -1) return;
    if (link.target === '_blank') return;

    e.preventDefault();
    playExit(href);
  });

  // === HANDLE BACK/FORWARD NAVIGATION ===
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      var content = getContent();
      if (content) {
        content.classList.remove('transitioning-out');
        content.classList.remove('fade-hidden');
        content.style.filter = '';
        content.style.opacity = '';
      }
      transition.style.display = 'none';
      scanLine.className = '';
      logoFlash.className = '';
    }
  });
})();
