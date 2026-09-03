// ── R-Tracker TeleOp — rule-based driver coach ────────────────────────────
// Every sentence here is a fixed template filled with numbers from
// js/driver-rating.js (level outcomes) and metrics.js (style diagnostics).
// Recommendations start from the weakest level group and fall back to style.

// window.RT_ICONS keys (js/sidebar.js), one per driver profile.
const PROFILE_ICONS = {
  'The Surgeon': 'target',
  'The Speedster': 'zap',
  'The Technician': 'settings',
  'The Adapter': 'shuffle',
  'The All-Rounder': 'star',
  'The Natural': 'sparkle',
  'The Rookie': 'shield',
  'The Cruiser': 'hourglass',
};
function profileIcon(name) {
  const icons = window.RT_ICONS || {};
  return icons[PROFILE_ICONS[name]] || icons.shield || '';
}

let _coachGenerated = false;

function generateCoachReport() {
  const scores = computeScores();
  const rr = currentRating();
  const rating = rr.rating;
  const groups = RTDriverRating.groupsByFocus(rr, RT_LEVEL_TABLE);
  const weakGroup = groups.length ? groups[0] : null;
  const strongGroup = groups.length > 1 ? groups[groups.length - 1] : null;
  const has = v => v !== null && v !== undefined;
  const at = k => scores.sufficient && has(scores[k]) ? scores[k] : null;
  const above = (k, th) => at(k) !== null && at(k) > th;
  const below = (k, th) => at(k) !== null && at(k) < th;

  const breakdown = scores.sufficient
    ? STYLE_ROWS.map(r => ({ label: r.label, val: scores[r.key], key: r.key })).filter(r => r.val !== null).sort((a, b) => b.val - a.val)
    : [];
  const weakSkill = breakdown.length ? breakdown[breakdown.length - 1] : null;
  const bot2 = breakdown.slice(-2);

  // Wall hits across the rated window
  let windowHits = 0;
  Object.keys(rr.levels).forEach(id => { windowHits += rr.levels[id].collisions || 0; });

  const levelIds = ids => listLevels(ids);
  const bandText = percentileFromRating(rating);
  const weakArea = weakGroup ? weakGroup.label : (weakSkill ? weakSkill.label.toLowerCase() : 'the fundamentals');

  let overallSummary;
  if (!rr.ratedLevels)
    overallSummary = 'No rated level runs in the last ' + rr.sessionsWindow + ' sessions yet. Complete a level in Levels mode to get a rating; par times decide it, not driving style.';
  else if (rating >= 90)
    overallSummary = `Beats par by a wide margin with clean lines on ${rr.ratedLevels} rated level${rr.ratedLevels === 1 ? '' : 's'}. Competition-ready pace. ${bandText}.`;
  else if (rating >= 80)
    overallSummary = `Ahead of par on most rated levels. A reliable competition driver with continued work on ${weakArea}. ${bandText}.`;
  else if (rating >= 65)
    overallSummary = `Around par. Not yet competition pace: ${weakGroup ? 'the ' + weakGroup.label + ' levels (' + weakGroup.levelIds.join(', ') + ') are where the time goes' : 'time is being lost across the rated levels'}. ${bandText}.`;
  else if (rating >= 50)
    overallSummary = `Behind par on most levels: finishing runs, but slowly or off the line. Work one level group at a time, starting with ${weakArea}. ${bandText}.`;
  else
    overallSummary = `Well behind par. Complete levels cleanly first, then build speed on ${weakArea}. ${bandText}.`;

  let driverProfile;
  const maxDiff = breakdown.length ? breakdown[0].val - breakdown[breakdown.length - 1].val : 0;
  if (!scores.sufficient)
    driverProfile = 'The Cruiser — Most of this session was under 60% of max speed, so there is no style read yet. Push the pace to unlock a profile.';
  else if (above('smoothness', 80) && above('stability', 80))
    driverProfile = 'The Surgeon — Precise, controlled, methodical. You prioritize accuracy over speed.';
  else if (above('recovery', 80) && above('smoothness', 70))
    driverProfile = 'The Natural — Quick reflexes combined with smooth control. A gifted driver.';
  else if (above('strafe', 80) && above('turn', 80))
    driverProfile = 'The Technician — Excellent mechanical skills. You handle complex maneuvers with ease.';
  else if (above('recovery', 80))
    driverProfile = 'The Adapter — Quick to recover from mistakes. You stay calm under pressure and adjust on the fly.';
  else if (breakdown.length >= 3 && maxDiff < 12)
    driverProfile = 'The All-Rounder — Consistent across all skills. No major weaknesses but no standout strengths either.';
  else if (below('smoothness', 60) && rating > 55)
    driverProfile = 'The Speedster — Fast and aggressive, but frequently sacrifices control for speed.';
  else
    driverProfile = 'The Rookie — Still developing a driving style. Keep practicing to discover your strengths.';

  const parts = [];
  if (rr.ratedLevels) {
    let lead = `Rated on ${rr.ratedLevels} level${rr.ratedLevels === 1 ? '' : 's'} over the last ${rr.sessionsInWindow} session${rr.sessionsInWindow === 1 ? '' : 's'}.`;
    if (weakGroup) lead += ` Slowest relative to par: ${weakGroup.label} (${levelIds(weakGroup.levelIds)}) at ${Math.round(weakGroup.meanParRatio * 100)}% of par pace.`;
    if (strongGroup && strongGroup !== weakGroup) lead += ` Fastest: ${strongGroup.label} (${levelIds(strongGroup.levelIds)}) at ${Math.round(strongGroup.meanParRatio * 100)}% of par pace.`;
    if (windowHits > 0) lead += ` ${windowHits} wall hit${windowHits === 1 ? '' : 's'} cost ${windowHits * 5} run-score points across those sessions.`;
    else lead += ' No wall hits in the rated runs.';
    parts.push(lead);
  }

  if (!scores.sufficient) {
    parts.push(`Only ${Math.round(scores.atSpeedFraction * 100)}% of this session was driven at 60% of max speed or more, so the style diagnostics are not scored. They unlock at 20%.`);
  } else {
    const sm = at('smoothness');
    if (sm !== null) {
      if (sm >= 80) parts.push('Joystick inputs at speed are smooth and controlled, with very few sudden stick snaps.');
      else if (sm >= 65) parts.push('Input smoothness at speed is acceptable but shows jerky moments on direction changes. Ease in and out of full deflection rather than snapping.');
      else if (sm >= 50) parts.push('Joystick inputs at speed are frequently jerky and the robot lurches on direction changes. Blend the stick through changes instead of snapping.');
      else parts.push('Joystick control at speed is a critical weakness: heavy, sudden input changes make the robot unpredictable exactly when it matters.');
    }
    const stb = at('stability');
    if (stb !== null) {
      if (stb >= 80) parts.push('Heading control at speed is excellent: straight-line tracking with minimal drift.');
      else if (stb >= 65) parts.push('Heading drifts a little during fast straights. The rotation stick is being touched while translating; keep the two inputs separate.');
      else if (stb >= 50) parts.push('Significant heading instability at speed: the robot drifts off-course on straights. Drill straight-line driving at full speed with zero rotation input.');
      else parts.push('Heading stability at speed is a critical weakness: the robot rotates substantially while trying to drive straight.');
    }
    const st = at('strafe');
    if (st !== null) {
      if (st >= 80) parts.push('Strafing at speed is clean with minimal forward or backward drift.');
      else if (st >= 65) parts.push('Strafes carry some forward or backward drift. Keep the left stick on the horizontal axis during lateral moves.');
      else parts.push('Strafes at speed drift forward or backward noticeably. Practise pure left/right stick inputs until the robot moves in clean lateral lines.');
    }
    const ov = at('turn') !== null ? scores.turnOvershootDeg : null;
    if (ov !== null) {
      const d = Math.round(ov);
      if (d <= 5) parts.push(`Turns land where you release them: the average correction after a fast turn is ${d}°.`);
      else if (d <= 12) parts.push(`Fast turns overshoot by about ${d}° and need a correction. Release the rotation stick a little earlier.`);
      else if (d <= 20) parts.push(`Turns overshoot by about ${d}°: you release late and spin back. Aim to release about two-thirds of the way through the turn and let the robot coast onto the heading.`);
      else parts.push(`Turns overshoot by ${d}° on average: nearly every fast turn needs a large correction. Practise 90° turns at speed, releasing early and coasting onto the heading.`);
    }
    const rc = at('recovery');
    if (rc !== null) {
      if (rc >= 80) parts.push('Reaction speed at pace is excellent: the next target is picked up almost instantly.');
      else if (rc >= 65) parts.push('Reaction to the next target is adequate but slower than a competition driver. Anticipate the next waypoint before you arrive at the current one.');
      else parts.push('Reaction time is slow: there is a noticeable delay between reaching a target and moving to the next one. Read the path ahead.');
    }
  }
  const detailedAnalysis = parts.join(' ');

  const strengthDescMap = {
    'Smoothness': 'Smooth, deliberate stick inputs at speed',
    'Stability': 'Strong straight-line tracking with minimal heading drift',
    'Strafe Use': 'Clean lateral movement at speed',
    'Turn Precision': 'Fast turns land on the heading with little correction',
    'Recovery': 'Quick pick-up of the next target',
  };
  const weaknessDescMap = {
    'Smoothness': 'Jerky stick inputs at speed causing unpredictable movement',
    'Stability': 'Heading drift during fast straights',
    'Strafe Use': 'Forward or backward drift during strafes',
    'Turn Precision': 'Fast turns overshoot and need a correction',
    'Recovery': 'Slow to move on to the next target',
  };
  const strengths = [], weaknesses = [];
  const ahead = [], behind = [];
  Object.keys(rr.levels).map(Number).sort((a, b) => a - b).forEach(id => {
    const lv = rr.levels[id];
    if (!lv.counted) return;
    if (lv.parRatio >= 1.15) ahead.push(id);
    else if (lv.parRatio < 0.85 || lv.levelScore < 50) behind.push(id);
  });
  if (ahead.length) strengths.push('Ahead of par on ' + levelIds(ahead));
  if (behind.length) weaknesses.push('Behind par on ' + levelIds(behind));
  breakdown.slice(0, 2).filter(s => s.val >= 65).forEach(s => strengths.push(strengthDescMap[s.label] || s.label));
  bot2.filter(s => s.val < 70).forEach(s => weaknesses.push(weaknessDescMap[s.label] || s.label));
  if (windowHits > 0) weaknesses.push(`${windowHits} wall hit${windowHits === 1 ? '' : 's'} in the rated runs`);

  const trainingPlan = [];
  if (weakGroup) {
    trainingPlan.push(`Drill ${levelIds(weakGroup.levelIds)} (${weakGroup.label}): ${FOCUS_HINTS[weakGroup.focus] || ''}`.trim());
    const slowest = weakGroup.levelIds.map(id => rr.levels[id]).sort((a, b) => a.levelScore - b.levelScore)[0];
    if (slowest && slowest.bestTimeMs) trainingPlan.push(`Target on Level ${slowest.levelId} "${slowest.name}": par is ${(slowest.parTimeMs / 1000).toFixed(1)}s; your best is ${(slowest.bestTimeMs / 1000).toFixed(1)}s.`);
  } else if (!rr.ratedLevels) {
    trainingPlan.push('Complete Levels 1 to 3 to get rated. A clean finish at par scores 70 on a run; beating par is where the points are.');
  }
  if (weakSkill) {
    switch (weakSkill.key) {
      case 'smoothness':
        trainingPlan.push('Drive Levels 1 and 2 at full speed, blending the stick through every direction change instead of snapping it.');
        break;
      case 'stability':
        trainingPlan.push('Drive full-speed straights end to end in Free Drive and keep the heading within 2 degrees without touching the rotation stick.');
        break;
      case 'strafe':
        trainingPlan.push('Practise pure strafing at speed in Free Drive: left and right only, zero forward input, then repeat Level 2 "Side Step".');
        break;
      case 'turn':
        trainingPlan.push('Practise 90°, 180° and 360° turns at full rotation rate in Free Drive, releasing early so the robot coasts onto the heading.');
        break;
      case 'recovery':
        trainingPlan.push('On Level 4 "The Square", be moving toward the next corner before the current checkpoint registers.');
        break;
    }
  }
  if (rr.ratedLevels && rr.accuracyMean < 85) {
    trainingPlan.push('Path accuracy is costing run score: aim to stay inside the corridor for 90% or more of each run before adding speed.');
  }
  if (windowHits > 0) trainingPlan.push('Brake before the walls: every wall hit costs 5 run-score points.');
  trainingPlan.push('Aim for 15+ minutes of focused practice per session. Quality repetitions matter more than time spent.');

  const r0 = v => (v === null || v === undefined) ? null : Math.round(v);
  return {
    overallSummary, letterGrade: rr.grade, overallScore: rating,
    percentile: bandText, strengths, weaknesses,
    detailedAnalysis, trainingPlan, driverProfile,
    ratedLevels: rr.ratedLevels,
    scores: {
      smoothness: r0(at('smoothness')), stability: r0(at('stability')),
      strafe: r0(at('strafe')), turn: r0(at('turn')),
      levelScore: rr.accuracyMean, recovery: r0(at('recovery')),
      turnOvershootDeg: at('turn') !== null ? Math.round(scores.turnOvershootDeg * 10) / 10 : null,
      atSpeedFraction: Math.round(scores.atSpeedFraction * 100) / 100,
    },
    comparisonToLast: null,
  };
}

let _typewriterTimer = null;
function typewriter(el, text, speedMs, onDone) {
  if (_typewriterTimer) clearInterval(_typewriterTimer);
  el.innerHTML = '';
  const cursor = document.createElement('span');
  cursor.className = 'coach-cursor';
  el.appendChild(cursor);
  let i = 0;
  _typewriterTimer = setInterval(() => {
    cursor.insertAdjacentText('beforebegin', text[i]);
    i++;
    if (i >= text.length) {
      clearInterval(_typewriterTimer); _typewriterTimer = null;
      setTimeout(() => cursor.remove(), 800);
      if (onDone) onDone();
    }
  }, speedMs);
}

function staggerCoachSections(baseDelay) {
  const sections = document.querySelectorAll('#an-coach-panel .coach-section');
  sections.forEach((el, i) => {
    el.classList.remove('visible');
    setTimeout(() => el.classList.add('visible'), baseDelay + i * 120);
  });
}

function switchReportTab(tab) {
  document.getElementById('tab-stats').classList.toggle('active', tab === 'stats');
  document.getElementById('tab-coach').classList.toggle('active', tab === 'coach');
  document.getElementById('an-stats-panel').style.display = tab === 'stats' ? 'block' : 'none';
  document.getElementById('an-coach-panel').style.display = tab === 'coach' ? 'block' : 'none';

  if (tab === 'coach' && !_coachGenerated) {
    _coachGenerated = true;
    renderCoachPanel();
  }
}

function renderCoachPanel() {
  // Show helpful empty state if there is neither driving this session nor a rated run on record
  if (driverMetrics.totalInputs < 10 && !currentRating().ratedLevels) {
    var panel = document.getElementById('an-coach-panel');
    if (panel) {
      panel.innerHTML = '<div class="coach-empty">' +
        '<span class="coach-empty-icon">' + ((window.RT_ICONS && window.RT_ICONS.target) || '') + '</span>' +
        '<h3>Coach Analysis</h3>' +
        '<p>Complete a level, or drive for at least 30 seconds. The coach reads your level times against par, then your driving style at speed, and builds a training plan from the weakest area.</p>' +
        '<p class="coach-empty-sub">Press Start, then drive around the field using your gamepad or keyboard.</p>' +
        '</div>';
    }
    _coachGenerated = false; // Allow re-render after driving
    return;
  }

  const report = generateCoachReport();

  const profileKey = report.driverProfile.split(' — ')[0];
  document.getElementById('coach-profile-icon').innerHTML = profileIcon(profileKey);
  document.getElementById('coach-profile-name').textContent = report.driverProfile;
  document.getElementById('coach-analysis-text').textContent = report.detailedAnalysis;

  const strEl = document.getElementById('coach-strengths-list');
  strEl.innerHTML = report.strengths.length
    ? report.strengths.map(s =>
      `<div class="coach-check-item"><span class="coach-check-icon is-good">&#10003;</span>${s}</div>`
    ).join('')
    : '<div class="coach-check-item coach-check-muted">Keep practicing to unlock strengths data.</div>';

  const wkEl = document.getElementById('coach-weaknesses-list');
  wkEl.innerHTML = report.weaknesses.length
    ? report.weaknesses.map(s =>
      `<div class="coach-check-item"><span class="coach-check-icon is-warn">&#9888;</span>${s}</div>`
    ).join('')
    : '<div class="coach-check-item coach-check-muted">No significant weak points identified.</div>';

  const planEl = document.getElementById('coach-plan-list');
  planEl.innerHTML = report.trainingPlan.map((item, i) =>
    `<div class="coach-plan-item"><span class="coach-plan-num">${i + 1}.</span>${item}</div>`
  ).join('');

  document.getElementById('coach-comparison-content').textContent = 'Loading previous data...';

  staggerCoachSections(0);
  setTimeout(() => {
    typewriter(document.getElementById('coach-summary-text'), report.overallSummary, 9);
  }, 200);

  saveCoachReport(report);          // js/teleop/persist.js → RTStore (stays in the browser)
  renderCoachComparison(report);
  if (typeof window.rtNudgeExport === 'function') window.rtNudgeExport('Report saved — export your progress so you don\'t lose it.');
}

// Compare this report with the previous stored one (if any).
function renderCoachComparison(currentReport) {
  const compEl = document.getElementById('coach-comparison-content');
  const prev = getPreviousCoachReport();
  if (!prev) {
    compEl.textContent = 'No previous session data yet — come back after your next practice!';
    return;
  }

  const cur = currentReport;
  const ratingDelta = cur.overallScore - (prev.overallScore || 0);
  const rows = [];

  const rSign = ratingDelta > 0 ? '+' : '';
  const rCls = ratingDelta > 0 ? 'coach-cmp-up' : ratingDelta < 0 ? 'coach-cmp-down' : 'coach-cmp-neu';
  const rArr = ratingDelta > 0 ? '&#9650;' : ratingDelta < 0 ? '&#9660;' : '&#9679;';
  rows.push(`<div class="coach-comparison-row">Overall Rating: ${typeof prev.overallScore === 'number' ? prev.overallScore : '—'} &rarr; ${cur.overallScore}<span class="${rCls}">${rArr} ${rSign}${ratingDelta}</span></div>`);

  const skillKeys = ['smoothness', 'stability', 'strafe', 'turn', 'levelScore', 'recovery'];
  const skillNames = { smoothness: 'Smoothness', stability: 'Stability', strafe: 'Strafe', turn: 'Turn Prec.', levelScore: 'Path Acc.', recovery: 'Recovery' };
  for (const key of skillKeys) {
    const pv = prev.scores ? prev.scores[key] : null;
    const cv = cur.scores ? cur.scores[key] : null;
    if (typeof pv !== 'number' || typeof cv !== 'number') continue;   // no reading on one side
    const d = cv - pv;
    if (d === 0) continue;
    const cls = d > 0 ? 'coach-cmp-up' : 'coach-cmp-down';
    const arr = d > 0 ? '&#9650;' : '&#9660;';
    const sign = d > 0 ? '+' : '';
    const note = d < 0 ? ' — needs attention' : '';
    rows.push(`<div class="coach-comparison-row">${skillNames[key]}: ${pv} &rarr; ${cv}<span class="${cls}">${arr} ${sign}${d}</span>${note ? `<span class="coach-cmp-note">${note}</span>` : ''}</div>`);
  }

  compEl.innerHTML = rows.length ? rows.join('') : '<div class="coach-comparison-row">No change from your previous session.</div>';
}
