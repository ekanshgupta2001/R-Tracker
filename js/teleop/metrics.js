// ── R-Tracker TeleOp — Driver Metrics ────────────────────────────────────

let driverMetrics = {
  sessionStart: performance.now(),
  totalDistance: 0,
  totalInputs: 0,
  jerkSum: 0, jerkFrames: 0, _prevAx: 0, _prevAy: 0,
  // Stability: heading steady when rx is near zero (not actively turning)
  stabilityGoodFrames: 0, stabilityTotalFrames: 0, _prevHdg: 0,
  // Strafe
  strafeSum: 0, strafeFrames: 0,
  // Turn control: smoothness of rotation input (|drx| per frame)
  turnJerkSum: 0, turnJerkFrames: 0,
  // Path accuracy (levels)
  pathAccuracyHistory: [],
  levelsCompleted: 0,
  // Recovery: reaction times (levels checkpoints + free-drive heading events)
  pendingReactionTs: null,
  reactionTimes: [],
  _hdgUnstable: false, _hdgUnstableStart: null,
  // Smoothness (joystick jerk)
  joystickJerkSum: 0, joystickJerkFrames: 0, joystickHeavyJerkFrames: 0,
  _prevLx: 0, _prevLy: 0, _prevRx: 0,
  // Strafe contamination
  strafeContamSum: 0, strafeContamFrames: 0,
};

let prevRatingBeforeLevel = null;
let metricsVisible = true;

function updateMetrics(_dt, prevBx, prevBy) {
  const dx = bot.x - prevBx, dy = bot.y - prevBy;
  const dist = Math.hypot(dx, dy);
  driverMetrics.totalDistance += dist;

  // Legacy accel jerk (kept for potential future use)
  const ax = dist > 0 ? bot.actualVx : 0;
  const ay = dist > 0 ? bot.actualVy : 0;
  driverMetrics.jerkSum += Math.hypot(ax - driverMetrics._prevAx, ay - driverMetrics._prevAy);
  driverMetrics.jerkFrames++;
  driverMetrics._prevAx = ax;
  driverMetrics._prevAy = ay;

  // Joystick jerk (smoothness)
  const dlx = inp.lx - driverMetrics._prevLx;
  const dly = inp.ly - driverMetrics._prevLy;
  const drx = inp.rx - driverMetrics._prevRx;
  const stickDelta = Math.max(Math.abs(dlx), Math.abs(dly), Math.abs(drx));
  driverMetrics.joystickJerkSum += stickDelta;
  driverMetrics.joystickJerkFrames++;
  if (stickDelta > 0.3) driverMetrics.joystickHeavyJerkFrames++;
  driverMetrics._prevLx = inp.lx;
  driverMetrics._prevLy = inp.ly;
  driverMetrics._prevRx = inp.rx;

  // Heading stability: when not actively turning (|rx| < 0.1), heading should stay steady
  // normAngle is defined in levels.js (loaded before this file)
  const hdgChange = Math.abs(normAngle(bot.hdg - driverMetrics._prevHdg));
  if (Math.abs(inp.rx) < 0.1) {
    driverMetrics.stabilityTotalFrames++;
    if (hdgChange < 0.5) driverMetrics.stabilityGoodFrames++;
  }
  driverMetrics._prevHdg = bot.hdg;

  // Turn control: track jerkiness of rotation input (rate of change of rx)
  driverMetrics.turnJerkSum += Math.abs(drx);
  driverMetrics.turnJerkFrames++;

  // Strafe use
  if (dist > 0.002) {
    const fwd = Math.abs(bot.actualVy || 0), str = Math.abs(bot.actualVx || 0);
    if (fwd + str > 0.01) {
      driverMetrics.strafeSum += str / (fwd + str);
      driverMetrics.strafeFrames++;
      if (str / (fwd + str) > 0.65) {
        driverMetrics.strafeContamSum += fwd / (fwd + str);
        driverMetrics.strafeContamFrames++;
      }
    }
  }

  // Recovery in free drive: track how quickly heading stabilizes after spinning (>60°/s)
  if (appMode === 'freedrive') {
    const isUnstable = Math.abs(bot.actualOmega || 0) > 60;
    if (isUnstable && !driverMetrics._hdgUnstable) {
      driverMetrics._hdgUnstable = true;
      driverMetrics._hdgUnstableStart = performance.now();
    } else if (!isUnstable && driverMetrics._hdgUnstable && driverMetrics._hdgUnstableStart !== null) {
      driverMetrics._hdgUnstable = false;
      driverMetrics.reactionTimes.push(performance.now() - driverMetrics._hdgUnstableStart);
      driverMetrics._hdgUnstableStart = null;
    }
  }

  if (Math.abs(inp.lx) > 0.05 || Math.abs(inp.ly) > 0.05 || Math.abs(inp.rx) > 0.05) {
    driverMetrics.totalInputs++;
  }
}

function computeScores() {
  const m = driverMetrics;
  const sessionSec = (performance.now() - m.sessionStart) / 1000;
  // After 5s of driving, no metric should drop below 10 (prevents zero-dragging the overall)
  const minFloor = sessionSec > 5 ? 10 : 0;

  // Smoothness: joystick jerk (lower average delta = smoother)
  const avgStickJerk   = m.joystickJerkFrames > 0 ? m.joystickJerkSum / m.joystickJerkFrames : 0;
  const heavyJerkRatio = m.joystickJerkFrames > 0 ? m.joystickHeavyJerkFrames / m.joystickJerkFrames : 0;
  const smoothness = Math.max(minFloor, Math.min(100, 100 - avgStickJerk * 200 - heavyJerkRatio * 40));

  // Stability: fraction of non-turning frames where heading was steady (<0.5°/frame)
  // Defaults to 60 (slightly above neutral) until there is data
  const stability = m.stabilityTotalFrames > 0
    ? Math.max(minFloor, Math.min(100, (m.stabilityGoodFrames / m.stabilityTotalFrames) * 100))
    : 60;

  // Strafe use: low contamination = good strafe discipline
  const avgContam = m.strafeContamFrames > 0 ? m.strafeContamSum / m.strafeContamFrames : 0.20;
  const strafe    = Math.max(minFloor, Math.min(100, 100 - avgContam * 320));

  // Turn control: smoothness of rotation input changes (low avg |drx| = smoother turns)
  // Defaults to 60 (slightly above neutral) until there is data
  const avgTurnJerk = m.turnJerkFrames > 0 ? m.turnJerkSum / m.turnJerkFrames : 0;
  const turn = m.turnJerkFrames > 0
    ? Math.max(minFloor, Math.min(100, 100 - avgTurnJerk * 400))
    : 60;

  // Path accuracy (levels) — defaults to 50 (neutral) when no levels attempted
  const levelScore = m.pathAccuracyHistory.length > 0
    ? (m.pathAccuracyHistory.reduce((s, v) => s + v, 0) / m.pathAccuracyHistory.length) * 100
    : 50;

  // Recovery: avg time to stabilize after going off-heading or missing a checkpoint
  // Defaults to 60 (slightly above neutral) when no events recorded yet
  const avgReact = m.reactionTimes.length > 0
    ? m.reactionTimes.reduce((s, v) => s + v, 0) / m.reactionTimes.length
    : null;
  const recovery = avgReact !== null
    ? Math.max(minFloor, Math.min(100, 100 - (avgReact - 200) / 10))
    : 60;

  return { smoothness, stability, strafe, turn, levelScore, recovery };
}

function computeOverallRating() {
  const s = computeScores();
  const weighted =
    s.smoothness * 0.20 +
    s.stability  * 0.15 +
    s.strafe     * 0.15 +
    s.turn       * 0.15 +
    s.levelScore * 0.20 +
    s.recovery   * 0.15;

  const vals = [s.smoothness, s.stability, s.strafe, s.turn, s.levelScore, s.recovery];
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const consistencyPenalty = maxVal > 0 ? Math.sqrt(minVal / maxVal) : 1;

  const goldCount = Object.values(completedLevels).filter(c => c.stars.filter(Boolean).length === 3).length;
  const goldPenalty = goldCount < 12 ? 1 - (12 - goldCount) * 0.02 : 1;

  return Math.round(weighted * consistencyPenalty * goldPenalty);
}

function gradeFromRating(r) {
  if (r >= 95) return 'S';
  if (r >= 85) return 'A';
  if (r >= 72) return 'B';
  if (r >= 55) return 'C';
  if (r >= 40) return 'D';
  return 'F';
}

function percentileFromRating(r) {
  if (r >= 90) return 'Top 5% of drivers';
  if (r >= 85) return 'Top 10% of drivers';
  if (r >= 72) return 'Top 25% of drivers';
  if (r >= 55) return 'Average — top 50%';
  if (r >= 40) return 'Below average — bottom 40%';
  return 'Bottom 25% — needs significant improvement';
}

function openDriverReport() {
  saveDriverStats();
  _coachGenerated = false;
  switchReportTab('stats');
  const scores = computeScores();
  const rating = computeOverallRating();
  const grade  = gradeFromRating(rating);

  const gradeEl = document.getElementById('an-grade');
  gradeEl.textContent = grade;
  gradeEl.className = 'an-grade grade-' + grade;
  void gradeEl.offsetWidth;
  gradeEl.classList.add('animate');

  document.getElementById('an-overall').textContent = 'Overall: ' + rating + ' / 100';
  document.getElementById('an-percentile').textContent = percentileFromRating(rating);

  function setBar(id, pctId, val) {
    const fill = document.getElementById(id);
    const pct  = document.getElementById(pctId);
    const v = Math.round(val);
    fill.style.width = v + '%';
    fill.className = 'an-bar-fill ' + (v >= 80 ? 'good' : v >= 55 ? 'ok' : 'poor');
    pct.textContent = v + '%';
  }
  setBar('anb-smooth', 'anp-smooth', scores.smoothness);
  setBar('anb-stab',   'anp-stab',   scores.stability);
  setBar('anb-strafe', 'anp-strafe', scores.strafe);
  setBar('anb-turn',   'anp-turn',   scores.turn);
  setBar('anb-level',  'anp-level',  scores.levelScore);
  setBar('anb-recov',  'anp-recov',  scores.recovery);

  const breakdown = [
    { label: 'Smoothness',   val: scores.smoothness },
    { label: 'Stability',    val: scores.stability  },
    { label: 'Strafe Use',   val: scores.strafe     },
    { label: 'Turn Control', val: scores.turn       },
    { label: 'Path Acc.',    val: scores.levelScore },
    { label: 'Recovery',     val: scores.recovery   },
  ].sort((a, b) => b.val - a.val);

  const strEl = document.getElementById('an-strengths');
  const wkEl  = document.getElementById('an-weaknesses');
  const top2  = breakdown.slice(0, 2).filter(s => s.val >= 65);
  const bot2  = breakdown.slice(-2).filter(s => s.val < 60);

  strEl.innerHTML = top2.length
    ? '<div class="an-list">' + top2.map(s => `<div class="an-list-item"><span style="color:#4aff88">▲</span>${s.label} (${Math.round(s.val)}%)</div>`).join('') + '</div>'
    : '';
  wkEl.innerHTML = bot2.length
    ? '<div class="an-list">' + bot2.map(s => `<div class="an-list-item"><span style="color:#ff5544">▼</span>${s.label} (${Math.round(s.val)}%)</div>`).join('') + '</div>'
    : '';

  const worst = breakdown[breakdown.length - 1];
  const recommends = {
    'Smoothness':   'Practice gradual stick inputs instead of snapping to full power. Ease in and out of movements.',
    'Stability':    'Reduce rotation while translating. Try to separate your movement and turning inputs.',
    'Strafe Use':   drivetrain === 'mecanum' ? 'Use diagonal strafing to approach targets at efficient angles.' : 'Tank drive has no strafe — consider switching to mecanum for this drill.',
    'Turn Control': 'Use smaller, shorter rotation inputs. Aim to line up before committing to a long spin.',
    'Path Acc.':    'Focus on hitting waypoints cleanly. Slow down before each target and accelerate after.',
    'Recovery':     'When you miss a waypoint, react quickly. Try to stay mentally ahead of the next target.',
  };
  document.getElementById('an-recommend').textContent = recommends[worst.label] || '';

  const sessMs = performance.now() - driverMetrics.sessionStart;
  const sessSec = Math.floor(sessMs / 1000);
  document.getElementById('ans-time').textContent = Math.floor(sessSec/60) + ':' + String(sessSec%60).padStart(2,'0');
  document.getElementById('ans-lvls').textContent = driverMetrics.levelsCompleted;
  document.getElementById('ans-dist').textContent = Math.round(driverMetrics.totalDistance);
  document.getElementById('ans-inputs').textContent = driverMetrics.totalInputs;

  document.getElementById('analytics-backdrop').classList.add('open');
}

function closeDriverReport() {
  document.getElementById('analytics-backdrop').classList.remove('open');
}

function confirmResetMetrics() {
  if (confirm('Reset all driver analytics data?')) resetMetrics();
}

function resetMetrics() {
  driverMetrics = {
    sessionStart: performance.now(),
    totalDistance: 0, totalInputs: 0,
    jerkSum: 0, jerkFrames: 0, _prevAx: 0, _prevAy: 0,
    stabilityGoodFrames: 0, stabilityTotalFrames: 0, _prevHdg: 0,
    strafeSum: 0, strafeFrames: 0,
    turnJerkSum: 0, turnJerkFrames: 0,
    pathAccuracyHistory: [], levelsCompleted: 0,
    pendingReactionTs: null, reactionTimes: [],
    _hdgUnstable: false, _hdgUnstableStart: null,
    joystickJerkSum: 0, joystickJerkFrames: 0, joystickHeavyJerkFrames: 0,
    _prevLx: 0, _prevLy: 0, _prevRx: 0,
    strafeContamSum: 0, strafeContamFrames: 0,
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
  document.getElementById('ms-sess').textContent = Math.floor(sessSec/60) + ':' + String(sessSec%60).padStart(2,'0');
  const scores = computeScores();
  document.getElementById('ms-smooth').textContent = Math.round(scores.smoothness) + '%';
  const rating = computeOverallRating();
  document.getElementById('ms-rating').textContent = gradeFromRating(rating) + ' (' + rating + ')';
}
