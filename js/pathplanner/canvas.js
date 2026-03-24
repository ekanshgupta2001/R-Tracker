// ── R-Tracker Path Planner — Canvas & Drawing ─────────────────────────────

// ── Shared state (declared here because canvas.js loads first) ────────────
var waypoints   = [];
var segments    = [];
var selectedIdx    = -1;
var selectedSegIdx = -1;
var showGrid       = true;
var animRunning    = false;
var pathSettings   = { reversed: false, maxVel: 60, maxAccel: 40, maxAngVel: 180 };

const fieldImg = new Image();
fieldImg.src = '../../assets/decode.webp';
fieldImg.onload = () => drawAll();

const cvs = document.getElementById('fieldCanvas');
const ctx = cvs.getContext('2d');
const FIELD_IN = 144;

function resizeCanvas() {
  const fp = document.getElementById('fieldPanel');
  const W = fp.clientWidth - 8;
  const H = fp.clientHeight - 44;
  const sz = Math.max(200, Math.min(W, H));
  cvs.width = cvs.height = sz;
}

function px(v) { return v * cvs.width / FIELD_IN; }
function ftcToCvs(ppX, ppY) { return { x: px(ppX), y: px(FIELD_IN - ppY) }; }
function cvsToFtc(cx, cy)   { return { x: cx / cvs.width * FIELD_IN, y: (cvs.height - cy) / cvs.height * FIELD_IN }; }

function drawAll() {
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  if (fieldImg.complete && fieldImg.naturalWidth > 0) {
    ctx.drawImage(fieldImg, 0, 0, cvs.width, cvs.height);
  } else {
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, cvs.width, cvs.height);
  }
  if (showGrid) drawGrid();
  if (waypoints.length > 1) drawPath();
  drawWaypoints();
  if (waypoints.length > 0) drawRobotAtPos();
}

function drawGrid() {
  const step = px(12);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.5;
  for (let x = 0; x <= cvs.width; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cvs.height); ctx.stroke();
  }
  for (let y = 0; y <= cvs.height; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cvs.width, y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1;
  const midX = px(72), midY = px(72);
  ctx.beginPath(); ctx.moveTo(midX, 0); ctx.lineTo(midX, cvs.height); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(cvs.width, midY); ctx.stroke();
  ctx.restore();
}

function drawPath() {
  drawControlPointHandles();
  for (let si = 0; si < segments.length; si++) {
    const a   = ftcToCvs(waypoints[si].x, waypoints[si].y);
    const b   = ftcToCvs(waypoints[si+1].x, waypoints[si+1].y);
    const seg = segments[si];
    const isSel = (si === selectedSegIdx);

    ctx.save();
    ctx.strokeStyle = isSel ? '#d0003a' : '#c73e5a';
    ctx.lineWidth   = isSel ? Math.max(2.5, px(2)) : Math.max(1.5, px(1.5));
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(199,62,90,0.6)';
    ctx.shadowBlur  = isSel ? px(5) : px(2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    if (seg.cps.length === 0) {
      ctx.lineTo(b.x, b.y);
    } else if (seg.cps.length === 1) {
      const cp = ftcToCvs(seg.cps[0].x, seg.cps[0].y);
      ctx.quadraticCurveTo(cp.x, cp.y, b.x, b.y);
    } else {
      const cp1 = ftcToCvs(seg.cps[0].x, seg.cps[0].y);
      const cp2 = ftcToCvs(seg.cps[1].x, seg.cps[1].y);
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();

    const mid  = evalSegCanvas(si, 0.5);
    const near = evalSegCanvas(si, 0.42);
    drawArrowHead(near.x, near.y, mid.x, mid.y, isSel ? '#d0003a' : '#c73e5a');
  }
  drawControlPoints();
}

function drawControlPointHandles() {
  ctx.save();
  ctx.strokeStyle = 'rgba(160,51,74,0.55)'; ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  segments.forEach((seg, si) => {
    if (seg.cps.length === 0) return;
    const a = ftcToCvs(waypoints[si].x, waypoints[si].y);
    const b = ftcToCvs(waypoints[si+1].x, waypoints[si+1].y);
    seg.cps.forEach((cp, ci) => {
      const p = ftcToCvs(cp.x, cp.y);
      const anchor = (ci === 0) ? a : b;
      ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    });
  });
  ctx.setLineDash([]);
  ctx.restore();
}

function drawControlPoints() {
  segments.forEach((seg, si) => {
    if (seg.cps.length === 0) return;
    seg.cps.forEach((cp, ci) => {
      const p = ftcToCvs(cp.x, cp.y);
      const isDraggingThis = (dragType === 'cp' && dragSegIdx === si && dragCpIdx === ci);
      ctx.save();
      ctx.beginPath(); ctx.arc(p.x, p.y, px(3), 0, Math.PI * 2);
      ctx.fillStyle   = isDraggingThis ? '#ffffff' : '#c04060';
      ctx.strokeStyle = isDraggingThis ? '#ff3366' : '#c73e5a';
      ctx.lineWidth   = 1.2;
      ctx.fill(); ctx.stroke();
      ctx.restore();
    });
  });
}

function drawArrowHead(x1, y1, x2, y2, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const sz = px(4);
  ctx.save();
  ctx.fillStyle = color || '#c73e5a';
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(angle - 0.45) * sz, y2 - Math.sin(angle - 0.45) * sz);
  ctx.lineTo(x2 - Math.cos(angle + 0.45) * sz, y2 - Math.sin(angle + 0.45) * sz);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawWaypoints() {
  waypoints.forEach((wp, i) => {
    const p = ftcToCvs(wp.x, wp.y);
    const r = px(4.5);
    const isSel = (i === selectedIdx);

    if (isSel) {
      ctx.save();
      ctx.beginPath(); ctx.arc(p.x, p.y, r + px(3), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(160,51,74,0.25)'; ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle   = '#ffffff';
    ctx.strokeStyle = isSel ? '#ff3366' : '#c73e5a';
    ctx.lineWidth   = isSel ? px(1.5) : px(1);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = `bold ${Math.max(8, px(3.5))}px Inter, sans-serif`;
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(i + 1, p.x, p.y);
    ctx.restore();

    drawHeadingArrow(p.x, p.y, wp.heading, r, isSel);
  });
}

function drawHeadingArrow(cx, cy, headingDeg, r, highlight) {
  const ang = (headingDeg - 90) * Math.PI / 180;
  const len = r + px(7);
  const ex = cx + Math.cos(ang) * len;
  const ey = cy + Math.sin(ang) * len;
  ctx.save();
  ctx.strokeStyle = highlight ? '#ff3366' : 'rgba(255,255,255,0.75)';
  ctx.lineWidth   = highlight ? px(1.2) : px(0.8);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
  const hs = px(2.5);
  ctx.fillStyle = highlight ? '#ff3366' : 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - Math.cos(ang - 0.5) * hs, ey - Math.sin(ang - 0.5) * hs);
  ctx.lineTo(ex - Math.cos(ang + 0.5) * hs, ey - Math.sin(ang + 0.5) * hs);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawRobotAtPos() {
  if (waypoints.length === 0) return;
  const wp = animRunning ? getAnimWaypoint() : waypoints[0];
  if (!wp) return;

  const pos = ftcToCvs(wp.x, wp.y);
  const robotSzIn = parseFloat(document.getElementById('robotW').value) || 18;
  const r = px(robotSzIn / 2);
  const hdgRad = wp.heading * Math.PI / 180;

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(hdgRad);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-r + 3, -r + 3, r * 2, r * 2);
  ctx.fillStyle = '#b0b8c8';
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.fillStyle = '#4a9eff';
  ctx.fillRect(-r, -r, r * 2, r * 0.28);
  ctx.fillStyle = '#1a1a2e';
  ctx.font = `bold ${Math.max(6, r * 0.6)}px Courier New`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('FTC', 0, r * 0.35);

  const wW = r * 0.25, wH = r * 0.55, wx = r * 0.82, wy = r * 0.55;
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sy]) => {
    ctx.save();
    ctx.translate(sx * wx, sy * wy);
    ctx.rotate(Math.PI / 4 * sx);
    ctx.fillStyle = '#222222'; ctx.fillRect(-wW/2, -wH/2, wW, wH);
    ctx.fillStyle = '#6a6a8a'; ctx.fillRect(-wW/2 + 1, -wH/2 + 2, wW - 2, 3);
    ctx.restore();
  });

  ctx.strokeStyle = '#778899'; ctx.lineWidth = 1.2;
  ctx.strokeRect(-r, -r, r * 2, r * 2);

  ctx.beginPath();
  ctx.moveTo(0, -r + r * 0.28);
  ctx.lineTo(-r * 0.18, -r + r * 0.50);
  ctx.lineTo( r * 0.18, -r + r * 0.50);
  ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();

  ctx.restore();
}

// ── Bezier Evaluation ─────────────────────────────────────────────────────
function evalSegCanvas(si, t) {
  const a = ftcToCvs(waypoints[si].x, waypoints[si].y);
  const b = ftcToCvs(waypoints[si+1].x, waypoints[si+1].y);
  const seg = segments[si];
  const mt = 1 - t;
  if (seg.cps.length === 0) {
    return { x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t };
  } else if (seg.cps.length === 1) {
    const cp = ftcToCvs(seg.cps[0].x, seg.cps[0].y);
    return { x: mt*mt*a.x + 2*mt*t*cp.x + t*t*b.x, y: mt*mt*a.y + 2*mt*t*cp.y + t*t*b.y };
  } else {
    const cp1 = ftcToCvs(seg.cps[0].x, seg.cps[0].y);
    const cp2 = ftcToCvs(seg.cps[1].x, seg.cps[1].y);
    return {
      x: mt*mt*mt*a.x + 3*mt*mt*t*cp1.x + 3*mt*t*t*cp2.x + t*t*t*b.x,
      y: mt*mt*mt*a.y + 3*mt*mt*t*cp1.y + 3*mt*t*t*cp2.y + t*t*t*b.y,
    };
  }
}

function evalSegFTC(si, t) {
  const a = waypoints[si], b = waypoints[si+1];
  const seg = segments[si];
  const mt = 1 - t;
  let x, y;
  if (seg.cps.length === 0) {
    x = a.x + (b.x-a.x)*t; y = a.y + (b.y-a.y)*t;
  } else if (seg.cps.length === 1) {
    const cp = seg.cps[0];
    x = mt*mt*a.x + 2*mt*t*cp.x + t*t*b.x;
    y = mt*mt*a.y + 2*mt*t*cp.y + t*t*b.y;
  } else {
    const cp1 = seg.cps[0], cp2 = seg.cps[1];
    x = mt*mt*mt*a.x + 3*mt*mt*t*cp1.x + 3*mt*t*t*cp2.x + t*t*t*b.x;
    y = mt*mt*mt*a.y + 3*mt*mt*t*cp1.y + 3*mt*t*t*cp2.y + t*t*t*b.y;
  }
  const heading = a.heading + ((b.heading - a.heading + 540) % 360 - 180) * t;
  return { x, y, heading };
}
