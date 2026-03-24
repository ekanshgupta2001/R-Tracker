// ── R-Tracker Path Planner — Waypoint State & Management ──────────────────

// waypoints, segments, selectedIdx, selectedSegIdx, showGrid, pathSettings
// are declared in canvas.js (loaded first)

let dragType   = null;
let dragIdx    = -1;
let dragSegIdx = -1;
let dragCpIdx  = -1;
let dragOffX = 0, dragOffY = 0;
let mouseDownPos = null;
let wasDragging  = false;

// pathSettings declared in canvas.js
pathSettings.speed = 1.0;

// ── Hit Testing ───────────────────────────────────────────────────────────
function hitTestCP(cx, cy) {
  const hitR = px(7);
  for (let si = segments.length - 1; si >= 0; si--) {
    for (let ci = segments[si].cps.length - 1; ci >= 0; ci--) {
      const p = ftcToCvs(segments[si].cps[ci].x, segments[si].cps[ci].y);
      const dx = cx - p.x, dy = cy - p.y;
      if (dx*dx + dy*dy <= hitR*hitR) return { si, ci };
    }
  }
  return null;
}

function hitTestWaypoint(cx, cy) {
  const hitR = px(8);
  for (let i = waypoints.length - 1; i >= 0; i--) {
    const p = ftcToCvs(waypoints[i].x, waypoints[i].y);
    const dx = cx - p.x, dy = cy - p.y;
    if (dx*dx + dy*dy <= hitR*hitR) return i;
  }
  return -1;
}

function hitTestSegment(cx, cy) {
  if (segments.length === 0) return -1;
  const threshold = px(10);
  let bestDist = Infinity, bestSeg = -1;
  for (let si = 0; si < segments.length; si++) {
    for (let j = 0; j <= 30; j++) {
      const pt = evalSegCanvas(si, j / 30);
      const dx = cx - pt.x, dy = cy - pt.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < bestDist) { bestDist = d; bestSeg = si; }
    }
  }
  return bestDist < threshold ? bestSeg : -1;
}

// ── Waypoint Management ───────────────────────────────────────────────────
function addWaypoint(ftcX, ftcY) {
  const heading = waypoints.length > 0 ? waypoints[waypoints.length-1].heading : 0;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  waypoints.push({ x: parseFloat(clamp(ftcX, 0, 144).toFixed(1)), y: parseFloat(clamp(ftcY, 0, 144).toFixed(1)), heading, waitMs: 0, action: 'None' });
  if (waypoints.length >= 2) segments.push({ cps: [] });
  selectedIdx    = waypoints.length - 1;
  selectedSegIdx = -1;
  refreshUI();
}

function addWaypointAtCenter() {
  addWaypoint(parseFloat((40 + Math.random() * 64).toFixed(1)), parseFloat((40 + Math.random() * 64).toFixed(1)));
}

function deleteSelected() {
  if (selectedIdx >= 0 && selectedIdx < waypoints.length) deleteWpAt(selectedIdx);
}

function deleteWpAt(i) {
  const old_n = waypoints.length;
  waypoints.splice(i, 1);
  if (old_n >= 2) {
    if (i === 0)         segments.splice(0, 1);
    else if (i === old_n - 1) segments.splice(segments.length - 1, 1);
    else                 segments.splice(i - 1, 2, { cps: [] });
  }
  if (selectedIdx >= waypoints.length) selectedIdx = waypoints.length - 1;
  if (selectedSegIdx >= segments.length) selectedSegIdx = -1;
  refreshUI();
}

function clearAll() {
  if (waypoints.length === 0) return;
  if (!confirm('Clear all waypoints and paths?')) return;
  waypoints = []; segments = [];
  selectedIdx = -1; selectedSegIdx = -1;
  stopAnim(); refreshUI();
}

// ── Segment Type ──────────────────────────────────────────────────────────
function setSegmentType(si, type) {
  if (type === 'line') {
    segments[si].cps = [];
  } else {
    if (segments[si].cps.length === 0) {
      const a = waypoints[si], b = waypoints[si + 1];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const perp = 20;
      const len = Math.hypot(dx, dy) || 1;
      segments[si].cps = [{
        x: parseFloat(Math.min(144, Math.max(0, mx - dy / len * perp)).toFixed(1)),
        y: parseFloat(Math.min(144, Math.max(0, my + dx / len * perp)).toFixed(1)),
      }];
    }
  }
  if (selectedSegIdx === si) renderSegmentEditor(si);
  updateCode(); drawAll();
}

// ── Control Points ────────────────────────────────────────────────────────
function addControlPoint(si) {
  const seg = segments[si];
  if (seg.cps.length >= 2) return;
  const a = waypoints[si], b = waypoints[si+1];
  const clamp = v => Math.min(144, Math.max(0, v));
  if (seg.cps.length === 0) {
    seg.cps.push({ x: parseFloat(clamp(a.x + (b.x - a.x) / 3).toFixed(1)), y: parseFloat(clamp(a.y + (b.y - a.y) / 3).toFixed(1)) });
  } else {
    seg.cps.push({ x: parseFloat(clamp(a.x + (b.x - a.x) * 2 / 3).toFixed(1)), y: parseFloat(clamp(a.y + (b.y - a.y) * 2 / 3).toFixed(1)) });
  }
  updateCode(); drawAll();
  renderSegmentEditor(si);
}

function removeCP(si, ci) {
  segments[si].cps.splice(ci, 1);
  updateCode(); drawAll();
  renderSegmentEditor(si);
}

function updateCP(si, ci, axis, val) {
  segments[si].cps[ci][axis] = parseFloat(val) || 0;
  updateCode(); drawAll();
}

// ── Canvas Interaction ────────────────────────────────────────────────────
function getCanvasPos(e) {
  const rect = cvs.getBoundingClientRect();
  const scaleX = cvs.width / rect.width, scaleY = cvs.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

cvs.addEventListener('mousedown', e => {
  if (e.button === 2) return;
  const cp = getCanvasPos(e);
  mouseDownPos = { x: cp.x, y: cp.y };
  wasDragging  = false;

  const cpHit = hitTestCP(cp.x, cp.y);
  if (cpHit) {
    dragType = 'cp'; dragSegIdx = cpHit.si; dragCpIdx = cpHit.ci;
    const p = ftcToCvs(segments[cpHit.si].cps[cpHit.ci].x, segments[cpHit.si].cps[cpHit.ci].y);
    dragOffX = cp.x - p.x; dragOffY = cp.y - p.y;
    cvs.classList.add('dragging'); return;
  }

  const wpHit = hitTestWaypoint(cp.x, cp.y);
  if (wpHit >= 0) {
    dragType = 'waypoint'; dragIdx = wpHit;
    const p = ftcToCvs(waypoints[wpHit].x, waypoints[wpHit].y);
    dragOffX = cp.x - p.x; dragOffY = cp.y - p.y;
    selectedIdx = wpHit; selectedSegIdx = -1;
    cvs.classList.add('dragging'); refreshUI();
  }
});

cvs.addEventListener('mousemove', e => {
  if (dragType === null) return;
  const cp = getCanvasPos(e);
  if (Math.hypot(cp.x - mouseDownPos.x, cp.y - mouseDownPos.y) > 3) wasDragging = true;

  if (dragType === 'waypoint' && dragIdx >= 0) {
    const ftc = cvsToFtc(cp.x - dragOffX, cp.y - dragOffY);
    waypoints[dragIdx].x = parseFloat(Math.min(144, Math.max(0, ftc.x)).toFixed(1));
    waypoints[dragIdx].y = parseFloat(Math.min(144, Math.max(0, ftc.y)).toFixed(1));
    renderWpList();
    if (selectedIdx === dragIdx) renderWaypointEditor();
    updateCode(); drawAll();
  } else if (dragType === 'cp') {
    const ftc = cvsToFtc(cp.x - dragOffX, cp.y - dragOffY);
    segments[dragSegIdx].cps[dragCpIdx].x = parseFloat(Math.min(144, Math.max(0, ftc.x)).toFixed(1));
    segments[dragSegIdx].cps[dragCpIdx].y = parseFloat(Math.min(144, Math.max(0, ftc.y)).toFixed(1));
    if (selectedSegIdx === dragSegIdx) renderSegmentEditor(dragSegIdx);
    updateCode(); drawAll();
  }
});

cvs.addEventListener('mouseup', e => {
  const wasDrag  = wasDragging;
  dragType = null; dragIdx = -1; dragSegIdx = -1; dragCpIdx = -1;
  cvs.classList.remove('dragging');
  if (!wasDrag && e.button !== 2) handleCanvasClick(getCanvasPos(e));
});

function handleCanvasClick(cp) {
  const cpHit = hitTestCP(cp.x, cp.y);
  if (cpHit) { selectedSegIdx = cpHit.si; selectedIdx = -1; refreshUI(); return; }
  const wpHit = hitTestWaypoint(cp.x, cp.y);
  if (wpHit >= 0) { selectedIdx = wpHit; selectedSegIdx = -1; refreshUI(); return; }
  const segHit = hitTestSegment(cp.x, cp.y);
  if (segHit >= 0) { selectedSegIdx = segHit; selectedIdx = -1; refreshUI(); return; }
  const ftc = cvsToFtc(cp.x, cp.y);
  addWaypoint(ftc.x, ftc.y);
}

cvs.addEventListener('contextmenu', e => {
  e.preventDefault();
  const cp = getCanvasPos(e);
  const cpHit = hitTestCP(cp.x, cp.y);
  if (cpHit) { removeCP(cpHit.si, cpHit.ci); return; }
  const wpHit = hitTestWaypoint(cp.x, cp.y);
  if (wpHit >= 0) deleteWpAt(wpHit);
});
