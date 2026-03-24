// ── R-Tracker Strategy Planner — Annotation Engine ──────────────────────────
(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  var FIELD_IN = 144;
  var MAX_UNDO = 50;
  var COLORS = ['#ff4444', '#4488ff', '#44ff88', '#ffaa00', '#ff44ff', '#ffffff'];
  var WIDTHS = [2, 4, 8];

  // ── State ──────────────────────────────────────────────────────────────────
  var cvs, ctx, miniCvs, miniCtx;
  var W = 0;
  var fieldImg = new Image();
  var annotations = [];
  var undoStack = [];
  var redoStack = [];
  var tool = 'draw';
  var color = COLORS[0];
  var lineW = WIDTHS[1];
  var drawing = false;
  var current = null;
  var startPt = null;
  var presenting = false;
  var notesCollapsed = false;
  var waypointCounter = 1;

  // ── Coord helpers ──────────────────────────────────────────────────────────
  function getFieldPos(e) {
    var rect = cvs.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * FIELD_IN,
      y: (e.clientY - rect.top) / rect.height * FIELD_IN
    };
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  function snapshot() {
    undoStack.push(JSON.stringify(annotations));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoButtons();
  }

  function updateUndoButtons() {
    var u = document.getElementById('undoBtn');
    var r = document.getElementById('redoBtn');
    if (u) u.disabled = undoStack.length === 0;
    if (r) r.disabled = redoStack.length === 0;
  }

  window.stratUndo = function () {
    if (undoStack.length === 0) return;
    redoStack.push(JSON.stringify(annotations));
    annotations = JSON.parse(undoStack.pop());
    updateUndoButtons();
    render();
    renderMinimap();
  };

  window.stratRedo = function () {
    if (redoStack.length === 0) return;
    undoStack.push(JSON.stringify(annotations));
    annotations = JSON.parse(redoStack.pop());
    updateUndoButtons();
    render();
    renderMinimap();
  };

  // ── Rendering ──────────────────────────────────────────────────────────────
  function render() {
    if (!cvs) return;
    ctx.clearRect(0, 0, W, W);
    if (fieldImg.complete && fieldImg.naturalWidth) {
      ctx.drawImage(fieldImg, 0, 0, W, W);
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, W, W);
    }
    for (var i = 0; i < annotations.length; i++) {
      drawAnnotation(ctx, annotations[i], W);
    }
    if (current) drawAnnotation(ctx, current, W);
  }

  function drawAnnotation(c, a, size) {
    var s = size / FIELD_IN;
    c.save();
    c.strokeStyle = a.color || '#fff';
    c.fillStyle = a.color || '#fff';
    c.lineWidth = (a.lineWidth || 2) * s;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    switch (a.type) {
      case 'draw':
        if (!a.points || a.points.length < 2) break;
        c.beginPath();
        c.moveTo(a.points[0].x * s, a.points[0].y * s);
        for (var i = 1; i < a.points.length; i++) {
          c.lineTo(a.points[i].x * s, a.points[i].y * s);
        }
        c.stroke();
        break;

      case 'arrow':
        if (!a.start || !a.end) break;
        var x1 = a.start.x * s, y1 = a.start.y * s;
        var x2 = a.end.x * s, y2 = a.end.y * s;
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
        var angle = Math.atan2(y2 - y1, x2 - x1);
        var headLen = Math.max(8, (a.lineWidth || 2) * s * 3);
        c.beginPath();
        c.moveTo(x2, y2);
        c.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
        c.moveTo(x2, y2);
        c.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
        c.stroke();
        break;

      case 'rect':
        c.strokeRect(a.x * s, a.y * s, a.w * s, a.h * s);
        break;

      case 'circle':
        c.beginPath();
        c.arc(a.cx * s, a.cy * s, Math.abs(a.r) * s, 0, Math.PI * 2);
        c.stroke();
        break;

      case 'text':
        var fs = (a.fontSize || 14) * s;
        c.font = 'bold ' + fs + 'px Inter, sans-serif';
        c.fillText(a.text, a.x * s, a.y * s);
        break;

      case 'robot':
        var rx = a.x * s, ry = a.y * s;
        var rw = 10.8 * s, rh = 10.8 * s;
        var hdg = (a.heading || 0) * Math.PI / 180;
        c.save();
        c.translate(rx, ry);
        c.rotate(hdg);
        c.strokeStyle = a.color;
        c.lineWidth = 2 * s;
        c.strokeRect(-rw / 2, -rh / 2, rw, rh);
        c.beginPath();
        c.moveTo(-rw / 4, -rh / 2);
        c.lineTo(0, -rh / 2 - 4 * s);
        c.lineTo(rw / 4, -rh / 2);
        c.stroke();
        c.restore();
        break;

      case 'waypoint':
        var wx = a.x * s, wy = a.y * s;
        var rad = 8 * s;
        c.beginPath();
        c.arc(wx, wy, rad, 0, Math.PI * 2);
        c.fillStyle = a.color;
        c.fill();
        c.strokeStyle = '#000';
        c.lineWidth = 1.5 * s;
        c.stroke();
        var fs2 = 10 * s;
        c.font = 'bold ' + fs2 + 'px Inter, sans-serif';
        c.fillStyle = '#000';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(a.label || '', wx, wy);
        c.textAlign = 'start';
        c.textBaseline = 'alphabetic';
        break;
    }
    c.restore();
  }

  // ── Mouse Handlers ─────────────────────────────────────────────────────────
  function onDown(e) {
    if (presenting) return;
    var p = getFieldPos(e);
    drawing = true;
    startPt = p;

    switch (tool) {
      case 'draw':
        current = { type: 'draw', color: color, lineWidth: lineW, points: [p] };
        break;
      case 'arrow':
        current = { type: 'arrow', color: color, lineWidth: lineW, start: p, end: p };
        break;
      case 'rect':
        current = { type: 'rect', color: color, lineWidth: lineW, x: p.x, y: p.y, w: 0, h: 0 };
        break;
      case 'circle':
        current = { type: 'circle', color: color, lineWidth: lineW, cx: p.x, cy: p.y, r: 0 };
        break;
      case 'text':
        showTextInput(e.clientX, e.clientY, p);
        drawing = false;
        break;
      case 'robot':
        snapshot();
        annotations.push({ type: 'robot', color: color, x: p.x, y: p.y, heading: 0, lineWidth: lineW });
        render();
        renderMinimap();
        drawing = false;
        break;
      case 'waypoint':
        snapshot();
        annotations.push({ type: 'waypoint', color: color, x: p.x, y: p.y, label: String(waypointCounter++), lineWidth: lineW });
        render();
        renderMinimap();
        drawing = false;
        break;
      case 'eraser':
        eraseAt(p);
        drawing = false;
        break;
    }
  }

  function onMove(e) {
    if (!drawing || !current) return;
    var p = getFieldPos(e);
    switch (tool) {
      case 'draw':
        current.points.push(p);
        break;
      case 'arrow':
        current.end = p;
        break;
      case 'rect':
        current.w = p.x - startPt.x;
        current.h = p.y - startPt.y;
        break;
      case 'circle':
        current.r = Math.hypot(p.x - startPt.x, p.y - startPt.y);
        break;
    }
    render();
  }

  function onUp() {
    if (!drawing) return;
    drawing = false;
    if (current) {
      var valid = true;
      if (current.type === 'draw' && current.points.length < 2) valid = false;
      if (current.type === 'arrow') {
        var d = Math.hypot(current.end.x - current.start.x, current.end.y - current.start.y);
        if (d < 1) valid = false;
      }
      if (current.type === 'rect' && Math.abs(current.w) < 1 && Math.abs(current.h) < 1) valid = false;
      if (current.type === 'circle' && current.r < 1) valid = false;

      if (valid) {
        snapshot();
        annotations.push(current);
        renderMinimap();
      }
      current = null;
      render();
    }
  }

  // ── Touch Handlers ─────────────────────────────────────────────────────────
  function onTouchDown(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      var t = e.touches[0];
      onDown({ clientX: t.clientX, clientY: t.clientY });
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      var t = e.touches[0];
      onMove({ clientX: t.clientX, clientY: t.clientY });
    }
  }

  function onTouchUp() { onUp(); }

  // ── Eraser ─────────────────────────────────────────────────────────────────
  function eraseAt(p) {
    var threshold = 6;
    for (var i = annotations.length - 1; i >= 0; i--) {
      if (hitTest(annotations[i], p, threshold)) {
        snapshot();
        annotations.splice(i, 1);
        render();
        renderMinimap();
        break;
      }
    }
  }

  function hitTest(a, p, t) {
    switch (a.type) {
      case 'draw':
        for (var i = 0; i < a.points.length; i++) {
          if (Math.hypot(a.points[i].x - p.x, a.points[i].y - p.y) < t) return true;
        }
        return false;
      case 'arrow':
        return distToSeg(p, a.start, a.end) < t;
      case 'rect':
        var rx = Math.min(a.x, a.x + a.w), ry = Math.min(a.y, a.y + a.h);
        var rw = Math.abs(a.w), rh = Math.abs(a.h);
        return distToSeg(p, {x:rx,y:ry}, {x:rx+rw,y:ry}) < t ||
               distToSeg(p, {x:rx+rw,y:ry}, {x:rx+rw,y:ry+rh}) < t ||
               distToSeg(p, {x:rx+rw,y:ry+rh}, {x:rx,y:ry+rh}) < t ||
               distToSeg(p, {x:rx,y:ry+rh}, {x:rx,y:ry}) < t;
      case 'circle':
        return Math.abs(Math.hypot(p.x - a.cx, p.y - a.cy) - a.r) < t;
      case 'text':
        return Math.hypot(p.x - a.x, p.y - a.y) < t * 2;
      case 'robot':
      case 'waypoint':
        return Math.hypot(p.x - a.x, p.y - a.y) < t;
    }
    return false;
  }

  function distToSeg(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    var t2 = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    return Math.hypot(p.x - (a.x + t2 * dx), p.y - (a.y + t2 * dy));
  }

  // ── Text Input Overlay ─────────────────────────────────────────────────────
  function showTextInput(clientX, clientY, fieldPos) {
    var overlay = document.getElementById('textInputOverlay');
    var input = document.getElementById('textInputField');
    if (!overlay || !input) return;

    var panel = document.getElementById('fieldPanel');
    var pr = panel.getBoundingClientRect();
    overlay.style.left = (clientX - pr.left) + 'px';
    overlay.style.top = (clientY - pr.top) + 'px';
    overlay.classList.add('visible');
    input.value = '';
    input.focus();

    function submit() {
      var text = input.value.trim();
      if (text) {
        snapshot();
        annotations.push({ type: 'text', color: color, text: text, x: fieldPos.x, y: fieldPos.y, fontSize: 14 + lineW * 2, lineWidth: lineW });
        render();
        renderMinimap();
      }
      cleanup();
    }

    function onKeyInput(e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      if (e.key === 'Escape') cleanup();
    }

    function onBlurInput() { submit(); }

    function cleanup() {
      overlay.classList.remove('visible');
      input.removeEventListener('keydown', onKeyInput);
      input.removeEventListener('blur', onBlurInput);
    }

    input.addEventListener('keydown', onKeyInput);
    input.addEventListener('blur', onBlurInput);
  }

  // ── Minimap ────────────────────────────────────────────────────────────────
  function renderMinimap() {
    if (!miniCvs || !miniCtx) return;
    var ms = miniCvs.width;
    miniCtx.clearRect(0, 0, ms, ms);
    if (fieldImg.complete && fieldImg.naturalWidth) {
      miniCtx.drawImage(fieldImg, 0, 0, ms, ms);
    } else {
      miniCtx.fillStyle = '#222';
      miniCtx.fillRect(0, 0, ms, ms);
    }
    for (var i = 0; i < annotations.length; i++) {
      drawAnnotation(miniCtx, annotations[i], ms);
    }
  }

  // ── Tool / Color / Width Selection ─────────────────────────────────────────
  window.setTool = function (t) {
    tool = t;
    var btns = document.querySelectorAll('.tool-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-tool') === t);
    }
    cvs.style.cursor = t === 'eraser' ? 'cell' : t === 'text' ? 'text' : 'crosshair';
  };

  window.setColor = function (c) {
    color = c;
    var swatches = document.querySelectorAll('.color-swatch');
    for (var i = 0; i < swatches.length; i++) {
      swatches[i].classList.toggle('active', swatches[i].getAttribute('data-color') === c);
    }
  };

  window.setLineWidth = function (w) {
    lineW = w;
    var btns = document.querySelectorAll('.width-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', Number(btns[i].getAttribute('data-width')) === w);
    }
  };

  // ── Clear All ──────────────────────────────────────────────────────────────
  window.stratClearAll = function () {
    if (annotations.length === 0) return;
    if (!confirm('Clear all annotations?')) return;
    snapshot();
    annotations = [];
    waypointCounter = 1;
    render();
    renderMinimap();
  };

  // ── Export PNG ──────────────────────────────────────────────────────────────
  window.stratExportPNG = function () {
    var exportSize = 2048;
    var ec = document.createElement('canvas');
    ec.width = exportSize;
    ec.height = exportSize;
    var ectx = ec.getContext('2d');
    if (fieldImg.complete && fieldImg.naturalWidth) {
      ectx.drawImage(fieldImg, 0, 0, exportSize, exportSize);
    }
    for (var i = 0; i < annotations.length; i++) {
      drawAnnotation(ectx, annotations[i], exportSize);
    }
    var link = document.createElement('a');
    link.download = 'strategy-' + Date.now() + '.png';
    link.href = ec.toDataURL('image/png');
    link.click();
  };

  // ── Notes Panel ────────────────────────────────────────────────────────────
  window.toggleNotes = function () {
    notesCollapsed = !notesCollapsed;
    var panel = document.getElementById('notesPanel');
    var expandBtn = document.getElementById('notesExpandBtn');
    if (panel) panel.classList.toggle('collapsed', notesCollapsed);
    if (expandBtn) expandBtn.classList.toggle('visible', notesCollapsed);
    setTimeout(resize, 320);
  };

  // ── Presentation Mode ──────────────────────────────────────────────────────
  window.togglePresentation = function () {
    presenting = !presenting;
    document.body.classList.toggle('presenting', presenting);
    var sidebar = document.getElementById('sidebar');
    if (sidebar) {
      if (presenting) sidebar.style.display = 'none';
      else sidebar.style.display = '';
    }
    setTimeout(resize, 350);
  };

  // ── Keyboard ───────────────────────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      stratUndo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      stratRedo();
    }
    if (e.key === 'Escape' && presenting) {
      togglePresentation();
    }
  }

  // ── Save / Load (Firebase) ─────────────────────────────────────────────────
  window.openStratModal = function (mode) {
    var backdrop = document.getElementById('strat-modal-backdrop');
    var saveRow = document.getElementById('sm-save-row');
    var loadSection = document.getElementById('sm-load-section');
    var title = document.getElementById('sm-title');
    var msg = document.getElementById('sm-msg');
    if (msg) { msg.textContent = ''; msg.className = 'sm-msg'; }

    if (mode === 'save') {
      saveRow.style.display = 'flex';
      loadSection.style.display = 'none';
      title.textContent = 'Save Strategy';
    } else {
      saveRow.style.display = 'none';
      loadSection.style.display = 'block';
      title.textContent = 'Load Strategy';
      loadStratList();
    }
    backdrop.classList.add('open');
  };

  window.closeStratModal = function () {
    document.getElementById('strat-modal-backdrop').classList.remove('open');
  };

  window.saveStrategy = function () {
    var nameInput = document.getElementById('sm-name-input');
    var msg = document.getElementById('sm-msg');
    var name = (nameInput.value || '').trim();
    if (!name) { msg.textContent = 'Enter a name.'; msg.className = 'sm-msg err'; return; }
    if (!window.rtUser) { msg.textContent = 'Sign in first.'; msg.className = 'sm-msg err'; return; }

    var teamId = window.rtUserTeamId;
    var notes = (document.getElementById('strategyNotes') || {}).value || '';

    var collection = teamId
      ? window.rtDb.collection('teams').doc(teamId).collection('strategies')
      : window.rtDb.collection('users').doc(window.rtUser.uid).collection('strategies');

    collection.doc(name).set({
      name: name,
      annotations: JSON.stringify(annotations),
      notes: notes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: window.rtUser.displayName || window.rtUser.email
    }).then(function () {
      msg.textContent = 'Saved!';
      msg.className = 'sm-msg';
      nameInput.value = '';
      setTimeout(closeStratModal, 800);
    }).catch(function (e) {
      msg.textContent = 'Error: ' + e.message;
      msg.className = 'sm-msg err';
    });
  };

  function loadStratList() {
    var list = document.getElementById('sm-strat-list');
    if (!list) return;
    list.innerHTML = '<div class="sm-empty">Loading...</div>';

    if (!window.rtUser) { list.innerHTML = '<div class="sm-empty">Sign in first.</div>'; return; }

    var teamId = window.rtUserTeamId;
    var collection = teamId
      ? window.rtDb.collection('teams').doc(teamId).collection('strategies')
      : window.rtDb.collection('users').doc(window.rtUser.uid).collection('strategies');

    collection.orderBy('updatedAt', 'desc').get().then(function (snap) {
      if (snap.empty) { list.innerHTML = '<div class="sm-empty">No saved strategies yet.</div>'; return; }

      list.innerHTML = '';
      snap.forEach(function (doc) {
        var d = doc.data();
        var item = document.createElement('div');
        item.className = 'sm-item';
        var when = d.updatedAt ? new Date(d.updatedAt.seconds * 1000).toLocaleDateString() : '';
        item.innerHTML =
          '<div><div class="sm-item-name">' + escH(d.name) + '</div>' +
          '<div class="sm-item-meta">' + escH(when) + (d.updatedBy ? ' by ' + escH(d.updatedBy) : '') + '</div></div>' +
          '<button class="sm-item-del" data-id="' + escH(doc.id) + '" title="Delete">&#10005;</button>';

        item.addEventListener('click', function (e) {
          if (e.target.closest('.sm-item-del')) return;
          loadStrategy(d);
        });

        item.querySelector('.sm-item-del').addEventListener('click', function (e) {
          e.stopPropagation();
          deleteStrategy(doc.id);
        });

        list.appendChild(item);
      });
    }).catch(function () {
      list.innerHTML = '<div class="sm-empty">Error loading strategies.</div>';
    });
  }

  function loadStrategy(data) {
    try {
      annotations = JSON.parse(data.annotations || '[]');
    } catch (e) {
      annotations = [];
    }
    undoStack = [];
    redoStack = [];
    updateUndoButtons();

    var notes = document.getElementById('strategyNotes');
    if (notes && data.notes) notes.value = data.notes;

    var maxWp = 0;
    for (var i = 0; i < annotations.length; i++) {
      if (annotations[i].type === 'waypoint' && annotations[i].label) {
        var n = parseInt(annotations[i].label, 10);
        if (!isNaN(n) && n > maxWp) maxWp = n;
      }
    }
    waypointCounter = maxWp + 1;

    render();
    renderMinimap();
    closeStratModal();
  }

  function deleteStrategy(id) {
    if (!confirm('Delete this strategy?')) return;
    var teamId = window.rtUserTeamId;
    var collection = teamId
      ? window.rtDb.collection('teams').doc(teamId).collection('strategies')
      : window.rtDb.collection('users').doc(window.rtUser.uid).collection('strategies');
    collection.doc(id).delete().then(function () {
      loadStratList();
    }).catch(function () {
      var msg = document.getElementById('sm-msg');
      if (msg) { msg.textContent = 'Delete failed.'; msg.className = 'sm-msg err'; }
    });
  }

  function escH(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Resize ─────────────────────────────────────────────────────────────────
  function resize() {
    var panel = document.getElementById('fieldPanel');
    if (!panel || !cvs) return;
    var sz = Math.min(panel.clientWidth - 8, panel.clientHeight - 8);
    W = Math.max(sz, 200);
    cvs.width = W;
    cvs.height = W;
    render();
    renderMinimap();
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    cvs = document.getElementById('strategyCanvas');
    if (!cvs) return;
    ctx = cvs.getContext('2d');

    miniCvs = document.getElementById('minimapCanvas');
    if (miniCvs) {
      miniCvs.width = 150;
      miniCvs.height = 150;
      miniCtx = miniCvs.getContext('2d');
    }

    fieldImg.crossOrigin = 'anonymous';
    fieldImg.src = '../assets/decode.webp';
    fieldImg.onload = function () { resize(); };

    cvs.addEventListener('mousedown', onDown);
    cvs.addEventListener('mousemove', onMove);
    cvs.addEventListener('mouseup', onUp);
    cvs.addEventListener('mouseleave', onUp);
    cvs.addEventListener('touchstart', onTouchDown, { passive: false });
    cvs.addEventListener('touchmove', onTouchMove, { passive: false });
    cvs.addEventListener('touchend', onTouchUp);

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', resize);

    resize();
    updateUndoButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
