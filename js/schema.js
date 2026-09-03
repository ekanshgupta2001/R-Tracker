// ── R-Tracker v2 — RTSchema ───────────────────────────────────────────────────
// The single source of truth for what the app stores. If a field is not produced
// by createEmptyState()/createEmptyPhase(), it is not stored. Bump SCHEMA_VERSION
// and add a MIGRATIONS entry whenever the shape changes.
//
// Loaded non-deferred in <head> before js/store.js on every page.
// Exposes: window.RTSchema

(function () {
  'use strict';

  var SCHEMA_VERSION = 2;
  var APP_VERSION = '2.1.0';

  var PHASE_IDS = [
    'phase0', 'phase1', 'phase2', 'phase3', 'phase4', 'phase5',
    'advanced_command', 'advanced_strategy', 'capstone'
  ];
  var VALID_STATUSES = ['locked', 'not_started', 'in_progress', 'submitted', 'verified'];
  var RESULT_STATUSES = ['ungraded', 'graded', 'reflection'];
  var ATTEMPT_KINDS = ['mc', 'theory', 'code'];

  var LIMITS = {
    coachReports: 20,
    sessions: 500,
    runs: 600,            // per-run level records (driver.runs); ~50 per level
    attempts: 5000,
    reviewsPerPhase: 10,
    theoryHistoryPerSection: 10,
    codeMaxLen: 50000,
    theoryMaxLen: 5000,
    notesMaxLen: 5000,
    nameMaxLen: 100,
    pathsMax: 50,
    strategiesMax: 50,
    levelCount: 12,
    importMaxBytes: 4 * 1024 * 1024
  };

  // ── Small validators (also re-exported by js/utils/validators.js) ─────────
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function isScore(n) { return typeof n === 'number' && isFinite(n) && n >= 0 && n <= 100; }
  function isStars(n) { return isInt(n) && n >= 0 && n <= 3; }
  function isPlainObject(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  // Style diagnostics are null until enough of a session was driven at speed.
  function isScoreOrNull(n) { return n === null || isScore(n); }
  function isFraction(n) { return typeof n === 'number' && isFinite(n) && n >= 0 && n <= 1; }

  // ── Empty shapes ──────────────────────────────────────────────────────────
  function createEmptyPhase(phaseId) {
    if (phaseId === 'phase0') {
      return {
        status: 'not_started',
        quizAnswers: {},
        score: 0,
        passed: false,
        attempts: 0,
        lastAttempt: null,
        verifiedAt: null,
        verifiedBy: null
      };
    }
    return {
      status: 'locked',
      startedAt: null,
      submittedAt: null,
      verifiedAt: null,
      verifiedBy: null,
      checklist: [],
      notes: '',
      lessonProgress: [],
      submittedCode: '',
      lastScore: null,
      lastStatus: null,
      bestScore: 0,
      mentorFlag: false,
      reviews: [],
      theoryAnswers: {}
    };
  }

  // overallRating/grade come from js/driver-rating.js (level runs against par).
  // smoothness … recovery are style diagnostics sampled at speed; null = not enough
  // time at speed to score them. levelScore = mean best path accuracy of rated levels.
  function createEmptyStats() {
    return {
      overallRating: 0,
      grade: 'F',
      smoothness: null,
      stability: null,
      strafe: null,
      turn: null,
      levelScore: 0,
      recovery: null,
      turnOvershootDeg: null,
      atSpeedFraction: 0,
      ratedLevels: 0,
      totalPracticeMs: 0,
      levelsCompleted: 0,
      totalDistanceFt: 0,
      lastUpdated: null
    };
  }

  function createEmptyState() {
    var now = Date.now();
    return {
      schemaVersion: SCHEMA_VERSION,
      meta: {
        app: 'r-tracker',
        appVersion: APP_VERSION,
        createdAt: now,
        updatedAt: now,
        lastExportedAt: null,
        dirtySinceExport: false,
        firstRunDismissed: false
      },
      profile: { displayName: '' },
      driver: {
        levels: {},          // "<levelId>": { bestStars, rating, bestTime, bestAccuracy, attempts, completions, firstCompletedAt, lastPlayed }
        stats: createEmptyStats(),
        coachReports: [],    // newest last
        sessions: [],        // newest last
        runs: []             // newest last (v2): { levelId, sessionId, completed, timeMs, pathAccuracy, collisions, atSpeedFraction, styleMetrics, physics, rated, timestamp }
      },
      curriculum: {
        // Sparse: a phase entry is created lazily with createEmptyPhase() the first time it is touched.
        phases: { phase0: createEmptyPhase('phase0') },
        attempts: []         // { ts, phaseId, sectionId, kind, graded, correct, score, attempt }
      },
      paths: [],             // { id, name, waypoints, segments, pathSettings, createdAt, updatedAt }
      strategies: [],        // { id, name, annotations, notes, createdAt, updatedAt }
      bkt: { paramsVersion: null, mastery: {}, updatedAt: null },
      grading: { rubricVersion: null, codeCheckVersion: null }
    };
  }

  // ── Defaults / migration ──────────────────────────────────────────────────
  // Shallow-merge each known object level so an older export missing a key still loads.
  function fillDefaults(state) {
    var empty = createEmptyState();
    var out = state;
    Object.keys(empty).forEach(function (k) {
      if (out[k] === undefined) out[k] = empty[k];
    });
    ['meta', 'profile', 'driver', 'curriculum', 'bkt', 'grading'].forEach(function (k) {
      if (!isPlainObject(out[k])) out[k] = empty[k];
      Object.keys(empty[k]).forEach(function (sub) {
        if (out[k][sub] === undefined) out[k][sub] = empty[k][sub];
      });
    });
    if (!isPlainObject(out.driver.levels)) out.driver.levels = {};
    if (!isPlainObject(out.driver.stats)) out.driver.stats = createEmptyStats();
    Object.keys(empty.driver.stats).forEach(function (f) {
      if (out.driver.stats[f] === undefined) out.driver.stats[f] = empty.driver.stats[f];
    });
    if (!Array.isArray(out.driver.coachReports)) out.driver.coachReports = [];
    if (!Array.isArray(out.driver.sessions)) out.driver.sessions = [];
    if (!Array.isArray(out.driver.runs)) out.driver.runs = [];
    if (!isPlainObject(out.curriculum.phases)) out.curriculum.phases = {};
    if (!out.curriculum.phases.phase0) out.curriculum.phases.phase0 = createEmptyPhase('phase0');
    if (!Array.isArray(out.curriculum.attempts)) out.curriculum.attempts = [];
    if (!Array.isArray(out.paths)) out.paths = [];
    if (!Array.isArray(out.strategies)) out.strategies = [];
    out.meta.app = 'r-tracker';
    return out;
  }

  // MIGRATIONS[n] upgrades a state from version n-1 to n.
  var MIGRATIONS = {
    // v2: the driver rating moved from a style average to per-run level records.
    // Adds driver.runs (empty: v1 kept no per-run history) and the new stats fields.
    // Nothing is removed — v1 aggregates (driver.levels, driver.stats, coachReports,
    // sessions) stay as they were. The old style numbers were sampled at any speed,
    // so they are cleared to null (not enough at-speed data) rather than trusted.
    2: function (s) {
      if (!isPlainObject(s.driver)) s.driver = {};
      if (!Array.isArray(s.driver.runs)) s.driver.runs = [];
      if (isPlainObject(s.driver.stats)) {
        var st = s.driver.stats;
        ['smoothness', 'stability', 'strafe', 'turn', 'recovery'].forEach(function (k) { st[k] = null; });
        st.turnOvershootDeg = null;
        st.atSpeedFraction = 0;
        st.ratedLevels = 0;
        // No runs to rate yet: a v1 rating was a style average and no longer means anything.
        st.overallRating = 0;
        st.grade = 'F';
      }
      return s;
    }
  };

  function migrate(state) {
    if (!isPlainObject(state)) throw new Error('State is not an object');
    var v = isInt(state.schemaVersion) ? state.schemaVersion : 1;
    if (v > SCHEMA_VERSION) {
      throw new Error('This file was made by a newer version of R-Tracker (schema ' + v + '). Update the app to open it.');
    }
    while (v < SCHEMA_VERSION) {
      var step = MIGRATIONS[v + 1];
      if (typeof step !== 'function') throw new Error('Missing migration to schema ' + (v + 1));
      state = step(state);
      v++;
      state.schemaVersion = v;
    }
    state.schemaVersion = SCHEMA_VERSION;
    return fillDefaults(state);
  }

  // ── Import validation ─────────────────────────────────────────────────────
  // Returns { ok, errors[], warnings[] }. Does NOT sanitize strings: every render
  // path escapes user strings, and imported JSON is treated as untrusted there.
  function validateImport(obj, serializedLength) {
    var errors = [];
    var warnings = [];
    function err(m) { errors.push(m); }

    if (typeof serializedLength === 'number' && serializedLength > LIMITS.importMaxBytes) {
      err('File is too large (' + Math.round(serializedLength / 1024) + ' KB; limit ' + Math.round(LIMITS.importMaxBytes / 1024) + ' KB).');
    }
    if (!isPlainObject(obj)) { err('Not a progress file (expected a JSON object).'); return { ok: false, errors: errors, warnings: warnings }; }
    if (!isPlainObject(obj.meta) || obj.meta.app !== 'r-tracker') err('Not an R-Tracker progress file (missing meta.app).');
    if (!isInt(obj.schemaVersion) || obj.schemaVersion < 1) err('Missing or invalid schemaVersion.');
    else if (obj.schemaVersion > SCHEMA_VERSION) err('File was made by a newer version of R-Tracker (schema ' + obj.schemaVersion + ').');

    var known = ['schemaVersion', 'meta', 'profile', 'driver', 'curriculum', 'paths', 'strategies', 'bkt', 'grading'];
    Object.keys(obj).forEach(function (k) {
      if (known.indexOf(k) === -1) { warnings.push('Unknown top-level key "' + k + '" ignored.'); delete obj[k]; }
    });

    if (obj.profile !== undefined) {
      if (!isPlainObject(obj.profile)) err('profile must be an object.');
      else if (obj.profile.displayName !== undefined && (typeof obj.profile.displayName !== 'string' || obj.profile.displayName.length > LIMITS.nameMaxLen)) err('profile.displayName is invalid.');
    }

    if (obj.driver !== undefined) {
      if (!isPlainObject(obj.driver)) err('driver must be an object.');
      else {
        if (obj.driver.levels !== undefined) {
          if (!isPlainObject(obj.driver.levels)) err('driver.levels must be an object.');
          else Object.keys(obj.driver.levels).forEach(function (id) {
            var n = parseInt(id, 10);
            var lv = obj.driver.levels[id];
            if (!(n >= 1 && n <= LIMITS.levelCount) || String(n) !== id) { err('driver.levels has an invalid level id "' + id + '".'); return; }
            if (!isPlainObject(lv)) { err('driver.levels.' + id + ' must be an object.'); return; }
            if (lv.bestStars !== undefined && !isStars(lv.bestStars)) err('driver.levels.' + id + '.bestStars out of range.');
            if (lv.bestAccuracy !== undefined && !isScore(lv.bestAccuracy)) err('driver.levels.' + id + '.bestAccuracy out of range.');
            if (lv.bestTime !== undefined && !(typeof lv.bestTime === 'number' && lv.bestTime >= 0)) err('driver.levels.' + id + '.bestTime invalid.');
            if (lv.attempts !== undefined && !(isInt(lv.attempts) && lv.attempts >= 0)) err('driver.levels.' + id + '.attempts invalid.');
          });
        }
        if (obj.driver.stats !== undefined) {
          if (!isPlainObject(obj.driver.stats)) err('driver.stats must be an object.');
          else {
            ['overallRating', 'levelScore'].forEach(function (f) {
              if (obj.driver.stats[f] !== undefined && !isScore(obj.driver.stats[f])) err('driver.stats.' + f + ' out of range.');
            });
            ['smoothness', 'stability', 'strafe', 'turn', 'recovery'].forEach(function (f) {
              if (obj.driver.stats[f] !== undefined && !isScoreOrNull(obj.driver.stats[f])) err('driver.stats.' + f + ' out of range.');
            });
            var st = obj.driver.stats;
            if (st.turnOvershootDeg !== undefined && st.turnOvershootDeg !== null && !(typeof st.turnOvershootDeg === 'number' && st.turnOvershootDeg >= 0)) err('driver.stats.turnOvershootDeg invalid.');
            if (st.atSpeedFraction !== undefined && !isFraction(st.atSpeedFraction)) err('driver.stats.atSpeedFraction out of range.');
          }
        }
        if (obj.driver.runs !== undefined) {
          if (!Array.isArray(obj.driver.runs)) err('driver.runs must be an array.');
          else {
            if (obj.driver.runs.length > LIMITS.runs) { warnings.push('runs trimmed to ' + LIMITS.runs); obj.driver.runs = obj.driver.runs.slice(-LIMITS.runs); }
            for (var ri = 0; ri < obj.driver.runs.length; ri++) {
              var run = obj.driver.runs[ri];
              if (!isPlainObject(run)) { err('driver.runs[' + ri + '] is invalid.'); break; }
              if (!(isInt(run.levelId) && run.levelId >= 1 && run.levelId <= LIMITS.levelCount)) { err('driver.runs[' + ri + '].levelId invalid.'); break; }
              if (typeof run.completed !== 'boolean') { err('driver.runs[' + ri + '].completed must be a boolean.'); break; }
              if (!(typeof run.timeMs === 'number' && run.timeMs >= 0)) { err('driver.runs[' + ri + '].timeMs invalid.'); break; }
              if (run.pathAccuracy !== undefined && !isScore(run.pathAccuracy)) { err('driver.runs[' + ri + '].pathAccuracy out of range.'); break; }
              if (run.collisions !== undefined && !(isInt(run.collisions) && run.collisions >= 0)) { err('driver.runs[' + ri + '].collisions invalid.'); break; }
              if (run.atSpeedFraction !== undefined && !isFraction(run.atSpeedFraction)) { err('driver.runs[' + ri + '].atSpeedFraction out of range.'); break; }
              if (run.styleMetrics !== undefined && run.styleMetrics !== null && !isPlainObject(run.styleMetrics)) { err('driver.runs[' + ri + '].styleMetrics invalid.'); break; }
              if (run.sessionId !== undefined && (typeof run.sessionId !== 'string' || run.sessionId.length > 40)) { err('driver.runs[' + ri + '].sessionId invalid.'); break; }
            }
          }
        }
        if (obj.driver.coachReports !== undefined && !Array.isArray(obj.driver.coachReports)) err('driver.coachReports must be an array.');
        if (Array.isArray(obj.driver.coachReports) && obj.driver.coachReports.length > LIMITS.coachReports) { warnings.push('coachReports trimmed to ' + LIMITS.coachReports); obj.driver.coachReports = obj.driver.coachReports.slice(-LIMITS.coachReports); }
        if (obj.driver.sessions !== undefined && !Array.isArray(obj.driver.sessions)) err('driver.sessions must be an array.');
        if (Array.isArray(obj.driver.sessions) && obj.driver.sessions.length > LIMITS.sessions) { warnings.push('sessions trimmed to ' + LIMITS.sessions); obj.driver.sessions = obj.driver.sessions.slice(-LIMITS.sessions); }
      }
    }

    if (obj.curriculum !== undefined) {
      if (!isPlainObject(obj.curriculum)) err('curriculum must be an object.');
      else {
        if (obj.curriculum.phases !== undefined) {
          if (!isPlainObject(obj.curriculum.phases)) err('curriculum.phases must be an object.');
          else Object.keys(obj.curriculum.phases).forEach(function (pid) {
            var ph = obj.curriculum.phases[pid];
            if (PHASE_IDS.indexOf(pid) === -1) { warnings.push('Unknown phase "' + pid + '" ignored.'); delete obj.curriculum.phases[pid]; return; }
            if (!isPlainObject(ph)) { err('curriculum.phases.' + pid + ' must be an object.'); return; }
            if (ph.status !== undefined && VALID_STATUSES.indexOf(ph.status) === -1) err('curriculum.phases.' + pid + '.status is invalid.');
            if (ph.submittedCode !== undefined && (typeof ph.submittedCode !== 'string' || ph.submittedCode.length > LIMITS.codeMaxLen)) err('curriculum.phases.' + pid + '.submittedCode is invalid.');
            if (ph.notes !== undefined && (typeof ph.notes !== 'string' || ph.notes.length > LIMITS.notesMaxLen)) err('curriculum.phases.' + pid + '.notes is invalid.');
            if (ph.bestScore !== undefined && !isScore(ph.bestScore)) err('curriculum.phases.' + pid + '.bestScore out of range.');
            if (ph.score !== undefined && !isScore(ph.score)) err('curriculum.phases.' + pid + '.score out of range.');
            if (ph.lessonProgress !== undefined && !Array.isArray(ph.lessonProgress)) err('curriculum.phases.' + pid + '.lessonProgress must be an array.');
            if (ph.checklist !== undefined && !Array.isArray(ph.checklist)) err('curriculum.phases.' + pid + '.checklist must be an array.');
            if (ph.reviews !== undefined) {
              if (!Array.isArray(ph.reviews)) err('curriculum.phases.' + pid + '.reviews must be an array.');
              else if (ph.reviews.length > LIMITS.reviewsPerPhase) { warnings.push(pid + ' reviews trimmed'); ph.reviews = ph.reviews.slice(-LIMITS.reviewsPerPhase); }
            }
            if (ph.theoryAnswers !== undefined) {
              if (!isPlainObject(ph.theoryAnswers)) err('curriculum.phases.' + pid + '.theoryAnswers must be an object.');
              else Object.keys(ph.theoryAnswers).forEach(function (sid) {
                var ta = ph.theoryAnswers[sid];
                if (!isPlainObject(ta)) { err('theoryAnswers.' + sid + ' must be an object.'); return; }
                if (ta.answer !== undefined && (typeof ta.answer !== 'string' || ta.answer.length > LIMITS.theoryMaxLen)) err('theoryAnswers.' + sid + '.answer is invalid.');
                if (ta.status !== undefined && RESULT_STATUSES.indexOf(ta.status) === -1) err('theoryAnswers.' + sid + '.status is invalid.');
                if (ta.score !== undefined && ta.score !== null && !isScore(ta.score)) err('theoryAnswers.' + sid + '.score out of range.');
                if (Array.isArray(ta.history) && ta.history.length > LIMITS.theoryHistoryPerSection) ta.history = ta.history.slice(-LIMITS.theoryHistoryPerSection);
              });
            }
          });
        }
        if (obj.curriculum.attempts !== undefined) {
          if (!Array.isArray(obj.curriculum.attempts)) err('curriculum.attempts must be an array.');
          else {
            if (obj.curriculum.attempts.length > LIMITS.attempts) { warnings.push('attempts trimmed to ' + LIMITS.attempts); obj.curriculum.attempts = obj.curriculum.attempts.slice(-LIMITS.attempts); }
            for (var i = 0; i < obj.curriculum.attempts.length; i++) {
              var a = obj.curriculum.attempts[i];
              if (!isPlainObject(a) || typeof a.kind !== 'string') { err('curriculum.attempts[' + i + '] is invalid.'); break; }
            }
          }
        }
      }
    }

    ['paths', 'strategies'].forEach(function (k) {
      if (obj[k] === undefined) return;
      if (!Array.isArray(obj[k])) { err(k + ' must be an array.'); return; }
      var cap = k === 'paths' ? LIMITS.pathsMax : LIMITS.strategiesMax;
      if (obj[k].length > cap) { warnings.push(k + ' trimmed to ' + cap); obj[k] = obj[k].slice(-cap); }
      for (var j = 0; j < obj[k].length; j++) {
        var it = obj[k][j];
        if (!isPlainObject(it) || typeof it.name !== 'string' || it.name.length > LIMITS.nameMaxLen) { err(k + '[' + j + '] is invalid.'); break; }
      }
    });

    if (obj.bkt !== undefined && !isPlainObject(obj.bkt)) err('bkt must be an object.');
    if (obj.grading !== undefined && !isPlainObject(obj.grading)) err('grading must be an object.');

    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  window.RTSchema = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    APP_VERSION: APP_VERSION,
    PHASE_IDS: PHASE_IDS,
    VALID_STATUSES: VALID_STATUSES,
    RESULT_STATUSES: RESULT_STATUSES,
    ATTEMPT_KINDS: ATTEMPT_KINDS,
    LIMITS: LIMITS,
    isScore: isScore,
    isStars: isStars,
    createEmptyState: createEmptyState,
    createEmptyPhase: createEmptyPhase,
    createEmptyStats: createEmptyStats,
    migrate: migrate,
    validateImport: validateImport
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = window.RTSchema;
})();
