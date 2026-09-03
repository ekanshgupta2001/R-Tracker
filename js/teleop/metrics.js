// ── R-Tracker TeleOp — Driver Metrics ────────────────────────────────────
// Two different kinds of number live here:
//
//   • The Overall Driver Rating is an OUTCOME measure: js/driver-rating.js scores
//     the stored level runs (driver.runs) on time against par, path accuracy and
//     wall hits, difficulty-weighted over the last RATING_SESSIONS sessions.
//   • The style metrics (smoothness, stability, strafe, turn precision, recovery)
//     are DIAGNOSTICS. They are sampled only while the robot is at ≥ 60% of max
//     speed, each sample weighted by speed/max, so gentle low-speed driving cannot
//     buy a score. They explain the rating on the Report Card; they never feed it.
//
// Wall collisions are detected here from the effect of the field-boundary clamp in
// drive.js (the robot is pinned to a wall after moving into it at speed). Physics,
// controls and level geometry are untouched.

const AT_SPEED_FRACTION  = 0.60;   // a frame is sampled when speed ≥ 60% of max
const MOVING_FRACTION    = 0.05;   // below this the robot is idle (not "moving time")
const TURN_MIN_RATE      = 0.60;   // a turn counts for overshoot when the stick peaked at ≥ 60%
const TURN_SETTLE_MS     = 1200;   // window after release in which counter-rotation reads as a correction
const COLLISION_MIN_FTS  = 1.5;    // impact speed into a wall that counts as a hit
const STYLE_MIN_AT_SPEED = 0.20;   // below this share of moving time the diagnostics are "insufficient data"
const RATING_SESSIONS    = (typeof window !== 'undefined' && window.RT_RATING_SESSIONS > 0) ? window.RT_RATING_SESSIONS : 5;

const STYLE_ROWS = [
  { key: 'smoothness', label: 'Smoothness',     short: 'Smooth'  },
  { key: 'stability',  label: 'Stability',      short: 'Stable'  },
  { key: 'strafe',     label: 'Strafe Use',     short: 'Strafe'  },
  { key: 'turn',       label: 'Turn Precision', short: 'Turn'    },
  { key: 'recovery',   label: 'Recovery',       short: 'Recover' },
];

// One-line hints per style metric (used by the Report Card and the coach).
const STYLE_HINTS = {
  smoothness: 'Practice gradual stick inputs instead of snapping to full power. Ease in and out of movements.',
  stability:  'Reduce rotation while translating. Try to separate your movement and turning inputs.',
  strafe:     'Keep the left stick on the horizontal axis when strafing so no forward drift creeps in.',
  turn:       'Release the rotation stick earlier and let the robot coast onto the heading instead of spinning back.',
  recovery:   'When you hit a checkpoint, be moving toward the next one already. Read the path ahead.',
};

// What to practise for each level focus group (js/level-table.js).
const FOCUS_HINTS = {
  straight:  'Hold the rotation stick still while translating: any heading drift on a straight costs time and accuracy.',
  strafe:    'Keep the left stick on the horizontal axis when strafing so no forward drift creeps in.',
  corners:   'Brake before the corner, not after: ease off about a robot-length early so the turn lands inside the corridor.',
  reversals: 'Anticipate the reversal: ease off, flick the stick through the change, and accelerate out. Do not stop dead at each point.',
  speed:     'Commit to full deflection on the long diagonals and pick your braking point before the checkpoint, not at it.',
  precision: 'Link the checkpoints as one flowing line at a steady speed rather than sprinting and stopping between them.',
};

// A style accumulator. One for the session (driverMetrics.style) and one for the
// level run in progress (lvl.style). Every field is additive, so a run can be
// scored on its own without touching the session totals.
function newStyleAcc() {
  return {
    movingMs: 0, atSpeedMs: 0,
    jerkW: 0, jerkSum: 0, heavyW: 0,        // smoothness (speed-weighted stick delta)
    stabW: 0, stabGood: 0,                  // heading stability while not turning
    strafeW: 0, strafeContam: 0,            // forward bleed during lateral motion
    turnW: 0, turnSum: 0, turnN: 0,         // overshoot degrees per fast turn, weighted by peak rate
    reactW: 0, reactSum: 0, reactN: 0,      // reaction ms, weighted by speed at the event
    collisions: 0,
  };
}

let driverMetrics = {
  sessionStart: performance.now(),
  totalDistance: 0,
  totalInputs: 0,
  pathAccuracyHistory: [],
  levelsCompleted: 0,
  pendingReactionTs: null,
  style: newStyleAcc(),
};

// Frame-to-frame tracker state (never persisted).
let _trk = {
  prevLx: 0, prevLy: 0, prevRx: 0, prevHdg: 0,
  prevVx: 0, prevVy: 0,
  wallX: false, wallY: false,
  turn: { active: false, dir: 0, peak: 0 },
  settle: null,            // { dir, peak, releaseTs, coast, counter } after a fast turn ends
  spinStart: null,         // free drive: when |omega| went above 60°/s
};

let prevRatingBeforeLevel = null;
let metricsVisible = true;

// The accumulators a sample belongs to: the session, plus the run if one is live.
function styleTargets() {
  const runActive = typeof lvl !== 'undefined' && appMode === 'levels' && lvl.phase === 'attempt' && lvl.style;
  return runActive ? [driverMetrics.style, lvl.style] : [driverMetrics.style];
}

// A reaction event (checkpoint-to-checkpoint, or spin-settle in free drive).
// Counted only when the robot is at speed, weighted by speed/max.
function recordReaction(ms) {
  const maxSpd = Math.max(0.1, cfg.maxSpd);
  const speed = Math.hypot(bot.actualVx, bot.actualVy);
  if (speed < AT_SPEED_FRACTION * maxSpd) return;
  const w = Math.min(1, speed / maxSpd);
  styleTargets().forEach(a => { a.reactW += w; a.reactSum += w * ms; a.reactN++; });
}

// Close the overshoot window of the last fast turn, if one is open.
function finalizeTurnSettle() {
  const s = _trk.settle;
  if (!s) return;
  // The robot cannot reverse on its own (friction only decays the spin), so any
  // counter-rotation after release is the driver bringing the heading back. It is
  // capped at the coast so a deliberate new turn the other way is not all blamed.
  const overshoot = Math.min(s.counter, s.coast);
  styleTargets().forEach(a => { a.turnW += s.peak; a.turnSum += s.peak * overshoot; a.turnN++; });
  _trk.settle = null;
}
function flushTurnTracker() { finalizeTurnSettle(); }

// True while the robot is within a checkpoint's reach — a wall hit there is the
// level's geometry, not the driver (some checkpoints sit within a robot-width of a wall).
function nearLevelCheckpoint() {
  if (typeof lvl === 'undefined' || appMode !== 'levels' || lvl.phase !== 'attempt') return false;
  const def = getLevelDef();
  if (!def) return false;
  const reach = LVL_CP_RADIUS + 0.5;
  for (let i = Math.max(1, lvl.nextCp - 1); i <= Math.min(def.path.length - 1, lvl.nextCp); i++) {
    const cp = def.path[i];
    if (Math.hypot(bot.x - cp.x, bot.y - cp.y) <= reach) return true;
  }
  return false;
}

function updateMetrics(dt, prevBx, prevBy) {
  const dx = bot.x - prevBx, dy = bot.y - prevBy;
  driverMetrics.totalDistance += Math.hypot(dx, dy);

  const now = performance.now();
  const maxSpd = Math.max(0.1, cfg.maxSpd);
  const speed = Math.hypot(bot.actualVx, bot.actualVy);
  const w = Math.min(1, speed / maxSpd);
  const moving = speed >= MOVING_FRACTION * maxSpd;
  const atSpeed = speed >= AT_SPEED_FRACTION * maxSpd;
  const ms = dt * 1000;
  const targets = styleTargets();

  if (moving) targets.forEach(a => { a.movingMs += ms; if (atSpeed) a.atSpeedMs += ms; });

  const dlx = inp.lx - _trk.prevLx;
  const dly = inp.ly - _trk.prevLy;
  const drx = inp.rx - _trk.prevRx;
  const stickDelta = Math.max(Math.abs(dlx), Math.abs(dly), Math.abs(drx));
  // normAngle is defined in levels.js (loaded before this file is used)
  const hdgChange = normAngle(bot.hdg - _trk.prevHdg);

  if (atSpeed) {
    // Strafe is lateral motion in the ROBOT frame (drive.js exposes vFwd/vStr).
    const fwd = Math.abs(bot.vFwd || 0), str = Math.abs(bot.vStr || 0);
    const lateral = fwd + str > 0.01 && str / (fwd + str) > 0.65;
    targets.forEach(a => {
      // Smoothness: stick jerk while at speed
      a.jerkW += w; a.jerkSum += w * stickDelta;
      if (stickDelta > 0.3) a.heavyW += w;
      // Stability: heading steady when not actively turning
      if (Math.abs(inp.rx) < 0.1) { a.stabW += w; if (Math.abs(hdgChange) < 0.5) a.stabGood += w; }
      // Strafe: forward bleed during lateral motion
      if (lateral) { a.strafeW += w; a.strafeContam += w * fwd / (fwd + str); }
    });
  }

  // Turn precision: overshoot = degrees the driver has to bring the heading back
  // after releasing a fast turn (peak ≥ 60% rotation rate). 0° means the turn
  // landed where the stick was released.
  const rx = inp.rx;
  const t = _trk.turn;
  if (!t.active) {
    if (Math.abs(rx) >= 0.1) { t.active = true; t.dir = Math.sign(rx); t.peak = Math.abs(rx); }
  } else if (rx * t.dir > 0) {
    if (Math.abs(rx) > t.peak) t.peak = Math.abs(rx);
  } else {
    // released, or reversed: this turn is over
    if (t.peak >= TURN_MIN_RATE) {
      finalizeTurnSettle();
      _trk.settle = { dir: t.dir, peak: t.peak, releaseTs: now, coast: 0, counter: 0 };
    }
    t.active = false; t.dir = 0; t.peak = 0;
    if (Math.abs(rx) >= 0.1) { t.active = true; t.dir = Math.sign(rx); t.peak = Math.abs(rx); }
  }
  const s = _trk.settle;
  if (s) {
    if (hdgChange * s.dir > 0) s.coast += Math.abs(hdgChange);
    else if (hdgChange * s.dir < 0) s.counter += Math.abs(hdgChange);
    if (now - s.releaseTs >= TURN_SETTLE_MS) finalizeTurnSettle();
  }

  // Wall collisions: the clamp in drive.js pins the robot to the boundary and
  // zeroes its velocity. Pinned now, and moving into that wall at ≥ 1.5 ft/s a
  // frame ago, is a hit. Counted once per contact.
  const hf = FIELD_FT / 2 - cfg.robotSz / 24;
  const eps = 1e-4;
  const pinX = Math.abs(bot.x) >= hf - eps;
  const pinY = Math.abs(bot.y) >= hf - eps;
  const excused = nearLevelCheckpoint();
  if (pinX) {
    if (!_trk.wallX && !excused && _trk.prevVx * Math.sign(bot.x) >= COLLISION_MIN_FTS) targets.forEach(a => a.collisions++);
    _trk.wallX = true;
  } else _trk.wallX = false;
  if (pinY) {
    if (!_trk.wallY && !excused && _trk.prevVy * Math.sign(bot.y) >= COLLISION_MIN_FTS) targets.forEach(a => a.collisions++);
    _trk.wallY = true;
  } else _trk.wallY = false;

  // Recovery in free drive: how quickly heading settles after a spin (>60°/s)
  if (appMode === 'freedrive') {
    const unstable = Math.abs(bot.actualOmega || 0) > 60;
    if (unstable && _trk.spinStart === null) _trk.spinStart = now;
    else if (!unstable && _trk.spinStart !== null) { recordReaction(now - _trk.spinStart); _trk.spinStart = null; }
  } else {
    _trk.spinStart = null;
  }

  if (Math.abs(inp.lx) > 0.05 || Math.abs(inp.ly) > 0.05 || Math.abs(inp.rx) > 0.05) driverMetrics.totalInputs++;

  _trk.prevLx = inp.lx; _trk.prevLy = inp.ly; _trk.prevRx = inp.rx;
  _trk.prevHdg = bot.hdg;
  _trk.prevVx = bot.actualVx; _trk.prevVy = bot.actualVy;
}

// Style scores from an accumulator. A metric is null when it has no samples;
// `sufficient` is false when under 20% of moving time was at speed.
function styleScores(acc) {
  const a = acc || driverMetrics.style;
  const c = v => Math.max(0, Math.min(100, v));
  const atSpeedFraction = a.movingMs > 0 ? a.atSpeedMs / a.movingMs : 0;
  const sufficient = a.movingMs > 0 && atSpeedFraction >= STYLE_MIN_AT_SPEED;
  const smoothness = a.jerkW > 0 ? c(100 - (a.jerkSum / a.jerkW) * 200 - (a.heavyW / a.jerkW) * 40) : null;
  const stability  = a.stabW > 0 ? c((a.stabGood / a.stabW) * 100) : null;
  const strafe     = a.strafeW > 0 ? c(100 - (a.strafeContam / a.strafeW) * 320) : null;
  const turnOvershootDeg = a.turnW > 0 ? a.turnSum / a.turnW : null;
  const turn       = turnOvershootDeg === null ? null : c(100 - (turnOvershootDeg / 30) * 100);
  const recovery   = a.reactW > 0 ? c(100 - ((a.reactSum / a.reactW) - 200) / 10) : null;
  return {
    smoothness, stability, strafe, turn, turnOvershootDeg, recovery,
    atSpeedFraction, sufficient,
    collisions: a.collisions, movingMs: a.movingMs, atSpeedMs: a.atSpeedMs,
  };
}

function computeScores() { return styleScores(driverMetrics.style); }

// ── Overall rating: js/driver-rating.js over the stored runs ──────────────
let _ratingCache = { key: null, result: null };
if (typeof RTStore !== 'undefined' && RTStore.onChange) RTStore.onChange(function () { _ratingCache.key = null; });

function currentRating() {
  const runs = (RTStore.get().driver && RTStore.get().driver.runs) || [];
  const last = runs.length ? runs[runs.length - 1] : null;
  const key = runs.length + ':' + (last ? last.timestamp + ':' + last.levelId : '') + ':' + RATING_SESSIONS;
  if (_ratingCache.key !== key) {
    _ratingCache = { key, result: RTDriverRating.rate(runs, RT_LEVEL_TABLE, { sessionsWindow: RATING_SESSIONS }) };
  }
  return _ratingCache.result;
}

function computeOverallRating() { return currentRating().rating; }
function gradeFromRating(r) { return RTDriverRating.gradeFromRating(r); }

// What a rating band means, in terms of the runs behind it.
function percentileFromRating(r) {
  if (r >= 95) return 'Far beyond par with clean lines and no wall hits';
  if (r >= 85) return 'Well beyond par on the levels you have rated';
  if (r >= 75) return 'Ahead of par on most rated levels';
  if (r >= 65) return 'Around par';
  if (r >= 50) return 'Behind par: finishing, but slowly or off the line';
  return 'Well behind par: keep completing levels';
}

function listLevels(ids) {
  const names = ids.map(id => String(id));
  if (names.length === 1) return 'Level ' + names[0];
  return 'Levels ' + names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

// The recommendation: the weakest level group first, style metrics as the fallback.
function buildRecommendation(rr, scores) {
  const groups = RTDriverRating.groupsByFocus(rr, RT_LEVEL_TABLE);
  if (groups.length) {
    const g = groups[0];
    let text = 'Your slowest levels relative to par are ' + listLevels(g.levelIds).replace(/^Levels? /, '') +
      ': ' + g.label + ', running at ' + Math.round(g.meanParRatio * 100) + '% of par pace. ' + (FOCUS_HINTS[g.focus] || '');
    if (scores.sufficient && scores.turnOvershootDeg !== null && (g.focus === 'corners' || g.focus === 'reversals' || g.focus === 'precision' || scores.turnOvershootDeg >= 8)) {
      text += ' Overshoot averages ' + Math.round(scores.turnOvershootDeg) + '° after fast turns.';
    }
    return text.trim();
  }
  if (scores.sufficient) {
    const rows = STYLE_ROWS.map(r => ({ key: r.key, val: scores[r.key] })).filter(r => r.val !== null).sort((a, b) => a.val - b.val);
    if (rows.length) return STYLE_HINTS[rows[0].key];
  }
  return 'Complete a level in Levels mode to get rated. Drive at 60%+ of max speed to unlock the style diagnostics.';
}

// ── Report Card (Stats tab) ───────────────────────────────────────────────
function setSkillBar(id, pctId, val, note) {
  const fill = document.getElementById(id);
  const pct  = document.getElementById(pctId);
  if (!fill || !pct) return;
  if (val === null || val === undefined) {
    fill.style.width = '0%';
    fill.className = 'an-bar-fill na';
    pct.textContent = '—';
    pct.className = 'an-bar-pct na';
    pct.title = note || 'No data';
    return;
  }
  const v = Math.round(val);
  fill.style.width = v + '%';
  fill.className = 'an-bar-fill ' + (v >= 80 ? 'good' : v >= 55 ? 'ok' : 'poor');
  pct.textContent = v + '%';
  pct.className = 'an-bar-pct';
  pct.title = note || '';
}

function renderStyleBars(scores) {
  const atPct = Math.round(scores.atSpeedFraction * 100);
  const atEl = document.getElementById('an-atspeed');
  if (atEl) atEl.textContent = scores.movingMs > 0 ? atPct + '% of driving at speed' : 'no driving yet';
  const note = document.getElementById('an-style-note');
  if (!scores.sufficient) {
    if (note) note.textContent = scores.movingMs > 0
      ? 'Insufficient data: ' + atPct + '% of your driving time was at 60% of max speed or more (the diagnostics need 20%). Drive faster to unlock them.'
      : 'Insufficient data: drive for a while at 60% of max speed or more to unlock the style diagnostics.';
    STYLE_ROWS.forEach(r => setSkillBar('anb-' + r.key, 'anp-' + r.key, null, 'Insufficient data'));
    return;
  }
  if (note) note.textContent = 'Sampled only at 60% of max speed or more, weighted by speed. These explain the rating; they do not feed it.';
  setSkillBar('anb-smoothness', 'anp-smoothness', scores.smoothness);
  setSkillBar('anb-stability',  'anp-stability',  scores.stability);
  setSkillBar('anb-strafe',     'anp-strafe',     scores.strafe, scores.strafe === null ? 'No strafing at speed yet' : '');
  setSkillBar('anb-turn',       'anp-turn',       scores.turn, scores.turn === null ? 'No fast turns yet' : 'Average overshoot ' + Math.round(scores.turnOvershootDeg) + '°');
  setSkillBar('anb-recovery',   'anp-recovery',   scores.recovery, scores.recovery === null ? 'No checkpoint or spin events at speed yet' : '');
}

function renderLevelPerformance(rr) {
  const el = document.getElementById('an-levels');
  if (!el) return;
  const win = document.getElementById('an-lvl-window');
  if (win) win.textContent = 'last ' + rr.sessionsWindow + ' sessions';
  const ids = Object.keys(rr.levels).map(Number).sort((a, b) => a - b);
  const unratedNote = rr.unratedRuns
    ? '<div class="an-lvl-empty">' + rr.unratedRuns + ' run' + (rr.unratedRuns === 1 ? '' : 's') + ' recorded at other physics settings: stored, not rated. Levels are rated at the default Free Drive sliders.</div>'
    : '';
  if (!ids.length) {
    el.innerHTML = '<div class="an-lvl-empty">No rated level runs in the last ' + rr.sessionsWindow + ' sessions. Complete a level to get rated.</div>' + unratedNote;
    return;
  }
  let html = '<div class="an-lvl-head"><span>Level</span><span>Best</span><span>Best time / par</span><span>Runs</span></div>';
  ids.forEach(id => {
    const lv = rr.levels[id];
    const best = Math.round(lv.bestScore);
    const cls = !lv.counted ? 'na' : best >= 75 ? 'good' : best >= 50 ? 'ok' : 'poor';
    const time = lv.bestTimeMs ? (lv.bestTimeMs / 1000).toFixed(1) + 's' : '—';
    html += '<div class="an-lvl-row" data-level="' + lv.levelId + '">' +
      '<span class="an-lvl-name">' + lv.levelId + ' · ' + lv.name + '</span>' +
      '<span class="an-lvl-score ' + cls + '">' + (lv.counted ? best : '—') + '</span>' +
      '<span class="an-lvl-time">' + time + ' / ' + (lv.parTimeMs / 1000).toFixed(1) + 's</span>' +
      '<span class="an-lvl-runs">' + lv.attempts + '</span>' +
      '</div>';
  });
  el.innerHTML = html + unratedNote;
}

function openDriverReport() {
  flushDriverStats();
  _coachGenerated = false;
  switchReportTab('stats');
  const scores = computeScores();
  const rr = currentRating();
  const rating = rr.rating;
  const grade  = rr.grade;

  const gradeEl = document.getElementById('an-grade');
  gradeEl.textContent = grade;
  gradeEl.className = 'an-grade grade-' + grade;
  void gradeEl.offsetWidth;
  gradeEl.classList.add('animate');

  document.getElementById('an-overall').textContent = 'Overall: ' + rating + ' / 100';
  document.getElementById('an-percentile').textContent = rr.ratedLevels
    ? percentileFromRating(rating) + ' · ' + rr.ratedLevels + ' level' + (rr.ratedLevels === 1 ? '' : 's') + ' rated over ' + rr.sessionsInWindow + ' session' + (rr.sessionsInWindow === 1 ? '' : 's')
    : 'Complete a level to get rated';

  renderLevelPerformance(rr);
  renderStyleBars(scores);

  // Insights: level outcomes first, then style (only when there is enough at-speed data)
  const strengths = [], weaknesses = [];
  const ahead = [], behind = [];
  Object.keys(rr.levels).map(Number).sort((a, b) => a - b).forEach(id => {
    const lv = rr.levels[id];
    if (!lv.counted) return;
    if (lv.parRatio >= 1.15) ahead.push(id);
    else if (lv.parRatio < 0.85 || lv.levelScore < 50) behind.push(id);
  });
  if (ahead.length) strengths.push('Ahead of par on ' + listLevels(ahead));
  if (behind.length) weaknesses.push('Behind par on ' + listLevels(behind));
  const styleRows = scores.sufficient
    ? STYLE_ROWS.map(r => ({ label: r.label, key: r.key, val: scores[r.key] })).filter(r => r.val !== null).sort((a, b) => b.val - a.val)
    : [];
  styleRows.slice(0, 2).filter(r => r.val >= 65).forEach(r => strengths.push(r.label + ' (' + Math.round(r.val) + '%)'));
  styleRows.slice(-2).filter(r => r.val < 60).forEach(r => weaknesses.push(r.label + ' (' + Math.round(r.val) + '%)'));
  if (scores.collisions > 0) weaknesses.push('Wall hits this session: ' + scores.collisions);

  document.getElementById('an-strengths').innerHTML = strengths.length
    ? '<div class="an-list">' + strengths.map(s => '<div class="an-list-item"><span class="is-good">▲</span>' + s + '</div>').join('') + '</div>'
    : '';
  document.getElementById('an-weaknesses').innerHTML = weaknesses.length
    ? '<div class="an-list">' + weaknesses.map(s => '<div class="an-list-item"><span class="is-bad">▼</span>' + s + '</div>').join('') + '</div>'
    : '';
  document.getElementById('an-recommend').textContent = buildRecommendation(rr, scores);

  const sessMs = performance.now() - driverMetrics.sessionStart;
  const sessSec = Math.floor(sessMs / 1000);
  document.getElementById('ans-time').textContent = Math.floor(sessSec / 60) + ':' + String(sessSec % 60).padStart(2, '0');
  document.getElementById('ans-lvls').textContent = driverMetrics.levelsCompleted;
  document.getElementById('ans-dist').textContent = Math.round(driverMetrics.totalDistance);
  document.getElementById('ans-inputs').textContent = driverMetrics.totalInputs;

  document.getElementById('analytics-backdrop').classList.add('open');
}

function closeDriverReport() {
  document.getElementById('analytics-backdrop').classList.remove('open');
}

function confirmResetMetrics() {
  if (confirm("Reset this session's driving diagnostics? Your level runs and rating are kept.")) resetMetrics();
}

function resetMetrics() {
  driverMetrics = {
    sessionStart: performance.now(),
    totalDistance: 0, totalInputs: 0,
    pathAccuracyHistory: [], levelsCompleted: 0,
    pendingReactionTs: null,
    style: newStyleAcc(),
  };
  _trk = {
    prevLx: 0, prevLy: 0, prevRx: 0, prevHdg: bot.hdg,
    prevVx: 0, prevVy: 0,
    wallX: false, wallY: false,
    turn: { active: false, dir: 0, peak: 0 },
    settle: null, spinStart: null,
  };
  closeDriverReport();
}

function toggleMiniStats() {
  metricsVisible = !metricsVisible;
  document.getElementById('mini-stats').classList.toggle('hidden', !metricsVisible);
}

function renderMiniStats() {
  if (!metricsVisible) return;
  const spd = Math.hypot(bot.vx, bot.vy);
  document.getElementById('ms-spd').textContent = spd.toFixed(2);
  const sessMs = performance.now() - driverMetrics.sessionStart;
  const sessSec = Math.floor(sessMs / 1000);
  document.getElementById('ms-sess').textContent = Math.floor(sessSec / 60) + ':' + String(sessSec % 60).padStart(2, '0');
  const scores = computeScores();
  document.getElementById('ms-smooth').textContent = scores.sufficient && scores.smoothness !== null ? Math.round(scores.smoothness) + '%' : '—';
  const rr = currentRating();
  document.getElementById('ms-rating').textContent = rr.ratedLevels ? rr.grade + ' (' + rr.rating + ')' : '—';
}
