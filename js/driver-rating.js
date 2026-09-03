// ── R-Tracker TeleOp — driver rating (outcome-based) ─────────────────────────
// Pure functions: run records in, numbers out. No DOM, no storage, no timers.
// The rating measures what the driver achieved on level runs — time against par,
// path accuracy, wall hits — not how gently the sticks were moved. Style metrics
// (js/teleop/metrics.js) are diagnostics and never enter these formulas.
//
// A run record (stored in driver.runs by js/teleop/persist.js):
//   { levelId, sessionId, completed, timeMs, pathAccuracy (0–100), collisions,
//     atSpeedFraction, styleMetrics, physics, rated, timestamp }
//
// Run score (0–100):
//   parRatio = parTimeMs / timeMs, capped at 1.5
//   time     = 20 at 0.5×par, 70 at par, 100 at 1.5×par (linear between; below
//              0.5×par the line continues down and floors at 0)
//   score    = time × (pathAccuracy/100)^0.5 − 5 × collisions, floored at 0
//   an uncompleted run scores 0
//
// Overall rating: over the last N sessions (default 5), each level's score is the
// mean of its best 3 run scores (failed runs count as 0). Levels with no completed
// run in the window are skipped. Rating = difficulty-weighted mean of the level
// scores, rounded. Runs flagged rated:false (custom physics) are ignored.
//
// Exposes: window.RTDriverRating

(function () {
  'use strict';

  var DEFAULTS = {
    sessionsWindow: 5,
    bestRuns: 3,
    collisionPenalty: 5,
    accuracyExponent: 0.5,
    parRatioCap: 1.5
  };

  var GRADE_BANDS = [[95, 'S'], [85, 'A'], [75, 'B'], [65, 'C'], [50, 'D']];

  function gradeFromRating(r) {
    r = Number(r) || 0;
    for (var i = 0; i < GRADE_BANDS.length; i++) if (r >= GRADE_BANDS[i][0]) return GRADE_BANDS[i][1];
    return 'F';
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function parRatio(parTimeMs, timeMs, opts) {
    var cap = (opts && opts.parRatioCap) || DEFAULTS.parRatioCap;
    if (!(timeMs > 0) || !(parTimeMs > 0)) return 0;
    return Math.min(cap, parTimeMs / timeMs);
  }

  // 0.5 → 20, 1.0 → 70, 1.5 → 100. Piecewise linear; ≤ 0.3 → 0.
  function timeScore(ratio) {
    if (!(ratio > 0)) return 0;
    if (ratio >= 1) return clamp(70 + (ratio - 1) * 60, 0, 100);
    return clamp(20 + (ratio - 0.5) * 100, 0, 100);
  }

  function runScore(run, parTimeMs, opts) {
    if (!run || run.completed !== true) return 0;
    var o = opts || {};
    var ratio = parRatio(parTimeMs, run.timeMs, o);
    var acc = clamp((Number(run.pathAccuracy) || 0) / 100, 0, 1);
    var exp = typeof o.accuracyExponent === 'number' ? o.accuracyExponent : DEFAULTS.accuracyExponent;
    var pen = typeof o.collisionPenalty === 'number' ? o.collisionPenalty : DEFAULTS.collisionPenalty;
    var s = timeScore(ratio) * Math.pow(acc, exp) - pen * Math.max(0, Number(run.collisions) || 0);
    return clamp(s, 0, 100);
  }

  function isRated(run) { return !!run && run.rated !== false; }

  // The runs that belong to the N most recent distinct sessions (by latest timestamp).
  function windowRuns(runs, sessionsWindow) {
    var n = sessionsWindow > 0 ? sessionsWindow : DEFAULTS.sessionsWindow;
    var latest = {};
    (runs || []).forEach(function (r, i) {
      if (!r) return;
      var sid = r.sessionId || ('run-' + i);
      var ts = Number(r.timestamp) || i;
      if (!(sid in latest) || ts > latest[sid]) latest[sid] = ts;
    });
    var ids = Object.keys(latest).sort(function (a, b) { return latest[b] - latest[a]; }).slice(0, n);
    var keep = {};
    ids.forEach(function (id) { keep[id] = true; });
    var out = [];
    (runs || []).forEach(function (r, i) {
      if (r && keep[r.sessionId || ('run-' + i)]) out.push(r);
    });
    return { runs: out, sessionIds: ids };
  }

  // Full rating. `table` is window.RT_LEVEL_TABLE (or anything with get(id)).
  function rate(runs, table, opts) {
    var o = Object.assign({}, DEFAULTS, opts || {});
    var win = windowRuns(runs, o.sessionsWindow);
    var perLevel = {};
    var unrated = 0;

    win.runs.forEach(function (r) {
      var def = table && table.get ? table.get(r.levelId) : null;
      if (!def) return;
      if (!isRated(r)) { unrated++; return; }
      var lv = perLevel[def.id];
      if (!lv) {
        lv = perLevel[def.id] = {
          levelId: def.id, name: def.name, tier: def.tier, focus: def.focus,
          weight: def.difficultyWeight, parTimeMs: def.parTimeMs,
          scores: [], attempts: 0, completions: 0, collisions: 0,
          bestScore: 0, bestTimeMs: null, bestAccuracy: 0, levelScore: 0, counted: false
        };
      }
      var s = runScore(r, def.parTimeMs, o);
      lv.scores.push(s);
      lv.attempts++;
      if (r.completed === true) {
        lv.completions++;
        lv.collisions += Math.max(0, Number(r.collisions) || 0);
        if (r.timeMs > 0 && (lv.bestTimeMs === null || r.timeMs < lv.bestTimeMs)) lv.bestTimeMs = r.timeMs;
        if ((Number(r.pathAccuracy) || 0) > lv.bestAccuracy) lv.bestAccuracy = Number(r.pathAccuracy) || 0;
      }
      if (s > lv.bestScore) lv.bestScore = s;
    });

    var wSum = 0, sSum = 0, accSum = 0, ratedLevels = 0;
    Object.keys(perLevel).forEach(function (id) {
      var lv = perLevel[id];
      lv.scores.sort(function (a, b) { return b - a; });
      var best = lv.scores.slice(0, o.bestRuns);
      lv.levelScore = best.length ? best.reduce(function (a, b) { return a + b; }, 0) / best.length : 0;
      lv.parRatio = lv.bestTimeMs ? parRatio(lv.parTimeMs, lv.bestTimeMs, o) : 0;
      lv.counted = lv.completions > 0;
      if (!lv.counted) return;
      ratedLevels++;
      wSum += lv.weight;
      sSum += lv.weight * lv.levelScore;
      accSum += lv.bestAccuracy;
    });

    var rating = wSum > 0 ? Math.round(sSum / wSum) : 0;
    return {
      rating: rating,
      grade: gradeFromRating(rating),
      ratedLevels: ratedLevels,
      accuracyMean: ratedLevels ? Math.round(accSum / ratedLevels) : 0,
      levels: perLevel,
      sessionsInWindow: win.sessionIds.length,
      sessionsWindow: o.sessionsWindow,
      runsInWindow: win.runs.length,
      unratedRuns: unrated
    };
  }

  // Levels grouped by focus, weakest group first. Only counted levels take part.
  function groupsByFocus(result, table) {
    var groups = {};
    Object.keys(result.levels || {}).forEach(function (id) {
      var lv = result.levels[id];
      if (!lv.counted) return;
      var g = groups[lv.focus];
      if (!g) g = groups[lv.focus] = { focus: lv.focus, label: (table && table.FOCUS_LABELS && table.FOCUS_LABELS[lv.focus]) || lv.focus, levelIds: [], scoreSum: 0, ratioSum: 0 };
      g.levelIds.push(lv.levelId);
      g.scoreSum += lv.levelScore;
      g.ratioSum += lv.parRatio;
    });
    var list = Object.keys(groups).map(function (k) {
      var g = groups[k];
      g.levelIds.sort(function (a, b) { return a - b; });
      g.meanScore = g.scoreSum / g.levelIds.length;
      g.meanParRatio = g.ratioSum / g.levelIds.length;
      return g;
    });
    list.sort(function (a, b) { return a.meanScore - b.meanScore; });
    return list;
  }

  window.RTDriverRating = {
    DEFAULTS: DEFAULTS,
    GRADE_BANDS: GRADE_BANDS,
    gradeFromRating: gradeFromRating,
    parRatio: parRatio,
    timeScore: timeScore,
    runScore: runScore,
    windowRuns: windowRuns,
    rate: rate,
    groupsByFocus: groupsByFocus
  };
})();
