// ── R-Tracker TeleOp — Input Handling ────────────────────────────────────

let inp = { lx: 0, ly: 0, rx: 0 };
let keys = {};
let gpIdx = null;
let inputBuffer = [];
let inputTime = 0;

function setDrive(t) {
  drivetrain = t;
  document.getElementById('btn-mec').classList.toggle('active', t === 'mecanum');
  document.getElementById('btn-tank').classList.toggle('active', t === 'tank');
}

function setMode(m) {
  driveMode = m;
  document.getElementById('btn-fc').classList.toggle('active', m === 'field');
  document.getElementById('btn-rc').classList.toggle('active', m === 'robot');
}

function resetRobot() {
  bot.x = 0; bot.y = 0; bot.hdg = 0;
  bot.vx = 0; bot.vy = 0;
  bot.actualVx = 0; bot.actualVy = 0; bot.actualOmega = 0;
  inputBuffer = [];
  if (typeof reset3DCamera === 'function') reset3DCamera();
}

window.addEventListener('gamepadconnected', e => {
  gpIdx = e.gamepad.index;
  const el = document.getElementById('gpstatus');
  el.textContent = '🎮 ' + (e.gamepad.id.length > 22 ? e.gamepad.id.slice(0, 22) + '…' : e.gamepad.id);
  el.className = 'gpok';
});

window.addEventListener('gamepaddisconnected', e => {
  if (e.gamepad.index === gpIdx) {
    gpIdx = null;
    const el = document.getElementById('gpstatus');
    el.textContent = 'No Gamepad'; el.className = 'gpoff';
  }
});

document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyR') resetRobot();
  if (e.code === 'KeyG') debugCollisions = !debugCollisions;
  if (appMode === 'freedrive') {
    if (e.code === 'KeyF') setMode(driveMode === 'field' ? 'robot' : 'field');
    if (e.code === 'KeyT') setDrive(drivetrain === 'mecanum' ? 'tank' : 'mecanum');
    if (e.code === 'Space') { tmr.running ? timerPause() : timerStart(); e.preventDefault(); }
  }
  if (e.code === 'KeyH') toggleMiniStats();
  if (e.code === 'KeyL') switchMode(appMode === 'freedrive' ? 'levels' : 'freedrive');
  if (e.code === 'Escape' && appMode === 'levels') {
    if (lvl.phase !== 'select') exitToSelect(); else switchMode('freedrive');
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});

document.addEventListener('keyup', e => { keys[e.code] = false; });
