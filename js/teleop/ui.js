// ── R-Tracker TeleOp — UI & Main Loop ────────────────────────────────────

function setDot(id, x, y) {
  const el = document.getElementById(id);
  el.style.left = `${(x + 1) / 2 * 100}%`;
  el.style.top  = `${(y + 1) / 2 * 100}%`;
}

function setBar(bid, vid, v) {
  document.getElementById(vid).textContent = v.toFixed(2);
  const b = document.getElementById(bid);
  const pct = Math.abs(v) * 50;
  b.style.width = pct + '%';
  b.style.left  = v >= 0 ? '50%' : `${50 - pct}%`;
  b.style.background = v > 0.05 ? (v > 0.6 ? '#4aff88' : '#4a9eff') : v < -0.05 ? '#ff5544' : '#334';
}

function renderUI() {
  setDot('dl', inp.lx, inp.ly);
  setDot('dr', inp.rx, 0);
  setBar('b-fl', 'v-fl', mtr.fl);
  setBar('b-fr', 'v-fr', mtr.fr);
  setBar('b-bl', 'v-bl', mtr.bl);
  setBar('b-br', 'v-br', mtr.br);
  document.getElementById('t-x').textContent  = bot.x.toFixed(2) + ' ft';
  document.getElementById('t-y').textContent  = bot.y.toFixed(2) + ' ft';
  document.getElementById('t-h').textContent  = bot.hdg.toFixed(1) + '°';
  const spd = Math.hypot(bot.vx, bot.vy);
  document.getElementById('t-s').textContent  = spd.toFixed(2) + ' ft/s';
  document.getElementById('t-dt').textContent = drivetrain === 'mecanum' ? 'Mecanum' : 'Tank';
  document.getElementById('t-dm').textContent = driveMode === 'field' ? 'Field-Centric' : 'Robot-Centric';
  renderTimer();
}

// ── Main Loop ─────────────────────────────────────────────────────────────
let lastT = 0;
function loop(ts) {
  const dt = Math.min((ts - lastT) / 1000, 0.05);
  lastT = ts;

  if (appMode === 'freedrive') tickTimer(ts);

  const robotFrozen = appMode === 'levels' && lvl.phase === 'countdown';
  const prevBotX = bot.x, prevBotY = bot.y;
  if (!robotFrozen) updateBot(dt);
  updateMetrics(dt, prevBotX, prevBotY);

  if (appMode === 'levels') updateLevel(dt);
  renderMiniStats();

  drawField();
  drawDebugCollisions();
  drawLevelOverlay();
  drawRobot();

  if (typeof update3DView === 'function') update3DView();

  if (appMode === 'freedrive') renderUI();
  else                         renderLevelsHud();

  requestAnimationFrame(loop);
}

// ── Init ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', function () {
  resize();
  if (typeof resize3DView === 'function') resize3DView();
});
resize();
cfgUpdate();
renderLevelsSidebar();
requestAnimationFrame(loop);

initAuth(function onSignedIn(user) {
  loadLevelProgress();
});
