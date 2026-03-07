// ── R-Tracker TeleOp — Field ──────────────────────────────────────────────

const FIELD_FT = 12;
const TILES = 6;

const fieldImg = new Image();
fieldImg.src = '../assets/decode.webp';

const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');

function resize() {
  const sbW = 270;
  const avW = window.innerWidth - sbW - 28;
  const avH = window.innerHeight - 20;
  const sz = Math.min(avW, avH - 70);
  cvs.width = cvs.height = Math.max(300, sz);
}

function drawField() {
  ctx.drawImage(fieldImg, 0, 0, cvs.width, cvs.height);
}

function lighten(hex, amt) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
  return `rgb(${r},${g},${b})`;
}

function fieldToCvs(fx, fy) {
  const s = cvs.width / FIELD_FT;
  return { x: (fx + FIELD_FT / 2) * s, y: (-fy + FIELD_FT / 2) * s };
}
