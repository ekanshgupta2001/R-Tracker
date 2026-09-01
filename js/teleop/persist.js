// ── R-Tracker TeleOp — local persistence (replaces the v1 Firestore helpers) ──
// Everything here reads/writes RTStore only. Nothing leaves the browser.
// Globals used from other teleop modules: completedLevels, driverMetrics,
// computeScores(), computeOverallRating(), gradeFromRating(), renderLevelsSidebar().

var _rtSessionId = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
var _rtSessionStartTs = Date.now();
var _rtLastFlushTs = Date.now();
var _rtSessionLevelsAttempted = 0;
var _rtSessionLevelsCompleted = 0;

// Rebuild the in-memory completedLevels map from stored best results.
function hydrateCompletedLevels() {
  var levels = RTStore.get().driver.levels || {};
  Object.keys(levels).forEach(function (id) {
    var d = levels[id];
    var n = parseInt(id, 10);
    if (isNaN(n) || !d || !d.bestStars) return;
    var s = d.bestStars;
    completedLevels[n] = {
      stars: [s >= 1, s >= 2, s >= 3],
      time: d.bestTime || 0,
      accuracy: (d.bestAccuracy || 0) / 100
    };
  });
  renderLevelsSidebar();
}

// Record one finished level run. r = { success, stars, time, accuracy }.
function recordLevelAttempt(levelId, r) {
  _rtSessionLevelsAttempted++;
  if (r && r.success) _rtSessionLevelsCompleted++;
  RTStore.update(function (s) {
    var key = String(levelId);
    var lv = s.driver.levels[key] || {
      bestStars: 0, rating: null, bestTime: 0, bestAccuracy: 0,
      attempts: 0, completions: 0, firstCompletedAt: null, lastPlayed: null
    };
    var now = Date.now();
    lv.attempts += 1;
    lv.lastPlayed = now;
    if (r && r.success) {
      lv.completions += 1;
      if (!lv.firstCompletedAt) lv.firstCompletedAt = now;
      var stars = r.stars || 1;
      var time = parseFloat((r.time || 0).toFixed(2));
      var betterStars = stars > lv.bestStars;
      var sameStarsFaster = stars === lv.bestStars && lv.bestTime > 0 && time < lv.bestTime;
      if (betterStars || sameStarsFaster) {
        lv.bestStars = stars;
        lv.rating = stars === 3 ? 'gold' : stars === 2 ? 'silver' : 'bronze';
        lv.bestTime = time;
        lv.bestAccuracy = Math.round((r.accuracy || 0) * 100);
      }
    }
    s.driver.levels[key] = lv;
  });
}

// Write the current driver scores + cumulative practice time + this session's summary.
function flushDriverStats(opts) {
  var scores = computeScores();
  var rating = computeOverallRating();
  var now = Date.now();
  var elapsed = Math.max(0, now - _rtLastFlushTs);
  _rtLastFlushTs = now;
  var levelCount = Object.keys(completedLevels).length;
  var distanceFt = Math.round(driverMetrics.totalDistance || 0);
  var sessionMs = now - _rtSessionStartTs;
  var writeScores = !(opts && opts.onlyIfActive) || (driverMetrics.totalInputs || 0) >= 10;

  RTStore.update(function (s) {
    var st = s.driver.stats;
    if (writeScores) {
      st.overallRating = rating;
      st.grade = gradeFromRating(rating);
      st.smoothness = Math.round(scores.smoothness);
      st.stability = Math.round(scores.stability);
      st.strafe = Math.round(scores.strafe);
      st.turn = Math.round(scores.turn);
      st.levelScore = Math.round(scores.levelScore);
      st.recovery = Math.round(scores.recovery);
      st.totalDistanceFt = distanceFt;
      st.lastUpdated = now;
    }
    st.totalPracticeMs = (st.totalPracticeMs || 0) + elapsed;
    st.levelsCompleted = Math.max(st.levelsCompleted || 0, levelCount);

    if (sessionMs >= 30000) {
      var sess = null;
      for (var i = s.driver.sessions.length - 1; i >= 0; i--) {
        if (s.driver.sessions[i].id === _rtSessionId) { sess = s.driver.sessions[i]; break; }
      }
      if (!sess) {
        sess = { id: _rtSessionId, startedAt: _rtSessionStartTs, endedAt: now, durationMs: 0, levelsAttempted: 0, levelsCompleted: 0, distanceFt: 0, ratingAtEnd: null };
        s.driver.sessions.push(sess);
        var cap = RTSchema.LIMITS.sessions;
        if (s.driver.sessions.length > cap) s.driver.sessions.splice(0, s.driver.sessions.length - cap);
      }
      sess.endedAt = now;
      sess.durationMs = sessionMs;
      sess.levelsAttempted = _rtSessionLevelsAttempted;
      sess.levelsCompleted = _rtSessionLevelsCompleted;
      sess.distanceFt = distanceFt;
      if (writeScores) sess.ratingAtEnd = rating;
    }
  });
}

// Coach reports (generated locally by coach.js). Newest last, capped.
function saveCoachReport(report) {
  RTStore.update(function (s) {
    var entry = Object.assign({}, report, {
      comparisonToLast: null,
      generatedAt: Date.now(),
      metricsSnapshot: {
        totalDistance: Math.round(driverMetrics.totalDistance || 0),
        totalInputs: driverMetrics.totalInputs || 0,
        levelsCompleted: driverMetrics.levelsCompleted || 0,
        sessionMs: Math.round(performance.now() - driverMetrics.sessionStart)
      }
    });
    s.driver.coachReports.push(entry);
    var cap = RTSchema.LIMITS.coachReports;
    if (s.driver.coachReports.length > cap) s.driver.coachReports.splice(0, s.driver.coachReports.length - cap);
  });
}

// The report before the most recent one (for the session comparison), or null.
function getPreviousCoachReport() {
  var reports = RTStore.get().driver.coachReports || [];
  return reports.length >= 2 ? reports[reports.length - 2] : null;
}

// Keep practice time honest even if the student never opens the report.
window.addEventListener('pagehide', function () {
  try { flushDriverStats({ onlyIfActive: true }); } catch (e) { /* never block unload */ }
});
