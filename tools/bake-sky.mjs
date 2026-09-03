// Bakes assets/summit-sky.svg into assets/summit-sky.webp, which is what the
// homepage actually loads.
//
// Why: the sky is drawn through twelve feTurbulence / feDisplacementMap filters,
// and an SVG filter chain is re-run on every repaint that touches it. There is
// no cached layer for it — will-change, contain:paint and layer promotion all
// fail to avoid the work — so anything moving over the sky, including the theme
// crossfade, dropped the homepage to ~60fps with 42ms hitches. As a raster the
// same page holds 120fps with no dropped frames. See css/home.css.
//
//   node tools/bake-sky.mjs [quality 0-1, default 0.92]
//
// Chromium does the WebP encoding (the machine has no cwebp/Pillow). Nothing
// here runs at build or request time: the committed .webp is the shipped asset.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/summit-sky.svg');
const OUT = path.join(ROOT, 'assets/summit-sky.webp');
const W = 2880, H = 1800;                     // 2x the 1440x900 art board
const QUALITY = Number(process.argv[2] || 0.92);

const svg = fs.readFileSync(SRC, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(
  '<!doctype html><meta charset="utf-8">' +
  '<style>html,body{margin:0;height:100%;background:#071a42;overflow:hidden}' +
  'svg{position:absolute;inset:0;width:100%;height:100%;display:block}</style>' +
  svg,
  { waitUntil: 'load' }
);
await page.waitForTimeout(1200);              // let the filter chain settle

const png = await page.screenshot({ type: 'png' });
const webp = await page.evaluate(async ({ b64, q, w, h }) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/webp', q);
}, { b64: png.toString('base64'), q: QUALITY, w: W, h: H });

if (!webp.startsWith('data:image/webp')) throw new Error('browser did not encode webp');
const bytes = Buffer.from(webp.split(',')[1], 'base64');
fs.writeFileSync(OUT, bytes);
console.log(`${W}x${H} q${QUALITY} → assets/summit-sky.webp (${(bytes.length / 1024).toFixed(0)} KB)`);
await browser.close();
