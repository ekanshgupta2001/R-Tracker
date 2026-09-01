// ── R-Tracker Sidebar ────────────────────────────────────────────────────────
// Dynamically injects the sidebar and hamburger into every page.
// Load AFTER css/sidebar.css is linked. Auto-inits on DOMContentLoaded.
// Exposes: window.toggleSidebar(), window.toggleTheme(), window.initSidebar(), window.escSidebar()
// The #sidebar-progress slot is filled by the Export/Import controls (Phase 2).

(function () {
  'use strict';

  // Detect if we are inside the /pages/ subdirectory
  const isInPages = window.location.pathname.includes('/pages/');
  const root = isInPages ? '../' : '';

  // Current page identifier for active-nav highlighting
  const pageName = window.location.pathname.split('/').pop().replace('.html', '') || 'index';

  const NAV_ITEMS = [
    { id: 'index', href: root + 'index.html', icon: '🏠', label: 'Home' },
    { id: 'teleop', href: root + 'pages/teleop.html', icon: '🎮', label: 'TeleOp Practice' },
    { id: 'pathplanner', href: root + 'pages/pathplanner.html', icon: '📐', label: 'Path Planner' },
    { id: 'strategy', href: root + 'pages/strategy.html', icon: '📋', label: 'Strategy' },
    { id: 'curriculum', href: root + 'pages/curriculum.html', icon: '📚', label: 'Curriculum' },
    { id: 'report', href: root + 'pages/report.html', icon: '📄', label: 'Driver Report' },
    { id: 'about', href: root + 'pages/about.html', icon: 'ℹ️', label: 'About' },
  ];

  // Build sidebar HTML
  function buildSidebarHTML() {
    const navItems = NAV_ITEMS.map(item => {
      const active = item.id === pageName ? ' active' : '';
      return `<a href="${item.href}" class="nav-item${active}"><span class="nav-icon">${item.icon}</span>${item.label}</a>`;
    }).join('');

    return `
      <button class="hamburger" id="hamburger" onclick="toggleSidebar()"><span class="ham-icon">☰</span></button>
      <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>
      <nav class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-logo"><span class="ftc">R-</span><span class="sim">Tracker</span></div>
          <div class="sidebar-tagline">Rundle Robotics Visualizer</div>
        </div>
        <ul class="sidebar-nav">${navItems}</ul>
        <div class="sidebar-progress" id="sidebar-progress"></div>
        <div class="sidebar-footer">
          <div class="theme-toggle" onclick="toggleTheme()">
            <span>Toggle Theme</span>
            <span class="theme-toggle-icon" id="themeIcon">🌙</span>
          </div>
        </div>
      </nav>
    `;
  }

  // Inject sidebar into a container div if present, or directly into body
  function injectSidebar() {
    const container = document.getElementById('sidebar-container');
    const html = buildSidebarHTML();
    if (container) {
      container.innerHTML = html;
    } else {
      document.body.insertAdjacentHTML('afterbegin', html);
    }
  }

  // ── Theme ──────────────────────────────────────────────────────────────────
  // The only localStorage key in the app: a UI preference, not student data (see AUDIT.md).
  let isDark = !document.documentElement.classList.contains('light');

  function syncThemeIcon() {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = isDark ? '🌙' : '☀️';
  }

  window.toggleTheme = function () {
    isDark = !isDark;
    document.documentElement.classList.toggle('light', !isDark);
    try { localStorage.setItem('rt-theme', isDark ? 'dark' : 'light'); } catch (e) {}
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    icon.classList.add('spin');
    setTimeout(() => {
      icon.textContent = isDark ? '🌙' : '☀️';
      icon.classList.remove('spin');
    }, 400);
  };

  // ── Sidebar Toggle ─────────────────────────────────────────────────────────
  let sidebarOpen = false;

  window.toggleSidebar = function () {
    sidebarOpen = !sidebarOpen;
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const hamIcon = document.querySelector('.ham-icon');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed', !sidebarOpen);
    sidebar.classList.toggle('open', sidebarOpen && window.innerWidth <= 820);
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    document.body.classList.toggle('sidebar-collapsed', !sidebarOpen);
    if (hamIcon) hamIcon.textContent = sidebarOpen ? '✕' : '☰';
    if (backdrop) backdrop.classList.toggle('visible', sidebarOpen && window.innerWidth <= 820);
    animateNavItems();
  };

  function animateNavItems() {
    const items = document.querySelectorAll('.nav-item');
    items.forEach((item, i) => {
      item.classList.remove('nav-visible');
      setTimeout(() => item.classList.add('nav-visible'), 80 + i * 55);
    });
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    if (window.innerWidth > 820) {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (sidebar) sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('visible');
    }
  });

  // ── Escape helper (used by sidebar-injected content) ───────────────────────
  window.escSidebar = function (s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  // ── Progress: Export / Import + unsaved banner ─────────────────────────────
  // Progress lives in this tab (sessionStorage) and in the file the student exports.
  // Export builds a Blob and clicks a detached <a download>; nothing is uploaded.
  let bannerDismissed = false;
  let toastTimer = null;

  function $(id) { return document.getElementById(id); }

  function fmtAgo(ts) {
    const d = Date.now() - ts;
    if (d < 60000) return 'just now';
    if (d < 3600000) return Math.round(d / 60000) + ' min ago';
    if (d < 86400000) return Math.round(d / 3600000) + ' h ago';
    return new Date(ts).toLocaleDateString();
  }

  function hasAnyProgress(s) {
    if (!s) return false;
    if (Object.keys(s.driver.levels || {}).length) return true;
    if ((s.driver.sessions || []).length || (s.driver.coachReports || []).length) return true;
    if ((s.curriculum.attempts || []).length) return true;
    if ((s.paths || []).length || (s.strategies || []).length) return true;
    const phases = s.curriculum.phases || {};
    return Object.keys(phases).some(pid => {
      const ph = phases[pid];
      return ph && ph.status && ph.status !== 'locked' && ph.status !== 'not_started';
    });
  }

  function describeState(s) {
    const levels = Object.keys(s.driver && s.driver.levels || {}).filter(id => s.driver.levels[id] && s.driver.levels[id].bestStars >= 1).length;
    const phases = Object.keys(s.curriculum && s.curriculum.phases || {}).filter(pid => {
      const ph = s.curriculum.phases[pid];
      return ph && (ph.status === 'verified' || ph.status === 'submitted');
    }).length;
    const when = s.meta && s.meta.lastExportedAt ? new Date(s.meta.lastExportedAt).toLocaleString() : 'unknown date';
    const who = s.profile && s.profile.displayName ? ' for ' + s.profile.displayName : '';
    return 'Exported ' + when + who + ' · ' + levels + ' level' + (levels === 1 ? '' : 's') + ' completed · ' + phases + ' curriculum phase' + (phases === 1 ? '' : 's') + ' done.';
  }

  function ensureBanner() {
    if ($('rt-dirty-banner')) return;
    const b = document.createElement('div');
    b.id = 'rt-dirty-banner';
    b.className = 'rt-dirty-banner';
    b.hidden = true;
    b.innerHTML =
      '<span class="rt-dirty-text" id="rt-dirty-text">Progress not saved to a file yet — it disappears when this tab closes.</span>' +
      '<button class="rt-dirty-btn" onclick="rtExportProgress()">Export now</button>' +
      '<button class="rt-dirty-close" onclick="rtDismissBanner()" title="Hide">&#10005;</button>';
    document.body.appendChild(b);
    const t = document.createElement('div');
    t.id = 'rt-toast';
    t.className = 'rt-toast';
    t.hidden = true;
    document.body.appendChild(t);
  }

  function updateProgressUI() {
    if (!window.RTStore) return;
    const s = RTStore.get();
    const status = $('sb-progress-status');
    const dirty = !!s.meta.dirtySinceExport;
    const quota = RTStore.lastSaveError === 'quota';
    if (status) {
      let text;
      if (quota) text = 'Storage full — export now';
      else if (dirty) text = 'Unsaved changes';
      else if (s.meta.lastExportedAt) text = 'Exported ' + fmtAgo(s.meta.lastExportedAt);
      else text = 'Not exported yet';
      if (RTStore.backendName() === 'memory' && !quota) text += ' · this browser keeps nothing between reloads';
      status.textContent = text;
      status.className = 'sb-progress-status' + (dirty || quota ? ' dirty' : '');
    }
    const banner = $('rt-dirty-banner');
    if (banner) {
      const show = quota || (dirty && !bannerDismissed && hasAnyProgress(s));
      banner.hidden = !show;
      const txt = $('rt-dirty-text');
      if (txt) txt.textContent = quota
        ? 'This tab\'s storage is full — your latest progress is only in memory. Export now.'
        : 'Progress not saved to a file yet — it disappears when this tab closes.';
    }
  }

  window.renderSidebarProgress = function () {
    const slot = $('sidebar-progress');
    if (!slot || !window.RTStore) return;
    slot.innerHTML =
      '<div class="sb-progress">' +
        '<div class="sb-progress-status" id="sb-progress-status"></div>' +
        '<div class="sb-progress-row">' +
          '<button class="sb-progress-btn" id="sb-export-btn" onclick="rtExportProgress()" title="Download your progress as a .json file">&#11015; Export</button>' +
          '<button class="sb-progress-btn" id="sb-import-btn" onclick="rtImportProgress()" title="Open a progress file you exported earlier">&#11014; Import</button>' +
        '</div>' +
        '<input type="file" id="sb-import-file" accept=".json,application/json" style="display:none">' +
      '</div>';
    $('sb-import-file').addEventListener('change', onImportFile);
    ensureBanner();
    updateProgressUI();
    RTStore.onChange(updateProgressUI);
  };

  window.rtExportProgress = function () {
    const text = RTStore.exportJSON();
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');       // detached: the page-transition click handler never sees it
    a.href = url;
    a.download = 'rtracker-progress-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    bannerDismissed = false;
    updateProgressUI();
  };

  window.rtImportProgress = function () {
    const input = $('sb-import-file');
    if (input) input.click();
  };

  window.rtDismissBanner = function () {
    bannerDismissed = true;
    updateProgressUI();
  };

  // Short toast after a milestone (only when there is unexported progress).
  window.rtNudgeExport = function (msg) {
    if (!window.RTStore || !RTStore.isDirty()) return;
    ensureBanner();
    const t = $('rt-toast');
    if (!t) return;
    t.innerHTML = '<span>' + window.escSidebar(msg || 'Nice — export your progress so you don\'t lose it.') + '</span>' +
      '<button class="rt-dirty-btn" onclick="rtExportProgress()">Export</button>';
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
  };

  function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > RTSchema.LIMITS.importMaxBytes) { alert('That file is too large to be an R-Tracker progress file.'); return; }
    const reader = new FileReader();
    reader.onload = function () {
      const text = String(reader.result || '');
      let parsed;
      try { parsed = JSON.parse(text); } catch (err) { alert('That file is not valid JSON.'); return; }
      const v = RTSchema.validateImport(parsed, text.length);
      if (!v.ok) { alert('This file cannot be imported:\n• ' + v.errors.slice(0, 3).join('\n• ')); return; }
      const cur = RTStore.get();
      let msg = 'Replace your current progress with "' + file.name + '"?\n\n' + describeState(parsed);
      if (hasAnyProgress(cur) && cur.meta.dirtySinceExport) msg += '\n\nYour current progress has unsaved changes — cancel and export first if you want to keep it.';
      msg += '\n\nThis cannot be undone.';
      if (!confirm(msg)) return;
      const r = RTStore.importJSON(text);
      if (!r.ok) { alert('Import failed: ' + r.error); return; }
      try { sessionStorage.setItem('rt-nav', '1'); } catch (err) {}   // no beforeunload prompt for our own reload
      location.reload();
    };
    reader.onerror = function () { alert('Could not read that file.'); };
    reader.readAsText(file);
  }

  // ── initSidebar ───────────────────────────────────────────────────────────
  window.initSidebar = function () {
    injectSidebar();
    syncThemeIcon();
    // Always start collapsed
    sidebarOpen = false;
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('collapsed');
    document.body.classList.remove('sidebar-open');
    document.body.classList.add('sidebar-collapsed');
    animateNavItems();
    if (typeof window.renderSidebarProgress === 'function') window.renderSidebarProgress();
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initSidebar);
  } else {
    window.initSidebar();
  }
})();
