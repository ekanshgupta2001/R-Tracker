// ── R-Tracker TeleOp — Match Timer ───────────────────────────────────────

const TOTAL_MS = 150000;
const AUTO_MS  = 30000;

let tmr = { running: false, elapsed: 0, lastTs: 0 };

function fmtTime(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function tickTimer(ts) {
  if (!tmr.running) return;
  if (tmr.lastTs === 0) tmr.lastTs = ts;
  tmr.elapsed += ts - tmr.lastTs;
  tmr.lastTs = ts;
  if (tmr.elapsed >= TOTAL_MS) { tmr.elapsed = TOTAL_MS; tmr.running = false; }
}

function timerStart() { tmr.running = true; tmr.lastTs = 0; }
function timerPause() { tmr.running = false; tmr.lastTs = 0; }
function timerReset() { tmr.running = false; tmr.elapsed = 0; tmr.lastTs = 0; renderTimer(); }

function renderTimer() {
  const rem = TOTAL_MS - tmr.elapsed;
  document.getElementById('timer-display').textContent = fmtTime(rem);

  let lbl, cls;
  if (tmr.elapsed === 0 && !tmr.running) {
    lbl = 'READY — PRESS START'; cls = 'ready-period';
  } else if (rem <= 0) {
    lbl = 'MATCH OVER'; cls = 'over-period';
  } else if (tmr.elapsed < AUTO_MS) {
    lbl = `AUTO  ·  ${fmtTime(AUTO_MS - tmr.elapsed)} left`; cls = 'auto-period';
  } else {
    lbl = `TELEOP  ·  ${fmtTime(rem)} left`; cls = 'teleop-period';
  }
  const pel = document.getElementById('period-label');
  pel.textContent = lbl; pel.className = cls;

  const td = document.getElementById('timer-display');
  td.style.color = rem < 15000 ? '#ff4455' : rem < 45000 ? '#ffdd44' : '#dde';
}
