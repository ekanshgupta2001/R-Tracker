/* ── Client-side validation for Firestore writes ──────────────────────── */
(function () {
  'use strict';

  var VALID_STATUSES = ['locked', 'not_started', 'in_progress', 'submitted', 'verified'];

  window.validateCurriculumWrite = function (data) {
    if (!data || typeof data !== 'object') return false;
    if (data.status && VALID_STATUSES.indexOf(data.status) === -1) return false;
    if (data.aiScore !== undefined && (typeof data.aiScore !== 'number' || data.aiScore < 0 || data.aiScore > 100)) return false;
    if (data.score !== undefined && (typeof data.score !== 'number' || data.score < 0 || data.score > 100)) return false;
    if (data.verifiedBy && data.verifiedBy !== 'ai_reviewer' && data.verifiedBy.length > 50) return false;
    return true;
  };

  window.validateProfileWrite = function (data) {
    if (!data || typeof data !== 'object') return false;
    if (data.role && ['player', 'coach'].indexOf(data.role) === -1) return false;
    if (data.displayName && data.displayName.length > 100) return false;
    return true;
  };

  window.validateTeamMemberWrite = function (data) {
    if (!data || typeof data !== 'object') return false;
    if (data.overallScore !== undefined && (typeof data.overallScore !== 'number' || data.overallScore < 0 || data.overallScore > 100)) return false;
    if (data.levelsCompleted !== undefined && (typeof data.levelsCompleted !== 'number' || data.levelsCompleted < 0 || data.levelsCompleted > 50)) return false;
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
