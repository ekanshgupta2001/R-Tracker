// ── R-Tracker TeleOp — Field ──────────────────────────────────────────────

const FIELD_FT = 12;
const TILES = 6;

const fieldImg = new Image();
fieldImg.src = '../../assets/decode.webp';

const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');

// The field fills #field-container minus the chrome stacked above and below it
// (mode tabs, control bar, mini stats) — measured, so the CSS can change their
// height without this constant drifting. #field-container's own size comes from
// the flex layout, not from the canvas, so measuring it here is stable.
function resize() {
  const fc = document.getElementById('field-container');
  const wrap = document.getElementById('field-wrap');
  let avW = window.innerWidth - 320, avH = window.innerHeight - 170;
  if (fc && wrap) {
    const gap = parseFloat(getComputedStyle(fc).rowGap) || 10;
    let chrome = 0, n = 0;
    for (const el of fc.children) {
      if (el === wrap) continue;
      if (el.offsetHeight) { chrome += el.offsetHeight; n++; }
    }
    avW = fc.clientWidth - 2;                 // #field-wrap border
    avH = fc.clientHeight - chrome - gap * n - 2;
  }
  cvs.width = cvs.height = Math.max(300, Math.floor(Math.min(avW, avH)));
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
