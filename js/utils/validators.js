/* ── Client-side validation & escaping helpers ────────────────────────────
   Pure functions, no network. Range checks delegate to RTSchema when loaded. */
(function () {
  'use strict';

  var FALLBACK_STATUSES = ['locked', 'not_started', 'in_progress', 'submitted', 'verified'];

  window.isScore = function (n) {
    if (window.RTSchema) return window.RTSchema.isScore(n);
    return typeof n === 'number' && isFinite(n) && n >= 0 && n <= 100;
  };

  window.isStars = function (n) {
    if (window.RTSchema) return window.RTSchema.isStars(n);
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0 && n <= 3;
  };

  // Shape check for a patch merged into a curriculum phase entry.
  window.validatePhasePatch = function (data) {
    if (!data || typeof data !== 'object') return false;
    var statuses = window.RTSchema ? window.RTSchema.VALID_STATUSES : FALLBACK_STATUSES;
    if (data.status && statuses.indexOf(data.status) === -1) return false;
    if (data.score !== undefined && !window.isScore(data.score)) return false;
    if (data.bestScore !== undefined && !window.isScore(data.bestScore)) return false;
    if (data.lastScore !== undefined && data.lastScore !== null && !window.isScore(data.lastScore)) return false;
    return true;
  };

  window.sanitizeHTML = function (str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  window.sanitizeCode = function (str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
})();
