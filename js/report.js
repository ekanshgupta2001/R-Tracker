// ── R-Tracker v2 — progress report renderer ──────────────────────────────────
// Everything here is a pure function of RTStore state. Sections render into
// fixed containers in pages/report.html. No network, no free prose.
//
// Exposes: window.RTReport = { render, sections }

(function () {
  'use strict';

  var LEVEL_DEFS = [
    { id: '1',  name: 'Straight Shot', tier: 'Beginner' },
    { id: '2',  name: 'Side Step', tier: 'Beginner' },
    { id: '3',  name: 'L-Shape', tier: 'Beginner' },
    { id: '4',  name: 'The Square', tier: 'Intermediate' },
    { id: '5',  name: 'Zigzag', tier: 'Intermediate' },
    { id: '6',  name: 'Diamond', tier: 'Intermediate' },
    { id: '7',  name: 'Specimen Run', tier: 'Advanced' },
    { id: '8',  name: 'Sample Collect', tier: 'Advanced' },
    { id: '9',  name: 'Spiral In', tier: 'Advanced' },
    { id: '10', name: 'Speed Demon', tier: 'Expert' },
    { id: '11', name: 'Threading the Needle', tier: 'Expert' },
    { id: '12', name: 'The Gauntlet', tier: 'Expert' }
  ];
  var TIER_UNLOCK = { Beginner: 0, Intermediate: 3, Advanced: 6, Expert: 9 };
  var DAY = 86400000;

  /* ── Helpers ─────────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function $(id) { return document.getElementById(id); }
  function fmtTime(ms) {
    if (!ms || ms <= 0) return '0m';
    var m = Math.floor(ms / 60000);
    if (m < 60) return m + 'm';
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  }
  function fmtDate(ts) { return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function skillClass(v) { return v >= 70 ? 'good' : v >= 40 ? 'ok' : 'poor'; }
  function scoreColorClass(v) { return v >= 70 ? 'clr-green' : v >= 40 ? 'clr-orange' : 'clr-red'; }
  // Grade colours are the status/medal tokens from css/global.css (both themes).
  function gradeColor(g) { var map = { S: 'var(--medal-gold)', A: 'var(--good)', B: 'var(--info)', C: 'var(--warn)', D: 'var(--bad)', F: 'var(--bad)' }; return map[g] || 'var(--text-muted)'; }
  function pct(p) { return Math.round((Number(p) || 0) * 100); }
  function meta() { return window.PHASE_META || []; }

  function isUnlockedFactory(phases) {
    return function isUnlocked(phaseId) {
      var ph = meta().find(function (p) { return p.id === phaseId; });
      if (!ph || !ph.unlockReq) return true;
      var req = phases[ph.unlockReq];
      return !!req && (req.status === 'verified' || req.status === 'submitted');
    };
  }

  function bar(label, value, valueLabel, extraClass) {
    var v = Math.max(0, Math.min(100, Math.round(value)));
    return '<div class="sk-row ' + (extraClass || '') + '">' +
      '<span class="sk-label">' + esc(label) + '</span>' +
      '<div class="sk-bar-wrap"><div class="sk-bar sk-' + skillClass(v) + '" style="width:' + v + '%"></div></div>' +
      '<span class="sk-val ' + scoreColorClass(v) + '">' + esc(valueLabel !== undefined ? valueLabel : v) + '</span>' +
      '</div>';
  }

  /* ── Section 1: Overview + next step ─────────────────────────────────────── */
  function renderOverview(ctx) {
    var el = $('overview-content');
    if (!el) return;
    var stats = ctx.stats, last = ctx.lastReport, prev = ctx.prevReport;
    var text = window.RTReportText.driverSummary(stats, last, prev);
    var html = '';
    if (stats && stats.lastUpdated) {
      var g = stats.grade || 'F';
      var score = stats.overallRating || 0;
      var profileName = last && last.driverProfile ? (last.driverProfile.split(' — ')[0] || 'Driver') : 'Driver';
      html += '<div class="ov-row">';
      html += '<div class="ov-score-wrap"><span class="ov-score ' + scoreColorClass(score) + '">' + score + '</span><span class="ov-grade" style="color:' + gradeColor(g) + '">' + esc(g) + '</span></div>';
      html += '<div class="ov-info"><div class="ov-badge">' + esc(profileName).toUpperCase() + '</div>';
      if (last && last.percentile) html += '<div class="ov-percentile">' + esc(last.percentile) + '</div>';
      html += '<div class="ov-text">' + esc(text.detail) + '</div>';
      html += '</div></div>';
    } else {
      html += '<div class="rpt-empty">' + esc(text.headline) + ' <a href="teleop.html">Go to TeleOp Practice</a></div>';
    }
    var next = ctx.next;
    html += '<a class="rpt-next" href="' + esc(next.href) + '"><div class="rpt-next-label">Next step</div><div class="rpt-next-title">' + esc(next.title) + '</div><div class="rpt-next-text">' + esc(next.text) + '</div></a>';
    if (ctx.callouts.length) {
      html += '<div class="rpt-callouts">' + ctx.callouts.map(function (c) { return '<span class="rpt-callout"><span class="rpt-callout-icon">' + (window.RT_ICONS && window.RT_ICONS[c.icon] || '') + '</span>' + esc(c.text) + '</span>'; }).join('') + '</div>';
    }
    el.innerHTML = html;
  }

  /* ── Section 2: Skills (radar + bars) ────────────────────────────────────── */
  function renderSkills(ctx) {
    var el = $('skills-content');
    if (!el) return;
    var stats = ctx.stats;
    if (!stats || !stats.lastUpdated) { el.innerHTML = '<div class="rpt-empty">No skill data yet.</div>'; return; }
    var keys = window.RTReportText.SKILL_KEYS, labels = window.RTReportText.SKILL_LABELS;
    // Style diagnostics are null until a TeleOp session had ≥ 20% of its driving at speed.
    var missing = keys.filter(function (k) { return stats[k] === null || stats[k] === undefined; });
    var html = '<div class="sk-layout"><div class="sk-radar-wrap"><canvas id="skills-radar" aria-label="Skill radar chart"></canvas></div><div class="sk-list">';
    keys.forEach(function (k) {
      var v = stats[k];
      html += (v === null || v === undefined) ? bar(labels[k], 0, '—') : bar(labels[k], Number(v) || 0);
    });
    html += '</div></div>';
    if (missing.length) html += '<div class="rpt-detail">Style diagnostics are sampled at 60% of max speed or more and do not affect the rating. They appear after a session with enough driving at speed.</div>';
    el.innerHTML = html;
    var canvas = $('skills-radar');
    if (canvas && window.RTCharts) {
      var shortLabels = { smoothness: 'Smooth', stability: 'Stable', strafe: 'Strafe', turn: 'Turn', levelScore: 'Path', recovery: 'Recover' };
      window.RTCharts.radar(canvas, keys.map(function (k) { return shortLabels[k]; }), keys.map(function (k) { return Number(stats[k]) || 0; }));
    }
  }

  /* ── Section 3: Practice consistency ─────────────────────────────────────── */
  function renderConsistency(ctx) {
    var el = $('consistency-content');
    if (!el) return;
    var cons = ctx.consistency;
    var sessions = ctx.state.driver.sessions || [];
    var html = '<div class="rpt-headline">' + esc(cons.headline) + '</div><div class="rpt-detail">' + esc(cons.detail) + '</div>';
    if (sessions.length) {
      html += '<div class="rpt-stats-grid rpt-stats-grid-4">';
      html += '<div class="rpt-stat"><div class="rpt-stat-val clr-gold">' + cons.currentStreak + '</div><div class="rpt-stat-label">Current streak (days)</div></div>';
      html += '<div class="rpt-stat"><div class="rpt-stat-val clr-cyan">' + cons.longestStreak + '</div><div class="rpt-stat-label">Longest streak</div></div>';
      html += '<div class="rpt-stat"><div class="rpt-stat-val clr-green">' + cons.days28 + '/28</div><div class="rpt-stat-label">Days practised</div></div>';
      html += '<div class="rpt-stat"><div class="rpt-stat-val clr-purple">' + esc(fmtTime(ctx.stats.totalPracticeMs || 0)) + '</div><div class="rpt-stat-label">Total practice</div></div>';
      html += '</div>';
      html += '<div class="rpt-chart-label">Sessions per week — last 12 weeks</div><div class="rpt-chart-wrap"><canvas id="consistency-chart" aria-label="Sessions per week"></canvas></div>';
    }
    el.innerHTML = html;
    var canvas = $('consistency-chart');
    if (canvas && window.RTCharts) {
      var now = Date.now();
      var weeks = [];
      for (var w = 11; w >= 0; w--) {
        var end = now - w * 7 * DAY, start = end - 7 * DAY;
        var count = sessions.filter(function (s) { return s.startedAt > start && s.startedAt <= end; }).length;
        weeks.push({ label: w === 0 ? 'now' : fmtDate(start), value: count, highlight: w === 0 });
      }
      window.RTCharts.columns(canvas, weeks, { height: 140 });
    }
  }

  /* ── Section 4: Curriculum progress + mastery by module ──────────────────── */
  function renderCurriculum(ctx) {
    var el = $('curriculum-content');
    if (!el) return;
    var phases = ctx.state.curriculum.phases || {};
    var cur = window.RTReportText.curriculum(phases, meta());
    var mas = window.RTReportText.mastery(ctx.bkt, meta());
    var isUnlocked = ctx.isUnlocked;
    var html = '<div class="rpt-headline">' + esc(cur.headline) + '</div>';
    if (cur.detail) html += '<div class="rpt-detail">' + esc(cur.detail) + '</div>';

    html += '<div class="rpt-phases">';
    meta().forEach(function (ph) {
      var d = phases[ph.id];
      var status = d && d.status ? d.status : (isUnlocked(ph.id) ? 'not_started' : 'locked');
      var labels = { locked: 'Locked', not_started: 'Not started', in_progress: 'In progress', submitted: 'Submitted', verified: 'Completed' };
      html += '<span class="rpt-phase-pill rpt-pill-' + status.replace(/_/g, '-') + '" title="' + esc(ph.name) + '">' + esc(ph.num) + ' · ' + esc(labels[status] || status) + '</span>';
    });
    html += '</div>';

    html += '<div class="rpt-headline rpt-headline-sub">Mastery by module</div><div class="rpt-detail">' + esc(mas.headline) + ' ' + esc(mas.detail) + '</div>';
    html += '<div class="sk-list">';
    meta().forEach(function (ph) {
      var b = ctx.bkt.phases[ph.id];
      if (!b) return;
      var d = phases[ph.id];
      var status = d && d.status ? d.status : (isUnlocked(ph.id) ? 'not_started' : 'locked');
      if (status === 'locked' && !b.observedModules) return;
      var label = 'Phase ' + ph.num + ' · ' + ph.name;
      var valueLabel = b.observedModules ? pct(b.mastery) + '%' : '—';
      html += '<details class="rpt-mastery"><summary>' + bar(label, b.observedModules ? pct(b.mastery) : 0, valueLabel) + '<span class="rpt-mastery-meta">' + b.observedModules + '/' + b.totalModules + ' modules attempted</span></summary><div class="rpt-mastery-modules">';
      b.order.forEach(function (mid) {
        var m = b.modules[mid];
        html += bar(m.title, m.observed ? pct(m.pL) : 0, m.observed ? pct(m.pL) + '%' : 'not yet', 'sk-row-sub');
      });
      html += '</div></details>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  /* ── Section 5: Coach analysis (rule-based, generated in TeleOp) ─────────── */
  function renderCoach(ctx) {
    var el = $('ai-content');
    if (!el) return;
    var rp = ctx.lastReport, prevRp = ctx.prevReport;
    if (!rp) {
      el.innerHTML = '<div class="rpt-empty">Open the Driver Report in TeleOp Practice after a session to generate coaching insights. <a href="teleop.html">Start Practicing</a></div>';
      return;
    }
    var profileName = rp.driverProfile ? rp.driverProfile.split(' — ')[0] : 'Driver';
    var profileDesc = rp.driverProfile && rp.driverProfile.indexOf(' — ') !== -1 ? rp.driverProfile.split(' — ')[1] : '';
    var html = '<div class="ai-profile-badge">' + esc(profileName) + '</div>';
    if (profileDesc) html += '<div class="ai-profile-desc">' + esc(profileDesc) + '</div>';
    if (prevRp && typeof prevRp.overallScore === 'number' && typeof rp.overallScore === 'number') {
      var delta = rp.overallScore - prevRp.overallScore;
      var deltaStr = delta > 0 ? '+' + delta : '' + delta;
      var deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
      html += '<div class="ai-comparison"><span class="ai-comp-label">Score:</span> ' + prevRp.overallScore + ' → ' + rp.overallScore + ' <span class="ai-delta ' + deltaClass + '">(' + deltaStr + ')</span></div>';
    }
    var summary = rp.summary || rp.overallSummary || '';
    if (summary) html += '<div class="ai-summary">' + esc(summary) + '</div>';
    if (rp.strengths && rp.strengths.length) {
      html += '<div class="ai-section-label">Strengths</div><div class="ai-list">' + rp.strengths.map(function (s) { return '<div class="ai-item ai-strength"><span class="ai-icon">✓</span> ' + esc(s) + '</div>'; }).join('') + '</div>';
    }
    if (rp.weaknesses && rp.weaknesses.length) {
      html += '<div class="ai-section-label">Areas to Improve</div><div class="ai-list">' + rp.weaknesses.map(function (w) { return '<div class="ai-item ai-weakness"><span class="ai-icon">△</span> ' + esc(w) + '</div>'; }).join('') + '</div>';
    }
    if (rp.detailedAnalysis) html += '<div class="ai-section-label">Detailed Analysis</div><div class="ai-detailed">' + esc(rp.detailedAnalysis) + '</div>';
    if (rp.trainingPlan && rp.trainingPlan.length) {
      html += '<div class="ai-section-label">Training Plan</div><ol class="ai-plan">' + rp.trainingPlan.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol>';
    }
    html += '<a class="ai-generate-btn" href="teleop.html">Generate a new report in TeleOp Practice</a>';
    el.innerHTML = html;
  }

  /* ── Section 6: All-time stats ───────────────────────────────────────────── */
  function renderAllTime(ctx) {
    var el = $('alltime-content');
    if (!el) return;
    var d = ctx.stats || {}, levels = ctx.state.driver.levels || {}, phases = ctx.state.curriculum.phases || {};
    var levelsDone = 0, bestLevel = 0;
    Object.keys(levels).forEach(function (id) {
      var ld = levels[id];
      if (ld && ld.bestStars >= 1) { levelsDone++; var n = parseInt(id, 10); if (!isNaN(n) && n > bestLevel) bestLevel = n; }
    });
    var phasesCompleted = 0, gradedScores = [];
    Object.keys(phases).forEach(function (pid) {
      var cd = phases[pid];
      if (!cd) return;
      if (cd.status === 'verified' || cd.status === 'submitted') phasesCompleted++;
      if (typeof cd.bestScore === 'number' && cd.bestScore > 0) gradedScores.push(cd.bestScore);
    });
    var avgCode = gradedScores.length ? Math.round(gradedScores.reduce(function (a, b) { return a + b; }, 0) / gradedScores.length) : null;
    if (!d.lastUpdated && levelsDone === 0 && phasesCompleted === 0) { el.innerHTML = '<div class="rpt-empty">No stats yet.</div>'; return; }
    var score = d.overallRating || 0;
    var stats = [
      { val: fmtTime(d.totalPracticeMs || 0), label: 'Practice Time', cls: 'clr-cyan' },
      { val: levelsDone + '/12', label: 'Levels Done', cls: 'clr-gold' },
      { val: score, label: 'Driver Rating', cls: scoreColorClass(score) },
      { val: bestLevel > 0 ? bestLevel : '—', label: 'Best Level', cls: 'clr-gold' },
      { val: phasesCompleted, label: 'Curriculum Phases', cls: 'clr-green' },
      { val: avgCode !== null ? avgCode + '%' : '—', label: 'Avg Code Score', cls: 'clr-purple' }
    ];
    el.innerHTML = '<div class="rpt-stats-grid">' + stats.map(function (s) { return '<div class="rpt-stat"><div class="rpt-stat-val ' + s.cls + '">' + esc(String(s.val)) + '</div><div class="rpt-stat-label">' + s.label + '</div></div>'; }).join('') + '</div>';
  }

  /* ── Section 7: Levels grid ──────────────────────────────────────────────── */
  function renderLevels(ctx) {
    var el = $('levels-content');
    if (!el) return;
    var userLevels = ctx.state.driver.levels || {};
    var completed = Object.keys(userLevels).filter(function (id) { return userLevels[id] && userLevels[id].bestStars >= 1; }).length;
    var html = '<div class="rlg-summary">' + completed + '/12 LEVELS DONE</div><div class="rpt-levels-grid">';
    LEVEL_DEFS.forEach(function (def, i) {
      var lvl = userLevels[def.id];
      var isLocked = completed < (TIER_UNLOCK[def.tier] || 0);
      var num = i + 1;
      if (isLocked) {
        html += '<div class="rlg-cell locked"><div class="rlg-lock">' + (window.RT_ICONS ? window.RT_ICONS.lock : '') + '</div><div class="rlg-name">' + esc(def.name) + '</div></div>';
        return;
      }
      var stars = lvl && lvl.bestStars ? lvl.bestStars : 0;
      var cls = stars === 3 ? 'gold' : stars === 2 ? 'silver' : stars >= 1 ? 'bronze' : '';
      var ratingLabel = stars === 3 ? 'Gold' : stars === 2 ? 'Silver' : stars >= 1 ? 'Bronze' : '';
      html += '<div class="rlg-cell' + (cls ? ' ' + cls : '') + '" onclick="RTReport.toggleLevelDetail(this, event)" data-name="' + esc(def.name) + '" data-time="' + (lvl && lvl.bestTime ? Number(lvl.bestTime).toFixed(2) : '') + '" data-rating="' + ratingLabel + '" data-attempts="' + (lvl ? (lvl.attempts || 0) : 0) + '" data-num="' + num + '">';
      html += '<div class="rlg-num">' + num + '</div>';
      if (stars > 0) {
        var starHtml = '';
        for (var s = 1; s <= 3; s++) starHtml += '<span class="rlg-star' + (s <= stars ? ' lit' : '') + '">' + (s <= stars ? '★' : '☆') + '</span>';
        html += '<div class="rlg-stars">' + starHtml + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  function toggleLevelDetail(cell, e) {
    if (e) e.stopPropagation();
    var existing = document.querySelector('.rlg-tooltip');
    if (existing) { existing.remove(); return; }
    var name = cell.getAttribute('data-name');
    if (!name) return;
    var tip = document.createElement('div');
    tip.className = 'rlg-tooltip';
    var time = cell.getAttribute('data-time'), rating = cell.getAttribute('data-rating'), attempts = cell.getAttribute('data-attempts');
    tip.innerHTML = '<div class="rlg-tip-title">Level ' + esc(cell.getAttribute('data-num')) + ': ' + esc(name) + '</div>'
      + '<div class="rlg-tip-row"><span>Best Time:</span><span class="clr-cyan">' + (time ? esc(time) + 's' : '—') + '</span></div>'
      + '<div class="rlg-tip-row"><span>Rating:</span><span class="clr-gold">' + esc(rating || 'Not completed') + '</span></div>'
      + '<div class="rlg-tip-row"><span>Attempts:</span><span>' + esc(attempts || '0') + '</span></div>';
    cell.appendChild(tip);
    document.addEventListener('click', function dismiss() { tip.remove(); document.removeEventListener('click', dismiss); }, { once: true });
  }

  /* ── Section 8: Session history ──────────────────────────────────────────── */
  function renderHistory(ctx) {
    var el = $('history-content');
    if (!el) return;
    var items = (ctx.state.driver.sessions || []).slice(-15).reverse();
    if (!items.length) {
      el.innerHTML = '<div class="rpt-empty"><span class="rpt-empty-icon">' + (window.RT_ICONS ? window.RT_ICONS.chart : '') + '</span><p>Session history will appear here as you practice.</p><p class="rpt-empty-sub">Complete TeleOp sessions (30 seconds or longer) to build your history.</p></div>';
      return;
    }
    var html = '<div class="sh-list">';
    items.forEach(function (i) {
      var duration = i.durationMs ? Math.max(1, Math.round(i.durationMs / 60000)) + 'min' : '';
      var action = 'Practiced ' + (i.levelsAttempted || 0) + ' level run' + (i.levelsAttempted === 1 ? '' : 's');
      if (i.levelsCompleted) action += ' · ' + i.levelsCompleted + ' completed';
      var rating = (typeof i.ratingAtEnd === 'number') ? ' · rating <span class="' + scoreColorClass(i.ratingAtEnd) + '">' + i.ratingAtEnd + '</span>' : '';
      html += '<div class="sh-item"><span class="sh-text">' + fmtDate(i.startedAt || 0) + (duration ? ' · <span class="clr-cyan">' + duration + '</span>' : '') + rating + '</span><span class="sh-action">' + esc(action) + '</span></div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  /* ── Render all ──────────────────────────────────────────────────────────── */
  function buildContext(state) {
    var reports = state.driver.coachReports || [];
    var phases = state.curriculum.phases || {};
    var isUnlocked = isUnlockedFactory(phases);
    var bkt = window.RTBkt ? window.RTBkt.recompute(window.RTStore) : { phases: {} };
    var consistency = window.RTReportText.consistency(state.driver.sessions);
    return {
      state: state,
      stats: state.driver.stats || {},
      lastReport: reports.length ? reports[reports.length - 1] : null,
      prevReport: reports.length >= 2 ? reports[reports.length - 2] : null,
      isUnlocked: isUnlocked,
      bkt: bkt,
      consistency: consistency,
      next: window.RTReportText.nextStep(state, bkt, meta(), isUnlocked),
      callouts: window.RTReportText.callouts(state, consistency, bkt)
    };
  }

  var sections = [renderOverview, renderSkills, renderConsistency, renderCurriculum, renderCoach, renderAllTime, renderLevels, renderHistory];

  function render() {
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var state = window.RTStore.get();
    var ctx = buildContext(state);
    sections.forEach(function (fn) {
      try { fn(ctx); } catch (e) { console.error('[Report] section failed:', fn.name, e); }
    });
    var banner = $('rpt-empty-banner');
    if (banner) {
      var nothing = !(ctx.stats && ctx.stats.lastUpdated) && !Object.keys(state.driver.levels || {}).length && !(state.curriculum.attempts || []).length;
      banner.hidden = !nothing;
    }
    var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
    window.RTReport.lastRenderMs = t1 - t0;
    return ctx;
  }

  window.RTReport = { render: render, sections: sections, toggleLevelDetail: toggleLevelDetail, lastRenderMs: 0 };

  var rerenderTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(function () { if (window.RTStore) render(); }, 200);
  });
  // The canvases are painted with the theme's chart tokens; repaint them when it flips.
  window.addEventListener('rt-themechange', function () { if (window.RTStore) render(); });
})();
