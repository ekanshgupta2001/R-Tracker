// ── R-Tracker TeleOp — AI Driver Coach ───────────────────────────────────

const PROFILE_ICONS = {
  'The Surgeon': '🎯',
  'The Speedster': '⚡',
  'The Technician': '⚙️',
  'The Adapter': '🔄',
  'The All-Rounder': '⭐',
  'The Natural': '🌟',
  'The Rookie': '🔰',
};

let _coachGenerated = false;

function generateCoachReport() {
  const scores = computeScores();
  const rating = computeOverallRating();
  const m = driverMetrics;
  const name = (window.rtUser && (window.rtUser.displayName || window.rtUser.email.split('@')[0])) || 'Driver';

  const breakdown = [
    { label: 'Smoothness', val: scores.smoothness, key: 'smoothness' },
    { label: 'Stability', val: scores.stability, key: 'stability' },
    { label: 'Strafe Use', val: scores.strafe, key: 'strafe' },
    { label: 'Turn Control', val: scores.turn, key: 'turn' },
    { label: 'Path Accuracy', val: scores.levelScore, key: 'levelScore' },
    { label: 'Recovery Speed', val: scores.recovery, key: 'recovery' },
  ].sort((a, b) => b.val - a.val);

  const topSkill = breakdown[0];
  const weakSkill = breakdown[breakdown.length - 1];
  const bot2 = breakdown.slice(-2);

  const percentileText = percentileFromRating(rating);
  let overallSummary;
  if (rating >= 90)
    overallSummary = `An elite-level driver with exceptional control across all areas. Competition-ready and capable of performing under pressure. One of the top drivers this system has evaluated. ${percentileText}.`;
  else if (rating >= 80)
    overallSummary = `A strong driver with solid fundamentals across the board. Could be a reliable competition driver with continued practice on ${weakSkill.label.toLowerCase()}. ${percentileText}.`;
  else if (rating >= 65)
    overallSummary = `An average driver with noticeable gaps in some areas. Not yet competition-ready. Needs dedicated practice on ${bot2.map(s => s.label.toLowerCase()).join(' and ')} before being trusted in a match. ${percentileText}.`;
  else if (rating >= 50)
    overallSummary = `A developing driver with significant room for improvement. Multiple fundamental skills need work. Should spend at least 30 minutes of focused practice daily on the recommended training plan. ${percentileText}.`;
  else
    overallSummary = `Currently not ready for competition driving. Core skills like ${bot2.map(s => s.label.toLowerCase()).join(' and ')} are below acceptable levels. Start with Tier 1 levels and Free Drive basics. Focus on slow, controlled movements before attempting speed. ${percentileText}.`;

  let driverProfile;
  const maxDiff = breakdown[0].val - breakdown[breakdown.length - 1].val;
  if (scores.smoothness > 80 && scores.stability > 80)
    driverProfile = 'The Surgeon — Precise, controlled, methodical. You prioritize accuracy over speed.';
  else if (scores.recovery > 80 && scores.smoothness > 70)
    driverProfile = 'The Natural — Quick reflexes combined with smooth control. A gifted driver.';
  else if (scores.strafe > 80 && scores.turn > 80)
    driverProfile = 'The Technician — Excellent mechanical skills. You handle complex maneuvers with ease.';
  else if (scores.recovery > 80)
    driverProfile = 'The Adapter — Quick to recover from mistakes. You stay calm under pressure and adjust on the fly.';
  else if (maxDiff < 12)
    driverProfile = 'The All-Rounder — Consistent across all skills. No major weaknesses but no standout strengths either.';
  else if (scores.smoothness < 60 && rating > 55)
    driverProfile = 'The Speedster — Fast and aggressive, but frequently sacrifices control for speed.';
  else
    driverProfile = 'The Rookie — Still developing a driving style. Keep practicing to discover your strengths.';

  const parts = [];
  if (scores.smoothness >= 80) parts.push('Joystick inputs are exceptionally smooth and controlled, indicating a calm and deliberate driving style. Very few sudden stick snaps detected.');
  else if (scores.smoothness >= 65) parts.push('Input smoothness is acceptable but shows noticeable jerky moments — particularly on direction changes. Better drivers ease in and out of full deflection rather than snapping.');
  else if (scores.smoothness >= 50) parts.push('Joystick inputs are frequently jerky. Sudden large stick movements are causing the robot to lurch unpredictably. Practice making slow, deliberate movements and avoid snapping to full power.');
  else parts.push('Joystick control is a critical weakness. Heavy, sudden input changes throughout the session are severely harming robot predictability. Start with 50% max speed and focus entirely on gradual stick movement before anything else.');

  if (scores.stability >= 80) parts.push('Heading control is excellent — the robot maintains straight-line tracking with minimal drift. Very little unintended rotation while translating.');
  else if (scores.stability >= 65) parts.push('Heading shows some drift during straight-line movement. The rotation stick is being used while translating more than necessary. Try to completely separate movement and turning inputs.');
  else if (scores.stability >= 50) parts.push('Significant heading instability detected. The robot drifts noticeably off-course during straight drives. This will hurt precision severely in competition. Drill straight-line driving with zero rotation input.');
  else parts.push('Heading stability is a critical weakness. The robot is spinning substantially while trying to drive straight. This is typically caused by accidental rotation inputs or over-correction. Focus exclusively on clean straight-line driving in Free Drive.');

  if (scores.strafe >= 80) parts.push('Strafing is clean with minimal unintended forward/backward drift. Near-perfect mecanum control during lateral movement.');
  else if (scores.strafe >= 65) parts.push('Strafing shows some forward/backward contamination — the robot drifts slightly while trying to move purely sideways. Aim to isolate the left stick completely to the horizontal axis during strafes.');
  else if (scores.strafe >= 50) parts.push('Strafing accuracy needs work. There is significant unintended forward/backward drift when moving laterally. Practice pure horizontal stick inputs in Free Drive until the robot moves in clean straight lateral lines.');
  else parts.push('Strafing is severely contaminated with forward/backward drift. This suggests mixed stick inputs during lateral movement. Practice holding the stick at exactly 90° (pure left/right) with no vertical component.');

  if (scores.turn >= 80) parts.push('Turns are smooth and precise — the driver demonstrates excellent deceleration out of rotations with minimal overshoot.');
  else if (scores.turn >= 65) parts.push('Turning is functional but shows some overshooting of target headings and imprecise rotation control. Use shorter, lighter rotation inputs and anticipate the robot stopping.');
  else if (scores.turn >= 50) parts.push('Turn control is poor. The robot frequently over-rotates and requires correction. This eats up time and path accuracy in levels. Practice stopping the rotation stick earlier than you think you need to.');
  else parts.push('Turns are a critical weak point. Continuous large rotation inputs are causing the robot to spin past target headings repeatedly. Practice rotating in 90° increments — nothing more, nothing less — until precision improves.');

  if (scores.recovery >= 80) parts.push('Excellent reaction speed — when deviating from the ideal path, corrections are near-instant and decisive.');
  else if (scores.recovery >= 65) parts.push('Reaction time to path deviations is adequate but slower than elite drivers. Work on anticipating the next waypoint before you arrive at the current one.');
  else if (scores.recovery >= 50) parts.push('Reaction time is slow. There is a noticeable delay between missing a waypoint and beginning to correct. In competition this translates directly to slower cycle times. Aim to start moving toward the next target within 300ms of hitting the current one.');
  else parts.push("Reaction speed is a critical weakness. Very long delays between hitting a checkpoint and moving to the next one are being recorded. Focus on reading the path ahead — always know where you're going before you arrive.");

  const detailedAnalysis = parts.join(' ');

  const strengthDescMap = {
    'Smoothness': 'Excellent joystick control with gradual, deliberate inputs',
    'Stability': 'Strong straight-line tracking with minimal heading drift',
    'Strafe Use': 'Clean lateral movement with precise mecanum control',
    'Turn Control': 'Smooth, accurate rotation with minimal overshoot',
    'Path Accuracy': 'Stays tight on planned routes through waypoints',
    'Recovery Speed': 'Quick, decisive error correction when off-path',
  };
  const strengths = breakdown.slice(0, 2).filter(s => s.val >= 65).map(s => strengthDescMap[s.label] || s.label);

  const weaknessDescMap = {
    'Smoothness': 'Jerky stick inputs causing unpredictable robot movement',
    'Stability': 'Heading drift during straight-line movement',
    'Strafe Use': 'Unintended forward/backward drift during lateral movement',
    'Turn Control': 'Rotation overshooting target headings',
    'Path Accuracy': 'Drifting outside the ideal path corridor',
    'Recovery Speed': 'Slow to recognize and correct path deviations',
  };
  const weaknesses = breakdown.slice(-2).filter(s => s.val < 70).map(s => weaknessDescMap[s.label] || s.label);

  const trainingPlan = [];
  switch (weakSkill.key) {
    case 'smoothness':
      trainingPlan.push('Warm-up drill: Drive Levels 1 and 2 using only 50% stick deflection for 5 minutes');
      trainingPlan.push('Practice making gradual figure-8 patterns in Free Drive — focus on never slamming the stick');
      break;
    case 'stability':
      trainingPlan.push('Drive straight lines from one end of the field to the other. Try to keep heading within 2 degrees');
      trainingPlan.push('Complete Level 1 "Straight Shot" 10 times consecutively, aiming for gold on each');
      break;
    case 'strafe':
      trainingPlan.push('Practice pure strafing in Free Drive — move only left/right with zero forward/backward input');
      trainingPlan.push('Complete Level 2 "Side Step" 10 times aiming for 90%+ accuracy');
      break;
    case 'turn':
      trainingPlan.push('Practice rotating exactly 90°, then 180°, then 360° in Free Drive');
      trainingPlan.push('Complete Level 6 "Diamond" which requires precise turns at each corner');
      break;
    case 'recovery':
      trainingPlan.push('Practice Level 4 "The Square" — anticipate the next waypoint before reaching the current one');
      trainingPlan.push("Look ahead on the path — don't wait until you hit a waypoint to think about the next direction");
      break;
    default:
      trainingPlan.push('Work through all Tier 1 levels aiming for gold to build consistency on the fundamentals');
  }
  if (scores.levelScore < 75) {
    trainingPlan.push('Focus on Path Accuracy — aim to stay within the green corridor for 90%+ of each level attempt');
  }
  trainingPlan.push('Aim for 15+ minutes of focused practice per session. Quality repetitions matter more than time spent.');

  return {
    overallSummary, letterGrade: gradeFromRating(rating), overallScore: rating,
    percentile: percentileFromRating(rating), strengths, weaknesses,
    detailedAnalysis, trainingPlan, driverProfile,
    scores: {
      smoothness: Math.round(scores.smoothness), stability: Math.round(scores.stability),
      strafe: Math.round(scores.strafe), turn: Math.round(scores.turn),
      levelScore: Math.round(scores.levelScore), recovery: Math.round(scores.recovery),
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
  document.getElementById('an-stats-panel').style.display = tab === 'stats' ? '' : 'none';
  document.getElementById('an-coach-panel').style.display = tab === 'coach' ? '' : 'none';

  if (tab === 'coach' && !_coachGenerated) {
    _coachGenerated = true;
    renderCoachPanel();
  }
}

function renderCoachPanel() {
  const report = generateCoachReport();

  const profileKey = report.driverProfile.split(' — ')[0];
  document.getElementById('coach-profile-icon').textContent = PROFILE_ICONS[profileKey] || '🔰';
  document.getElementById('coach-profile-name').textContent = report.driverProfile;
  document.getElementById('coach-analysis-text').textContent = report.detailedAnalysis;

  const strEl = document.getElementById('coach-strengths-list');
  strEl.innerHTML = report.strengths.length
    ? report.strengths.map(s =>
      `<div class="coach-check-item"><span class="coach-check-icon" style="color:#4aff88">&#10003;</span>${s}</div>`
    ).join('')
    : '<div class="coach-check-item" style="color:#445">Keep practicing to unlock strengths data.</div>';

  const wkEl = document.getElementById('coach-weaknesses-list');
  wkEl.innerHTML = report.weaknesses.length
    ? report.weaknesses.map(s =>
      `<div class="coach-check-item"><span class="coach-check-icon" style="color:#ff8844">&#9888;</span>${s}</div>`
    ).join('')
    : '<div class="coach-check-item" style="color:#445">No significant weak points identified.</div>';

  const planEl = document.getElementById('coach-plan-list');
  planEl.innerHTML = report.trainingPlan.map((item, i) =>
    `<div class="coach-plan-item"><span class="coach-plan-num">${i + 1}.</span>${item}</div>`
  ).join('');

  document.getElementById('coach-comparison-content').textContent = 'Loading previous data...';

  staggerCoachSections(0);
  setTimeout(() => {
    typewriter(document.getElementById('coach-summary-text'), report.overallSummary, 9);
  }, 200);

  saveCoachReportToFirestore(report);
  loadPreviousCoachReport(report);
}

async function saveCoachReportToFirestore(report) {
  if (!window.rtUser) return;
  try {
    const ts = Date.now();
    await rtDb.collection('users').doc(rtUser.uid)
      .collection('coachReports').doc(String(ts)).set({
        ...report,
        comparisonToLast: null,
        generatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        metricsSnapshot: {
          totalDistance: Math.round(driverMetrics.totalDistance),
          totalInputs: driverMetrics.totalInputs,
          levelsCompleted: driverMetrics.levelsCompleted,
          sessionMs: Math.round(performance.now() - driverMetrics.sessionStart),
        },
      });

    const name = rtUser.displayName || rtUser.email.split('@')[0];
    var teamId = window.rtUserTeamId;
    if (!teamId) { console.warn('No teamId, skipping activity write'); return; }
    await rtDb.collection('teams').doc(teamId).collection('activity').doc(String(ts)).set({
      userName: name,
      action: `generated a new AI driver report`,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn('Failed to save coach report:', e.message);
  }
}

async function loadPreviousCoachReport(currentReport) {
  const compEl = document.getElementById('coach-comparison-content');
  if (!window.rtUser) { compEl.textContent = 'Sign in to track progress over time.'; return; }
  try {
    const snap = await rtDb.collection('users').doc(rtUser.uid)
      .collection('coachReports').orderBy('generatedAt', 'desc').limit(2).get();

    if (snap.size < 2) {
      compEl.textContent = 'No previous session data yet — come back after your next practice!';
      return;
    }

    const prev = snap.docs[1].data();
    const cur = currentReport;
    const ratingDelta = cur.overallScore - (prev.overallScore || 0);
    const rows = [];

    const rSign = ratingDelta > 0 ? '+' : '';
    const rCls = ratingDelta > 0 ? 'coach-cmp-up' : ratingDelta < 0 ? 'coach-cmp-down' : 'coach-cmp-neu';
    const rArr = ratingDelta > 0 ? '&#9650;' : ratingDelta < 0 ? '&#9660;' : '&#9679;';
    rows.push(`<div class="coach-comparison-row">Overall Rating: ${prev.overallScore || '—'} &rarr; ${cur.overallScore}<span class="${rCls}">${rArr} ${rSign}${ratingDelta}</span></div>`);

    const skillKeys = ['smoothness', 'stability', 'strafe', 'turn', 'levelScore', 'recovery'];
    const skillNames = { smoothness: 'Smoothness', stability: 'Stability', strafe: 'Strafe', turn: 'Turn Ctrl', levelScore: 'Path Acc.', recovery: 'Recovery' };
    for (const key of skillKeys) {
      const pv = prev.scores ? (prev.scores[key] || 0) : 0;
      const cv = cur.scores ? (cur.scores[key] || 0) : 0;
      const d = cv - pv;
      if (d === 0) continue;
      const cls = d > 0 ? 'coach-cmp-up' : 'coach-cmp-down';
      const arr = d > 0 ? '&#9650;' : '&#9660;';
      const sign = d > 0 ? '+' : '';
      const note = d < 0 ? ' — needs attention' : '';
      rows.push(`<div class="coach-comparison-row">${skillNames[key]}: ${pv} &rarr; ${cv}<span class="${cls}">${arr} ${sign}${d}</span>${note ? `<span style="color:#556;font-size:10px">${note}</span>` : ''}</div>`);
    }

    compEl.innerHTML = rows.join('');
  } catch (e) {
    compEl.textContent = 'Could not load previous session data.';
    console.warn('Failed to load previous coach report:', e.message);
  }
}
