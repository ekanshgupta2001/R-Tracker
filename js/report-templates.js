// ── R-Tracker v2 — report text templates (rule-based, no free prose) ─────────
// Every function is pure: state → plain strings. The charts carry the weight;
// these sentences stay short and conditional.
//
// Exposes: window.RTReportText

(function () {
  'use strict';

  var DAY = 86400000;
  var SKILL_LABELS = { smoothness: 'Smoothness', stability: 'Stability', strafe: 'Strafe', turn: 'Turn control', levelScore: 'Path accuracy', recovery: 'Recovery' };
  var SKILL_KEYS = ['smoothness', 'stability', 'strafe', 'turn', 'levelScore', 'recovery'];

  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function startOfDay(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function plural(n, s, p) { return n + ' ' + (n === 1 ? s : (p || s + 's')); }

  // ── Driver ────────────────────────────────────────────────────────────────
  function driverSummary(stats, lastReport, prevReport) {
    if (!stats || !stats.lastUpdated) return { headline: 'No driving data yet.', detail: 'Complete a level or a free-drive session in TeleOp Practice and open the driver report there.' };
    var best = null, worst = null;
    SKILL_KEYS.forEach(function (k) {
      var v = Number(stats[k]) || 0;
      if (!best || v > best.v) best = { k: k, v: v };
      if (!worst || v < worst.v) worst = { k: k, v: v };
    });
    var headline = 'Overall driver rating ' + (stats.overallRating || 0) + ' (' + (stats.grade || 'F') + ').';
    var parts = [];
    if (best && worst && best.k !== worst.k) parts.push('Strongest skill: ' + SKILL_LABELS[best.k] + ' (' + best.v + '). Weakest: ' + SKILL_LABELS[worst.k] + ' (' + worst.v + ').');
    if (lastReport && prevReport && typeof lastReport.overallScore === 'number' && typeof prevReport.overallScore === 'number') {
      var d = lastReport.overallScore - prevReport.overallScore;
      if (d > 0) parts.push('Up ' + d + ' since your previous report.');
      else if (d < 0) parts.push('Down ' + Math.abs(d) + ' since your previous report.');
      else parts.push('Unchanged since your previous report.');
    }
    return { headline: headline, detail: parts.join(' ') };
  }

  // ── Practice consistency ──────────────────────────────────────────────────
  function consistency(sessions, now) {
    now = now || Date.now();
    var list = (sessions || []).filter(function (s) { return s && s.startedAt; });
    if (!list.length) return { headline: 'No practice sessions recorded yet.', detail: 'Sessions of 30 seconds or longer in TeleOp Practice are counted.', currentStreak: 0, longestStreak: 0, days7: 0, days28: 0, sessions28: 0 };

    var days = {};
    list.forEach(function (s) { days[dayKey(s.startedAt)] = true; });
    var today = startOfDay(now);
    var days7 = 0, days28 = 0, sessions28 = 0;
    for (var i = 0; i < 28; i++) {
      var k = dayKey(today - i * DAY);
      if (days[k]) { days28++; if (i < 7) days7++; }
    }
    list.forEach(function (s) { if (now - s.startedAt <= 28 * DAY) sessions28++; });

    // current streak: consecutive days ending today or yesterday
    var streak = 0, cursor = today;
    if (!days[dayKey(cursor)]) cursor -= DAY;
    while (days[dayKey(cursor)]) { streak++; cursor -= DAY; }
    // longest streak overall
    var sortedDays = Object.keys(days).map(function (k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); }).sort(function (a, b) { return a - b; });
    var longest = 0, cur = 0, prev = null;
    sortedDays.forEach(function (d) { cur = (prev !== null && d - prev === DAY) ? cur + 1 : 1; if (cur > longest) longest = cur; prev = d; });

    var last = list.reduce(function (m, s) { return s.startedAt > m ? s.startedAt : m; }, 0);
    var sinceDays = Math.floor((now - last) / DAY);
    var headline = 'Practiced on ' + plural(days28, 'day') + ' of the last 28.';
    var detail = plural(sessions28, 'session') + ' in the last 4 weeks; ' + plural(days7, 'day') + ' in the last 7.';
    if (sinceDays >= 14) detail += ' Last session was ' + sinceDays + ' days ago.';
    return { headline: headline, detail: detail, currentStreak: streak, longestStreak: longest, days7: days7, days28: days28, sessions28: sessions28, sinceDays: sinceDays };
  }

  // ── Curriculum ────────────────────────────────────────────────────────────
  function curriculum(phases, meta) {
    var verified = 0, submitted = 0, inProgress = null;
    (meta || []).forEach(function (ph) {
      var d = phases[ph.id];
      if (!d) return;
      if (d.status === 'verified') verified++;
      else if (d.status === 'submitted') submitted++;
      else if (d.status === 'in_progress' && !inProgress) inProgress = ph;
    });
    var total = (meta || []).length;
    if (!verified && !submitted && !inProgress) return { headline: 'Curriculum not started.', detail: 'Begin with the Phase 0 Java readiness quiz.' };
    var headline = plural(verified, 'phase') + ' completed' + (submitted ? ', ' + submitted + ' submitted for mentor review' : '') + ' of ' + total + '.';
    var detail = inProgress ? 'Currently working on Phase ' + inProgress.num + ': ' + inProgress.name + '.' : '';
    return { headline: headline, detail: detail };
  }

  // ── Mastery ───────────────────────────────────────────────────────────────
  function mastery(bkt, meta) {
    var observed = [];
    var unobserved = 0;
    Object.keys(bkt.phases || {}).forEach(function (pid) {
      var ph = bkt.phases[pid];
      ph.order.forEach(function (mid) {
        var m = ph.modules[mid];
        if (m.observed) observed.push({ pid: pid, mid: mid, title: m.title, pL: m.pL }); else unobserved++;
      });
    });
    if (!observed.length) return { headline: 'No graded checks yet.', detail: 'Mastery estimates appear once you answer lesson checks and quizzes.' };
    observed.sort(function (a, b) { return b.pL - a.pL; });
    var top = observed[0], low = observed[observed.length - 1];
    var headline = 'Strongest module: ' + top.title + ' (' + pct(top.pL) + ').';
    var detail = observed.length > 1 ? 'Needs work: ' + low.title + ' (' + pct(low.pL) + '). ' : '';
    detail += plural(observed.length, 'module') + ' attempted, ' + unobserved + ' not yet.';
    return { headline: headline, detail: detail };
  }

  function pct(p) { return Math.round(p * 100) + '%'; }

  // ── Next step ─────────────────────────────────────────────────────────────
  // The lowest-mastery phase that is reachable (unlocked) and not completed; within it,
  // the lowest-mastery module that has been attempted, else the first unattempted one.
  function nextStep(state, bkt, meta, isUnlocked) {
    var phases = state.curriculum.phases || {};
    var candidates = [];
    (meta || []).forEach(function (ph) {
      var d = phases[ph.id];
      var status = d && d.status ? d.status : (isUnlocked(ph.id) ? 'not_started' : 'locked');
      if (status === 'locked' || status === 'verified') return;
      if (!isUnlocked(ph.id)) return;
      var b = bkt.phases[ph.id];
      candidates.push({ ph: ph, status: status, mastery: b ? b.mastery : 0, b: b });
    });
    if (!candidates.length) {
      if (!state.driver.stats || !state.driver.stats.lastUpdated) return { title: 'Start with TeleOp Practice', text: 'Drive Level 1 to get your first driver rating.', href: 'teleop.html' };
      return { title: 'Everything reachable is complete', text: 'Keep practising in TeleOp to raise your driver rating.', href: 'teleop.html' };
    }
    candidates.sort(function (a, b) { return a.mastery - b.mastery; });
    var c = candidates[0];
    var moduleHint = '';
    if (c.b) {
      var attempted = c.b.order.filter(function (mid) { return c.b.modules[mid].observed; }).sort(function (x, y) { return c.b.modules[x].pL - c.b.modules[y].pL; });
      var fresh = c.b.order.filter(function (mid) { return !c.b.modules[mid].observed; });
      if (attempted.length && c.b.modules[attempted[0]].pL < 0.7) moduleHint = 'Revisit "' + c.b.modules[attempted[0]].title + '" (' + pct(c.b.modules[attempted[0]].pL) + ' mastery).';
      else if (fresh.length) moduleHint = 'Next section: "' + c.b.modules[fresh[0]].title + '".';
    }
    var verb = c.status === 'not_started' ? 'Start' : 'Continue';
    return { title: verb + ' Phase ' + c.ph.num + ': ' + c.ph.name, text: moduleHint || 'Work through the lesson checks in order.', href: 'curriculum.html' };
  }

  // ── Callouts (short chips) ────────────────────────────────────────────────
  function callouts(state, cons, bkt) {
    var out = [];
    if (cons.currentStreak >= 3) out.push({ icon: '🔥', text: cons.currentStreak + '-day practice streak' });
    if (cons.longestStreak >= 5 && cons.longestStreak > cons.currentStreak) out.push({ icon: '🏁', text: 'Longest streak: ' + cons.longestStreak + ' days' });
    if (cons.sinceDays >= 14) out.push({ icon: '⏳', text: cons.sinceDays + ' days since your last session' });
    var gold = Object.keys(state.driver.levels || {}).filter(function (id) { return state.driver.levels[id] && state.driver.levels[id].bestStars === 3; }).length;
    if (gold) out.push({ icon: '🥇', text: gold + ' gold level' + (gold === 1 ? '' : 's') });
    var mastered = 0;
    Object.keys(bkt.phases || {}).forEach(function (pid) { bkt.phases[pid].order.forEach(function (mid) { var m = bkt.phases[pid].modules[mid]; if (m.observed && m.pL >= 0.9) mastered++; }); });
    if (mastered) out.push({ icon: '🎓', text: mastered + ' module' + (mastered === 1 ? '' : 's') + ' mastered (≥ 90%)' });
    return out;
  }

  window.RTReportText = { driverSummary: driverSummary, consistency: consistency, curriculum: curriculum, mastery: mastery, nextStep: nextStep, callouts: callouts, SKILL_LABELS: SKILL_LABELS, SKILL_KEYS: SKILL_KEYS };
})();
