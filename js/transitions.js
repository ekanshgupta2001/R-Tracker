// ── R-Tracker Burgundy Wipe Page Transition ──────────────────────────────────
// Adds a branded wipe effect when navigating between pages.
// Requires #rt-page-wipe div in every page's <body>.

(function () {
  'use strict';

  var wipe = document.getElementById('rt-page-wipe');
  if (!wipe) return;

  var content = document.querySelector('main, #main-content, #app');

  // ── Page load: reveal with wipe-out if navigating internally ──────────
  var isInternal = sessionStorage.getItem('rt-navigating') === '1';
  sessionStorage.removeItem('rt-navigating');

  if (isInternal) {
    // Hide content, show wipe covering screen
    if (content) content.classList.add('fade-hidden');
    wipe.style.transform = 'scaleX(1)';
    wipe.style.transformOrigin = 'right center';

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        wipe.classList.add('wipe-out');
        setTimeout(function () {
          if (content) content.classList.remove('fade-hidden');
        }, 120);
        setTimeout(function () {
          wipe.classList.remove('wipe-out');
          wipe.style.transform = 'scaleX(0)';
        }, 300);
      });
    });
  }

  // ── Back/forward cache (bfcache) ──────────────────────────────────────
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      if (content) content.classList.remove('fade-hidden');
      wipe.classList.remove('wipe-in');
      wipe.style.transform = 'scaleX(1)';
      wipe.classList.add('wipe-out');
      setTimeout(function () {
        wipe.classList.remove('wipe-out');
        wipe.style.transform = 'scaleX(0)';
      }, 300);
    }
  });

  // ── Intercept navigation clicks ───────────────────────────────────────
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

    // Flag for the next page to know it's an internal navigation
    sessionStorage.setItem('rt-navigating', '1');

    // Fade content out
    if (content) content.classList.add('fade-hidden');

    // Wipe in (cover the page)
    wipe.style.transform = 'scaleX(0)';
    wipe.style.transformOrigin = 'left center';
    wipe.classList.remove('wipe-out');
    wipe.classList.add('wipe-in');

    // Navigate after wipe covers screen
    setTimeout(function () {
      window.location.href = href;
    }, 250);
  });
})();
