// ── R-Tracker Path Planner — UI, Cloud Modal & Init ──────────────────────

// ── Waypoint Editor ───────────────────────────────────────────────────────
function refreshUI() {
  renderWpList();
  renderEditor();
  updatePlayButton();
  updateCode();
  drawAll();
}

function renderWpList() {
  const list = document.getElementById('wpList');
  document.getElementById('wpCount').textContent = waypoints.length + ' point' + (waypoints.length !== 1 ? 's' : '');
  if (waypoints.length === 0) {
    list.innerHTML = '<div class="wp-empty">Click the field to place waypoints.</div>';
    return;
  }
  let html = '';
  waypoints.forEach((wp, i) => {
    html += `
      <div class="wp-card${i === selectedIdx ? ' selected' : ''}" onclick="selectWp(${i})" style="margin-bottom:0;">
        <div class="wp-num">${i + 1}</div>
        <div class="wp-info">
          <div class="wp-coords">(${wp.x.toFixed(1)}, ${wp.y.toFixed(1)}) in</div>
          <div class="wp-heading">Heading: ${wp.heading.toFixed(1)}° · ${wp.action}</div>
        </div>
        <button class="wp-delete" onclick="event.stopPropagation(); deleteWpAt(${i})" title="Delete">✕</button>
      </div>`;
    if (i < waypoints.length - 1) {
      const seg = segments[i];
      const isCurved = seg.cps.length > 0;
      html += `
      <div class="seg-row">
        <span class="seg-row-label">↕ ${i+1}→${i+2}</span>
        <select class="seg-select${isCurved ? ' curved' : ''}"
          onchange="setSegmentType(${i}, this.value)"
          onclick="event.stopPropagation()">
          <option value="line"${!isCurved ? ' selected' : ''}>BezierLine</option>
          <option value="curve"${isCurved ? ' selected' : ''}>BezierCurve</option>
        </select>
      </div>`;
    }
  });
  list.innerHTML = html;
}

function selectWp(i) { selectedIdx = i; selectedSegIdx = -1; refreshUI(); }

function renderEditor() {
  const titleEl = document.getElementById('editorSectionTitle');
  const content = document.getElementById('editorContent');
  const delBtn  = document.getElementById('btnDelSel');

  if (selectedIdx >= 0 && selectedIdx < waypoints.length) {
    titleEl.textContent = `Waypoint ${selectedIdx + 1}`;
    delBtn.disabled = false;
    renderWaypointEditor();
  } else if (selectedSegIdx >= 0 && selectedSegIdx < segments.length) {
    titleEl.textContent = `Segment ${selectedSegIdx + 1} → ${selectedSegIdx + 2}`;
    delBtn.disabled = true;
    renderSegmentEditor(selectedSegIdx);
  } else {
    titleEl.textContent = 'Selection';
    delBtn.disabled = true;
    content.innerHTML = '<div class="no-select-msg">Click a waypoint or path segment to select it.</div>';
  }
}

function renderWaypointEditor() {
  if (selectedIdx < 0 || selectedIdx >= waypoints.length) return;
  const wp = waypoints[selectedIdx];
  document.getElementById('editorContent').innerHTML = `
    <div class="editor-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">X (0–144 in)</label>
          <input type="number" class="form-input" id="edX" value="${wp.x}" step="0.5" min="0" max="144" oninput="editorUpdate()">
        </div>
        <div class="form-group">
          <label class="form-label">Y (0–144 in)</label>
          <input type="number" class="form-input" id="edY" value="${wp.y}" step="0.5" min="0" max="144" oninput="editorUpdate()">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label class="form-label">Heading (°)</label>
          <div class="angle-row">
            <canvas id="anglePicker" width="40" height="40" title="Click or drag to set heading"></canvas>
            <input type="number" class="form-input" id="edH" value="${wp.heading}" step="1" min="-180" max="180" oninput="editorUpdate()">
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Wait (ms)</label>
          <input type="number" class="form-input" id="edW" value="${wp.waitMs}" step="100" min="0" oninput="editorUpdate()">
        </div>
        <div class="form-group">
          <label class="form-label">Action</label>
          <select class="form-select" id="edA" onchange="editorUpdate()">
            ${['None','Wait','Intake','Outtake','Custom'].map(a => `<option${a===wp.action?' selected':''}>${a}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;
  drawAnglePicker(wp.heading);
  initAnglePicker();
}

function renderSegmentEditor(si) {
  const seg = segments[si];
  const canAdd = seg.cps.length < 2;
  const typeLabel = seg.cps.length === 0 ? 'BezierLine — straight path'
                  : seg.cps.length === 1  ? 'BezierCurve — 1 control point'
                  : 'BezierCurve — 2 control points';

  document.getElementById('editorContent').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px;">
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">${typeLabel}</div>
      ${canAdd ? `<button class="tbtn primary" style="align-self:flex-start;" onclick="addControlPoint(${si})">+ Add Control Point</button>` : ''}
      ${seg.cps.map((cp, ci) => `
        <div class="cp-card">
          <div class="cp-card-title">
            Control Point ${ci + 1}
            <button class="cp-remove-btn" onclick="removeCP(${si}, ${ci})" title="Remove CP">✕</button>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">X (0–144)</label>
              <input type="number" class="form-input" value="${cp.x.toFixed(1)}" step="0.5" min="0" max="144"
                oninput="updateCP(${si}, ${ci}, 'x', this.value)">
            </div>
            <div class="form-group">
              <label class="form-label">Y (0–144)</label>
              <input type="number" class="form-input" value="${cp.y.toFixed(1)}" step="0.5" min="0" max="144"
                oninput="updateCP(${si}, ${ci}, 'y', this.value)">
            </div>
          </div>
        </div>`).join('')}
      ${seg.cps.length === 0 ? '<div style="font-size:11px;color:var(--text-muted);line-height:1.6;">Add control points to create a Bezier curve.</div>' : ''}
    </div>`;
}

function editorUpdate() {
  if (selectedIdx < 0) return;
  const wp = waypoints[selectedIdx];
  wp.x       = parseFloat(document.getElementById('edX').value) || 0;
  wp.y       = parseFloat(document.getElementById('edY').value) || 0;
  wp.heading = parseFloat(document.getElementById('edH').value) || 0;
  wp.waitMs  = parseInt(document.getElementById('edW').value)   || 0;
  wp.action  = document.getElementById('edA').value;
  drawAnglePicker(wp.heading);
  renderWpList();
  updateCode();
  drawAll();
}

function drawAnglePicker(deg) {
  const pc = document.getElementById('anglePicker');
  if (!pc) return;
  const pctx = pc.getContext('2d');
  const cx = 20, cy = 20, r = 16;
  pctx.clearRect(0, 0, 40, 40);
  pctx.beginPath(); pctx.arc(cx, cy, r, 0, Math.PI * 2);
  pctx.strokeStyle = '#800020'; pctx.lineWidth = 1.5; pctx.stroke();
  pctx.fillStyle = '#181818'; pctx.fill();
  const ang = (deg - 90) * Math.PI / 180;
  const ex = cx + Math.cos(ang) * (r - 3);
  const ey = cy + Math.sin(ang) * (r - 3);
  pctx.strokeStyle = '#a0334a'; pctx.lineWidth = 2; pctx.lineCap = 'round';
  pctx.beginPath(); pctx.moveTo(cx, cy); pctx.lineTo(ex, ey); pctx.stroke();
  pctx.fillStyle = '#800020';
  pctx.beginPath(); pctx.arc(ex, ey, 2.5, 0, Math.PI * 2); pctx.fill();
}

function initAnglePicker() {
  const pc = document.getElementById('anglePicker');
  if (!pc || pc._inited) return;
  pc._inited = true;
  function onMove(e) {
    const rect = pc.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const px2 = (e.touches ? e.touches[0].clientX : e.clientX) - cx;
    const py2 = (e.touches ? e.touches[0].clientY : e.clientY) - cy;
    let deg = Math.atan2(py2, px2) * 180 / Math.PI + 90;
    if (deg > 180) deg -= 360;
    if (deg < -180) deg += 360;
    document.getElementById('edH').value = deg.toFixed(1);
    editorUpdate();
  }
  let down = false;
  pc.addEventListener('mousedown', () => { down = true; });
  window.addEventListener('mouseup', () => { down = false; });
  pc.addEventListener('mousemove', e => { if (down) onMove(e); });
  pc.addEventListener('click', onMove);
  pc.addEventListener('touchstart', e => { e.preventDefault(); onMove(e); }, { passive: false });
  pc.addEventListener('touchmove',  e => { e.preventDefault(); onMove(e); }, { passive: false });
}

function updatePathSettings() {
  pathSettings.speed = parseFloat(document.getElementById('speedSlider').value);
  document.getElementById('speedVal').textContent = pathSettings.speed.toFixed(2) + '×';
}

function updatePlayButton() {
  document.getElementById('btnRobotAnim').disabled = waypoints.length < 2;
}

// ── Cloud Modal ───────────────────────────────────────────────────────────
let _cloudMode = 'save';

function openCloudModal(mode) {
  if (!rtUser) { alert('Please sign in to save or load paths.'); return; }
  _cloudMode = mode;
  const modal   = document.getElementById('pp-cloud-modal');
  const saveRow = document.getElementById('ppc-save-row');
  const loadSec = document.getElementById('ppc-load-section');
  clearCloudMsg();
  if (mode === 'save') {
    modal.querySelector('.ppc-title').textContent = 'Save Path to Cloud';
    saveRow.style.display = 'flex'; loadSec.style.display = 'none';
  } else {
    modal.querySelector('.ppc-title').textContent = 'Load Path from Cloud';
    saveRow.style.display = 'none'; loadSec.style.display = 'block';
    renderCloudPaths();
  }
  document.getElementById('pp-cloud-backdrop').classList.add('open');
}

function closeCloudModal()  { document.getElementById('pp-cloud-backdrop').classList.remove('open'); }
function clearCloudMsg()    { const el = document.getElementById('ppc-msg'); if (el) { el.textContent = ''; el.className = 'ppc-msg'; } }
function setCloudMsg(msg, isErr) {
  const el = document.getElementById('ppc-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = 'ppc-msg' + (isErr ? ' err' : '');
}

async function savePathToCloud() {
  const nameInput = document.getElementById('ppc-name-input');
  const name = nameInput.value.trim();
  if (!name) { setCloudMsg('Please enter a path name.', true); return; }
  if (!rtUser) { setCloudMsg('Not signed in.', true); return; }
  setCloudMsg('Saving...', false);
  try {
    const snap = await rtDb.collection('users').doc(rtUser.uid)
      .collection('paths').where('name', '==', name).limit(1).get();
    const data = {
      name,
      waypoints: JSON.parse(JSON.stringify(waypoints)),
      segments:  JSON.parse(JSON.stringify(segments)),
      pathSettings: JSON.parse(JSON.stringify(pathSettings)),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (!snap.empty) {
      await snap.docs[0].ref.update(data);
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await rtDb.collection('users').doc(rtUser.uid).collection('paths').add(data);
    }
    setCloudMsg('Path saved!', false);
    nameInput.value = '';
  } catch (e) {
    setCloudMsg('Error: ' + e.message, true);
  }
}

async function renderCloudPaths() {
  const container = document.getElementById('ppc-path-list');
  container.innerHTML = '<div class="ppc-empty">Loading...</div>';
  try {
    const snap = await rtDb.collection('users').doc(rtUser.uid)
      .collection('paths').orderBy('updatedAt', 'desc').get();
    if (snap.empty) { container.innerHTML = '<div class="ppc-empty">No saved paths yet.</div>'; return; }
    container.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const updated = d.updatedAt ? new Date(d.updatedAt.toMillis()).toLocaleDateString() : '';
      const row = document.createElement('div');
      row.className = 'ppc-path-item';
      row.innerHTML = `
        <div onclick="loadCloudPath('${doc.id}')" style="flex:1;min-width:0">
          <div class="ppc-path-name">${d.name}</div>
          <div class="ppc-path-meta">${(d.waypoints||[]).length} waypoints &middot; ${updated}</div>
        </div>
        <button class="ppc-path-del" onclick="deleteCloudPath('${doc.id}',event)" title="Delete">&#128465;</button>`;
      container.appendChild(row);
    });
  } catch (e) {
    container.innerHTML = `<div class="ppc-empty" style="color:#ff5544">Error: ${e.message}</div>`;
  }
}

async function loadCloudPath(docId) {
  if (!rtUser) return;
  setCloudMsg('Loading...', false);
  try {
    const doc = await rtDb.collection('users').doc(rtUser.uid).collection('paths').doc(docId).get();
    if (!doc.exists) { setCloudMsg('Path not found.', true); return; }
    const d = doc.data();
    waypoints = d.waypoints || []; segments = d.segments || [];
    if (d.pathSettings) Object.assign(pathSettings, d.pathSettings);
    selectedIdx = -1;
    updateCode(); renderWpList(); drawAll();
    setCloudMsg('Path "' + d.name + '" loaded!', false);
    setTimeout(closeCloudModal, 1200);
  } catch (e) {
    setCloudMsg('Error: ' + e.message, true);
  }
}

async function deleteCloudPath(docId, event) {
  event.stopPropagation();
  if (!confirm('Delete this saved path?')) return;
  try {
    await rtDb.collection('users').doc(rtUser.uid).collection('paths').doc(docId).delete();
    renderCloudPaths();
  } catch (e) {
    setCloudMsg('Error: ' + e.message, true);
  }
}

// ── Page Transitions ──────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || a.getAttribute('href').startsWith('#') || a.getAttribute('href').startsWith('http')) return;
  e.preventDefault();
  const href = a.getAttribute('href');
  document.body.style.transition = 'opacity 0.18s ease';
  document.body.style.opacity = '0';
  setTimeout(() => window.location.href = href, 180);
});

// ── Resize ────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => { resizeCanvas(); drawAll(); });

// ── Init ──────────────────────────────────────────────────────────────────
initSidebar();
resizeCanvas();
updatePathSettings();
updateCode();
drawAll();
initAuth();
