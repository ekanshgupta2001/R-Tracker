// ── R-Tracker TeleOp — Levels ─────────────────────────────────────────────

const LVL_CP_RADIUS = 0.5;
const LVL_ACC_TOL   = 1 / 3;

const LEVELS = [
  // Tier 1: Beginner
  { id:1,  tier:'Beginner',     name:'Straight Shot',          timeLimit:5,  path:[{x:0,y:-4,h:0},{x:0,y:4,h:0}] },
  { id:2,  tier:'Beginner',     name:'Side Step',              timeLimit:5,  path:[{x:-3,y:0,h:90},{x:3,y:0,h:90}] },
  { id:3,  tier:'Beginner',     name:'L-Shape',                timeLimit:7,  path:[{x:-4,y:-4,h:0},{x:-4,y:3,h:90},{x:4,y:3,h:90}] },
  // Tier 2: Intermediate
  { id:4,  tier:'Intermediate', name:'The Square',             timeLimit:10, path:[{x:-4,y:-4,h:0},{x:-4,y:4,h:90},{x:4,y:4,h:180},{x:4,y:-4,h:-90},{x:-4,y:-4,h:-90}] },
  { id:5,  tier:'Intermediate', name:'Zigzag',                 timeLimit:10, path:[{x:-5,y:-4,h:45},{x:-1,y:0,h:-63},{x:-5,y:2,h:63},{x:-1,y:4,h:-67},{x:-5,y:5.67,h:-67}] },
  { id:6,  tier:'Intermediate', name:'Diamond',                timeLimit:12, path:[{x:0,y:-5,h:39},{x:4,y:0,h:-39},{x:0,y:5,h:-141},{x:-4,y:0,h:141},{x:0,y:-5,h:141}] },
  // Tier 3: Advanced
  { id:7,  tier:'Advanced',     name:'Specimen Run',           timeLimit:10, path:[{x:-4,y:-5,h:0},{x:-4,y:4,h:90},{x:0,y:4,h:180},{x:0,y:-5,h:90},{x:4,y:-5,h:90}] },
  { id:8,  tier:'Advanced',     name:'Sample Collect',         timeLimit:10, path:[{x:-5,y:-5,h:18},{x:-3,y:1,h:135},{x:0,y:-2,h:45},{x:3,y:1,h:162},{x:5,y:-5,h:162}] },
  { id:9,  tier:'Advanced',     name:'Spiral In',              timeLimit:14, path:[{x:-5,y:-5,h:0},{x:-5,y:5,h:90},{x:5,y:5,h:180},{x:5,y:-3,h:-90},{x:-2,y:-3,h:0},{x:-2,y:2,h:90},{x:2,y:2,h:90}] },
  // Tier 4: Expert
  { id:10, tier:'Expert',       name:'Speed Demon',            timeLimit:10, path:[{x:-5,y:-5,h:45},{x:5,y:5,h:-90},{x:-5,y:5,h:135},{x:5,y:-5,h:-45},{x:0,y:0,h:-45}] },
  { id:11, tier:'Expert',       name:'Threading the Needle',   timeLimit:14, path:[{x:-5,y:0,h:27},{x:-3,y:4,h:143},{x:0,y:0,h:37},{x:3,y:4,h:153},{x:5,y:0,h:-153},{x:3,y:-4,h:-37},{x:0,y:0,h:-143},{x:-3,y:-4,h:-27},{x:-5,y:0,h:-27}] },
  { id:12, tier:'Expert',       name:'The Gauntlet',           timeLimit:16, path:[{x:-5,y:-5,h:0},{x:-5,y:5,h:135},{x:-2,y:2,h:34},{x:0,y:5,h:146},{x:2,y:2,h:45},{x:5,y:5,h:180},{x:5,y:-5,h:-45},{x:2,y:-2,h:-146},{x:0,y:-5,h:-34},{x:-2,y:-2,h:-135},{x:-5,y:-5,h:-135}] },
];

let appMode = 'freedrive';
let completedLevels = {};
let lvl = {
  phase: 'select',
  id: null,
  countdownVal: 3,
  countdownTs: 0,
  elapsed: 0,
  nextCp: 1,
  cpCooldown: 0,
  accInside: 0,
  accFrames: 0,
  ghostT: 0,
};

// ── Angle Helpers ─────────────────────────────────────────────────────────
function normAngle(a) { return ((a + 180) % 360 + 360) % 360 - 180; }
function lerpAngle(a, b, t) { return a + normAngle(b - a) * t; }

function ghostHeadingAtT(path, t) {
  const { lens, total } = pathSegLengths(path);
  let dist = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < path.length - 1; i++) {
    if (dist <= lens[i] + 1e-9) {
      const frac = lens[i] > 0 ? dist / lens[i] : 0;
      return lerpAngle(path[i].h, path[i + 1].h, frac);
    }
    dist -= lens[i];
  }
  return path[path.length - 1].h;
}

// ── Path Helpers ──────────────────────────────────────────────────────────
function pathSegLengths(path) {
  const lens = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = Math.hypot(path[i+1].x - path[i].x, path[i+1].y - path[i].y);
    lens.push(d); total += d;
  }
  return { lens, total };
}

function posAtT(path, t) {
  const { lens, total } = pathSegLengths(path);
  let dist = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < path.length - 1; i++) {
    if (dist <= lens[i] + 1e-9) {
      const frac = lens[i] > 0 ? dist / lens[i] : 0;
      return {
        x: path[i].x + frac * (path[i+1].x - path[i].x),
        y: path[i].y + frac * (path[i+1].y - path[i].y),
      };
    }
    dist -= lens[i];
  }
  return path[path.length - 1];
}

function nearestPointOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distToPath(rx, ry, path) {
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = nearestPointOnSeg(rx, ry, path[i].x, path[i].y, path[i+1].x, path[i+1].y);
    if (d < min) min = d;
  }
  return min;
}

// ── Level Drawing ─────────────────────────────────────────────────────────
function drawLevelOverlay() {
  if (appMode !== 'levels') return;
  if (lvl.phase === 'select') return;
  const def = LEVELS.find(l => l.id === lvl.id);
  if (!def) return;
  const path = def.path;
  const s = cvs.width / FIELD_FT;
  const corridorPx = LVL_ACC_TOL * s;

  function ftx(fx) { return (fx + FIELD_FT / 2) * s; }
  function fty(fy) { return (-fy + FIELD_FT / 2) * s; }

  ctx.save();

  ctx.beginPath();
  ctx.moveTo(ftx(path[0].x), fty(path[0].y));
  for (let i = 1; i < path.length; i++) ctx.lineTo(ftx(path[i].x), fty(path[i].y));
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = corridorPx * 2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(ftx(path[0].x), fty(path[0].y));
  for (let i = 1; i < path.length; i++) ctx.lineTo(ftx(path[i].x), fty(path[i].y));
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(ftx(path[0].x), fty(path[0].y));
  for (let i = 1; i < path.length; i++) ctx.lineTo(ftx(path[i].x), fty(path[i].y));
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = 1;
  ctx.setLineDash([7, 7]);
  ctx.stroke();
  ctx.setLineDash([]);

  const cpR = Math.max(7, corridorPx * 0.75);
  const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 180);

  for (let i = 0; i < path.length; i++) {
    const cx = ftx(path[i].x), cy = fty(path[i].y);
    const isDone   = i < lvl.nextCp;
    const isTarget = i === lvl.nextCp;

    ctx.beginPath();
    ctx.arc(cx, cy, cpR, 0, Math.PI * 2);

    if (isDone) {
      ctx.fillStyle = 'rgba(74,200,100,0.75)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(74,255,120,0.95)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (isTarget) {
      ctx.save();
      ctx.shadowColor = '#800020';
      ctx.shadowBlur = 10 + 8 * pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, cpR + 2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(128,0,32,${0.6 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, cpR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.90)';
      ctx.fill();
      ctx.strokeStyle = '#800020';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const label = i === 0 ? 'S' : String(i);
    ctx.fillStyle = isDone ? '#0a1a0a' : isTarget ? '#1a0005' : 'rgba(200,200,210,0.85)';
    ctx.font = `bold ${Math.max(8, cpR * 0.85)}px Courier New`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);
  }

  if (lvl.phase === 'attempt') {
    const gp = posAtT(path, lvl.ghostT);
    const gx = ftx(gp.x), gy = fty(gp.y);
    const r = (cfg.robotSz / 24) * s;
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.translate(gx, gy);
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.strokeStyle = '#88ccff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  if (lvl.phase === 'attempt' && lvl.nextCp < path.length) {
    const target = path[lvl.nextCp];
    const dx = target.x - bot.x, dy = target.y - bot.y;
    const dist = Math.hypot(dx, dy);
    const hideRadius = 20 / 12;

    if (dist > hideRadius) {
      const bx = ftx(bot.x), by = fty(bot.y);
      const tx2 = ftx(target.x), ty2 = fty(target.y);
      const cdx = tx2 - bx, cdy = ty2 - by;
      const clen = Math.hypot(cdx, cdy);
      const ux = cdx / clen, uy = cdy / clen;
      const robotPx = (cfg.robotSz / 24) * s;
      const startX = bx + ux * (robotPx + 2);
      const startY = by + uy * (robotPx + 2);
      const endX   = bx + ux * Math.min(clen * 0.55, 60);
      const endY   = by + uy * Math.min(clen * 0.55, 60);

      ctx.save();
      ctx.strokeStyle = 'rgba(160,50,60,0.65)';
      ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);
      const aw = 5;
      ctx.fillStyle = 'rgba(160,50,60,0.65)';
      ctx.beginPath();
      ctx.moveTo(endX + ux * aw, endY + uy * aw);
      ctx.lineTo(endX - uy * aw * 0.55, endY + ux * aw * 0.55);
      ctx.lineTo(endX + uy * aw * 0.55, endY - ux * aw * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

// ── Level Logic ───────────────────────────────────────────────────────────
function getLevelDef() { return LEVELS.find(l => l.id === lvl.id) || null; }
function isLevelUnlocked(id) { return id === 1 || !!completedLevels[id - 1]; }

function startCountdown(id) {
  if (!isLevelUnlocked(id)) return;
  lvl.id = id; lvl.phase = 'countdown';
  lvl.countdownVal = 3; lvl.elapsed = 0;
  lvl.nextCp = 1; lvl.cpCooldown = 0.4;
  lvl.accInside = 0; lvl.accFrames = 0; lvl.ghostT = 0;

  const def = getLevelDef();
  const spawn = def.path[0];
  resetRobot();
  bot.x = spawn.x; bot.y = spawn.y;

  prevRatingBeforeLevel = computeOverallRating();
  driverMetrics.pendingReactionTs = null;

  hideCards();
  document.getElementById('level-hud').style.display = 'block';
  showCountdown(3);
  renderLevelsSidebar();
}

let _cdTimeout = null;
function showCountdown(n) {
  const el  = document.getElementById('countdown-overlay');
  const txt = document.getElementById('countdown-text');
  el.classList.add('visible');
  txt.className = '';
  txt.textContent = n > 0 ? String(n) : 'GO!';
  txt.classList.toggle('go', n === 0);
  void txt.offsetWidth;
  txt.classList.add('pop');
  if (_cdTimeout) clearTimeout(_cdTimeout);
  if (n > 0) {
    _cdTimeout = setTimeout(() => showCountdown(n - 1), 900);
  } else {
    _cdTimeout = setTimeout(() => {
      el.classList.remove('visible');
      lvl.phase = 'attempt';
      lvl.countdownTs = performance.now();
    }, 700);
  }
}

function updateLevel(dt) {
  if (appMode !== 'levels') return;
  if (lvl.phase !== 'attempt') return;
  const def = getLevelDef();
  if (!def) return;

  lvl.elapsed += dt;
  lvl.ghostT = Math.min(1, lvl.elapsed / def.timeLimit);

  const dist = distToPath(bot.x, bot.y, def.path);
  if (dist < LVL_ACC_TOL) lvl.accInside++;
  lvl.accFrames++;

  lvl.cpCooldown = Math.max(0, lvl.cpCooldown - dt);
  if (lvl.cpCooldown <= 0 && lvl.nextCp < def.path.length) {
    const cp = def.path[lvl.nextCp];
    const cpDist = Math.hypot(bot.x - cp.x, bot.y - cp.y);
    if (cpDist < LVL_CP_RADIUS) {
      if (driverMetrics.pendingReactionTs !== null) {
        driverMetrics.reactionTimes.push(performance.now() - driverMetrics.pendingReactionTs);
      }
      driverMetrics.pendingReactionTs = performance.now();
      const hitIdx = lvl.nextCp;
      lvl.nextCp++;
      lvl.cpCooldown = 0.3;
      if (lvl.nextCp >= def.path.length) {
        console.log(`[Level ${lvl.id}] Waypoint ${hitIdx} hit (dist: ${cpDist.toFixed(3)}ft). ALL WAYPOINTS COMPLETE → LEVEL PASSED`);
        finishLevel(true); return;
      }
      console.log(`[Level ${lvl.id}] Waypoint ${hitIdx} hit (dist: ${cpDist.toFixed(3)}ft). Next target: waypoint ${lvl.nextCp}`);
    }
  }

  if (lvl.elapsed >= def.timeLimit) finishLevel(false);
}

function finishLevel(success) {
  const def = getLevelDef();
  const avgAcc = lvl.accFrames > 0 ? lvl.accInside / lvl.accFrames : 0;
  const timeFrac = lvl.elapsed / def.timeLimit;

  console.log(`[Level ${lvl.id}] Finished: ${success ? 'PASSED' : 'FAILED (time out)'}. Waypoints hit: ${Math.max(0, lvl.nextCp - 1)}/${def.path.length - 1}. Accuracy: ${Math.round(avgAcc * 100)}%. Time: ${lvl.elapsed.toFixed(1)}s / ${def.timeLimit}s`);

  if (!success) {
    lvl.phase = 'fail';
    showFailCard(def, avgAcc);
  } else {
    let starCount;
    if      (avgAcc >= 0.95 && timeFrac <= 0.50) starCount = 3;
    else if (avgAcc >= 0.85 && timeFrac <= 0.65) starCount = 2;
    else                                          starCount = 1;
    const stars = [starCount >= 1, starCount >= 2, starCount >= 3];

    const prev = completedLevels[lvl.id];
    if (!prev || starCount > prev.stars.filter(Boolean).length) {
      completedLevels[lvl.id] = { stars, time: lvl.elapsed, accuracy: avgAcc };
    }

    driverMetrics.pathAccuracyHistory.push(avgAcc);
    driverMetrics.levelsCompleted++;

    saveLevelResult(lvl.id, starCount, lvl.elapsed, avgAcc);
    saveLeaderboardEntry(lvl.id, starCount, lvl.elapsed, avgAcc);

    lvl.phase = 'result';
    showResultCard(stars, avgAcc, lvl.elapsed, def);
  }

  document.getElementById('level-hud').style.display = 'none';
  renderLevelsSidebar();
}

function showResultCard(stars, acc, time, def) {
  const starCount = stars.filter(Boolean).length;
  const medals     = ['', 'bronze', 'silver', 'gold'];
  const medalEmoji = ['', '&#129350;', '&#129353;', '&#129351;'];
  const medalLabel = ['', 'Bronze!', 'Silver!', 'Gold!'];

  const card = document.getElementById('result-card');
  card.className = medals[starCount];
  document.getElementById('rc-medal').innerHTML = medalEmoji[starCount];
  document.getElementById('rc-title').textContent = medalLabel[starCount];
  document.getElementById('rc-level').textContent = `Level ${def.id} — ${def.name}`;
  document.getElementById('rc-stats').innerHTML =
    `<b>${time.toFixed(1)}s</b> of ${def.timeLimit}s &nbsp;|&nbsp; Accuracy <b>${Math.round(acc * 100)}%</b>`;

  ['rc-s1','rc-s2','rc-s3'].forEach((id, i) => {
    document.getElementById(id).className = 'rc-star' + (stars[i] ? ' lit' : '');
  });

  const newRating = computeOverallRating();
  const deltaEl = document.getElementById('rc-delta');
  if (prevRatingBeforeLevel !== null) {
    const delta = newRating - prevRatingBeforeLevel;
    if (delta > 0)
      deltaEl.innerHTML = `Rating: <span class="delta-up">&#9650; +${delta} pts</span> &rarr; ${gradeFromRating(newRating)} (${newRating})`;
    else if (delta < 0)
      deltaEl.innerHTML = `Rating: <span class="delta-dn">&#9660; ${delta} pts</span> &rarr; ${gradeFromRating(newRating)} (${newRating})`;
    else
      deltaEl.innerHTML = `Rating: ${gradeFromRating(newRating)} (${newRating}) &mdash; no change`;
  } else {
    deltaEl.textContent = '';
  }

  const nextId  = def.id + 1;
  const nextBtn = document.getElementById('rc-next-btn');
  nextBtn.style.display = LEVELS.some(l => l.id === nextId) ? '' : 'none';

  card.style.display = 'block';
  requestAnimationFrame(() => card.classList.add('show'));
}

function showFailCard(def, avgAcc) {
  const cpDone  = Math.max(0, lvl.nextCp - 1);
  const cpTotal = def.path.length - 1;
  document.getElementById('fail-level').textContent =
    `Level ${def.id} — ${def.name}  ·  ${cpDone}/${cpTotal} checkpoints  ·  ${Math.round((avgAcc||0)*100)}% acc`;
  const card = document.getElementById('fail-card');
  card.style.display = 'block';
  requestAnimationFrame(() => card.classList.add('show'));
}

function hideCards() {
  ['result-card','fail-card'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('show');
    el.style.display = 'none';
  });
}

function retryLevel()   { hideCards(); if (lvl.id) startCountdown(lvl.id); }
function exitToSelect() {
  hideCards();
  lvl.phase = 'select'; lvl.id = null;
  document.getElementById('level-hud').style.display = 'none';
  document.getElementById('countdown-overlay').classList.remove('visible');
  if (_cdTimeout) { clearTimeout(_cdTimeout); _cdTimeout = null; }
  renderLevelsSidebar();
}
function nextLevel() {
  const nextId = lvl.id + 1;
  hideCards();
  if (isLevelUnlocked(nextId)) startCountdown(nextId); else exitToSelect();
}

function switchMode(mode) {
  if (appMode === mode) return;
  appMode = mode;
  document.getElementById('tab-freedrive').classList.toggle('active', mode === 'freedrive');
  document.getElementById('tab-levels').classList.toggle('active', mode === 'levels');
  document.getElementById('sidebar-teleop').style.display = mode === 'freedrive' ? 'flex' : 'none';
  const ls = document.getElementById('levels-sidebar');
  ls.style.display = mode === 'levels' ? 'flex' : 'none';

  if (mode === 'levels') {
    exitToSelect();
    renderLevelsSidebar();
  } else {
    hideCards();
    document.getElementById('level-hud').style.display = 'none';
    document.getElementById('countdown-overlay').classList.remove('visible');
    if (_cdTimeout) { clearTimeout(_cdTimeout); _cdTimeout = null; }
    lvl.phase = 'select'; lvl.id = null;
  }
  resize();
}

function renderLevelsSidebar() {
  const ap  = document.getElementById('attempt-panel');
  const def = getLevelDef();
  if (lvl.phase !== 'select' && def) {
    ap.style.display = 'flex';
    document.getElementById('ap-name').textContent  = `Level ${def.id} — ${def.name}`;
    document.getElementById('ap-limit').textContent = def.timeLimit + 's';
    document.getElementById('ap-cp').textContent    = `${Math.max(0,lvl.nextCp-1)}/${def.path.length-1}`;
    const acc = lvl.accFrames > 0 ? Math.round(lvl.accInside / lvl.accFrames * 100) : 100;
    document.getElementById('ap-acc').textContent  = acc + '%';
    document.getElementById('ap-time').textContent = lvl.elapsed.toFixed(1) + 's';
  } else {
    ap.style.display = 'none';
  }

  const container = document.getElementById('lvl-list');
  const tiers = [...new Set(LEVELS.map(l => l.tier))];
  let html = '';
  for (const tier of tiers) {
    html += `<div class="tier-header">${tier}</div>`;
    for (const ld of LEVELS.filter(l => l.tier === tier)) {
      const unlocked = isLevelUnlocked(ld.id);
      const comp = completedLevels[ld.id];
      const isActive = lvl.id === ld.id;
      const cls = ['lvl-card', !unlocked ? 'locked' : '', isActive ? 'active-lvl' : ''].filter(Boolean).join(' ');
      const stars = comp ? comp.stars : [false, false, false];
      const starsHtml = stars.map(s => `<span class="lvl-star${s?' lit':''}">&#9733;</span>`).join('');
      html += `<div class="${cls}" onclick="${unlocked ? `startCountdown(${ld.id})` : ''}">
        <div class="lvl-num">${ld.id}</div>
        <div class="lvl-info">
          <div class="lvl-name">${ld.name}</div>
          <div class="lvl-meta">${ld.timeLimit}s limit &middot; ${ld.path.length-1} CP</div>
          ${comp ? `<div class="lvl-stars">${starsHtml}</div>` : ''}
        </div>
        ${unlocked
          ? `<button class="lvl-lb-btn" onclick="event.stopPropagation();openLeaderboard(${ld.id})" title="Leaderboard">&#127942;</button>`
          : '<span class="lvl-lock-icon">&#128274;</span>'}
      </div>`;
    }
  }
  container.innerHTML = html;
}

function renderLevelsHud() {
  if (appMode !== 'levels' || lvl.phase !== 'attempt') return;
  const def = getLevelDef();
  const timeLeft = def ? def.timeLimit - lvl.elapsed : 0;
  document.getElementById('hud-timer').textContent =
    (timeLeft < 10 ? timeLeft.toFixed(1) : Math.ceil(timeLeft)) + 's';
  document.getElementById('hud-cp').textContent =
    `${Math.max(0, lvl.nextCp - 1)}/${def ? def.path.length - 1 : 0}`;
  const acc = lvl.accFrames > 0 ? Math.round(lvl.accInside / lvl.accFrames * 100) : 100;
  document.getElementById('hud-acc').textContent = acc + '%';
  if (def) {
    document.getElementById('ap-time').textContent = lvl.elapsed.toFixed(1) + 's';
    document.getElementById('ap-cp').textContent   = `${Math.max(0, lvl.nextCp - 1)}/${def.path.length - 1}`;
    document.getElementById('ap-acc').textContent  = acc + '%';
  }
}
