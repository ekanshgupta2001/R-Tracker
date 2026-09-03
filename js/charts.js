// ── R-Tracker v2 — tiny canvas charts (no library, theme-aware) ──────────────
// Exposes: window.RTCharts = { radar, columns, palette }

(function () {
  'use strict';

  // Colours come from the CSS tokens in css/global.css (--chart-* and the status
  // tokens), read at draw time so a chart drawn after a theme flip picks up the
  // new theme. Custom properties are returned with var() already substituted.
  // Pages re-draw on the `rt-themechange` event that js/sidebar.js dispatches.
  function palette() {
    var cs = getComputedStyle(document.documentElement);
    function t(name, fallback) {
      var v = (cs.getPropertyValue(name) || '').trim();
      return v || fallback;
    }
    return {
      text: t('--chart-text', '#33425a'),
      grid: t('--chart-grid', 'rgba(22, 35, 58, 0.12)'),
      axis: t('--chart-axis', 'rgba(22, 35, 58, 0.28)'),
      accent: t('--chart-series', '#a3163d'),
      accentFill: t('--chart-series-soft', 'rgba(163, 22, 61, 0.22)'),
      bar: t('--chart-bar', 'rgba(163, 22, 61, 0.72)'),
      barMuted: t('--chart-bar-muted', 'rgba(22, 35, 58, 0.12)'),
      good: t('--good', '#1f8a4c'),
      ok: t('--warn', '#a8651a'),
      poor: t('--bad', '#b8323c')
    };
  }

  // Size the backing store for the device pixel ratio; returns a 2D context in CSS pixels.
  function prepare(canvas, cssW, cssH) {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    return ctx;
  }

  // Radar (spider) chart, values 0–100, one dataset.
  function radar(canvas, labels, values, opts) {
    opts = opts || {};
    var size = opts.size || Math.min(canvas.parentElement ? canvas.parentElement.clientWidth : 280, 300);
    if (!size || size < 120) size = 240;
    var ctx = prepare(canvas, size, size);
    var pal = palette();
    var cx = size / 2, cy = size / 2;
    var r = (size / 2) - 34;
    var n = labels.length;
    var step = (Math.PI * 2) / n;

    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.grid;
    for (var ring = 1; ring <= 4; ring++) {
      var rr = (ring / 4) * r;
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var a = i * step - Math.PI / 2;
        var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.strokeStyle = pal.axis;
    ctx.fillStyle = pal.text;
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var j = 0; j < n; j++) {
      var ang = j * step - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      ctx.stroke();
      var lx = cx + Math.cos(ang) * (r + 18), ly = cy + Math.sin(ang) * (r + 18);
      ctx.fillText(labels[j], lx, ly);
    }

    ctx.beginPath();
    for (var k = 0; k < n; k++) {
      var an = k * step - Math.PI / 2;
      var v = Math.max(0, Math.min(100, Number(values[k]) || 0)) / 100;
      var px = cx + Math.cos(an) * r * v, py = cy + Math.sin(an) * r * v;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = pal.accentFill;
    ctx.fill();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = pal.accent;
    for (var m = 0; m < n; m++) {
      var am = m * step - Math.PI / 2;
      var vm = Math.max(0, Math.min(100, Number(values[m]) || 0)) / 100;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(am) * r * vm, cy + Math.sin(am) * r * vm, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Column chart: items = [{ label, value }], integer-ish values.
  function columns(canvas, items, opts) {
    opts = opts || {};
    var w = opts.width || (canvas.parentElement ? canvas.parentElement.clientWidth : 480) || 480;
    var h = opts.height || 140;
    var ctx = prepare(canvas, w, h);
    var pal = palette();
    var padL = 26, padR = 8, padT = 10, padB = 22;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    var n = items.length;
    if (!n) return;
    var max = 0;
    items.forEach(function (it) { if (it.value > max) max = it.value; });
    max = Math.max(1, Math.ceil(max));

    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    var ticks = Math.min(max, 4);
    for (var t = 0; t <= ticks; t++) {
      var val = Math.round((max / ticks) * t);
      var y = padT + plotH - (val / max) * plotH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(String(val), padL - 6, y);
    }

    var gap = 4;
    var bw = Math.max(2, (plotW - gap * (n - 1)) / n);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    items.forEach(function (it, i) {
      var x = padL + i * (bw + gap);
      var bh = (Math.max(0, it.value) / max) * plotH;
      ctx.fillStyle = it.value > 0 ? (it.highlight ? pal.accent : pal.bar) : pal.barMuted;
      ctx.fillRect(x, padT + plotH - bh, bw, Math.max(bh, it.value > 0 ? 2 : 1));
      if (it.label && (n <= 8 || i % Math.ceil(n / 8) === 0 || i === n - 1)) {
        ctx.fillStyle = pal.text;
        ctx.fillText(it.label, x + bw / 2, padT + plotH + 4);
      }
    });
  }

  window.RTCharts = { radar: radar, columns: columns, palette: palette };
})();
