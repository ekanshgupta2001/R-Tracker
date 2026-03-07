// ── R-Tracker Path Planner — Animation ───────────────────────────────────

const ANIM_SPEED_IPS = 60;
let animRunning = false;
let animT = 0;
let animFrame = null;
let animPathLength = 1;

function computePathLength() {
  let total = 0;
  for (let si = 0; si < segments.length; si++) {
    let prev = evalSegFTC(si, 0);
    for (let j = 1; j <= 24; j++) {
      const curr = evalSegFTC(si, j / 24);
      total += Math.hypot(curr.x - prev.x, curr.y - prev.y);
      prev = curr;
    }
  }
  return Math.max(total, 0.1);
}

function getAnimWaypoint() {
  if (waypoints.length < 2) return waypoints[0];
  const total = segments.length;
  const seg   = Math.min(animT * total, total - 0.0001);
  const si    = Math.floor(seg);
  const t     = seg - si;
  return evalSegFTC(si, t);
}

function toggleAnim() {
  if (animRunning) { stopAnim(); return; }
  if (waypoints.length < 2) return;
  animRunning = true; animT = 0;
  animPathLength = computePathLength();
  document.getElementById('btnRobotAnim').textContent = '⏸ Pause';
  document.getElementById('btnStopAnim').disabled = false;
  let last = null;
  function step(ts) {
    if (!animRunning) return;
    if (last === null) last = ts;
    const dt = (ts - last) / 1000; last = ts;
    animT += dt * pathSettings.speed * ANIM_SPEED_IPS / animPathLength;
    if (animT >= 1) { animT = 1; drawAll(); stopAnim(); return; }
    drawAll();
    animFrame = requestAnimationFrame(step);
  }
  animFrame = requestAnimationFrame(step);
}

function stopAnim() {
  animRunning = false;
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  document.getElementById('btnRobotAnim').textContent = '▶ Play';
  document.getElementById('btnStopAnim').disabled = true;
  animT = 0;
  drawAll();
}

function toggleGrid() {
  showGrid = !showGrid;
  document.getElementById('btnGrid').classList.toggle('active', showGrid);
  drawAll();
}
