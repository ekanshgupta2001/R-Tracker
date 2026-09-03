// ── R-Tracker Sidebar ────────────────────────────────────────────────────────
// Dynamically injects the sidebar and hamburger into every page.
// Load AFTER css/sidebar.css is linked. Auto-inits on DOMContentLoaded.
// Exposes: window.toggleSidebar(), window.toggleTheme(), window.initSidebar(), window.escSidebar()
// The #sidebar-progress slot is filled by the Export/Import controls (Phase 2).
// v2 Summit Atmosphere: emoji replaced with inline line icons (window.RT_ICONS).
// Theme: `light` on <html> is light glass and is the default; no class = dark glass.

(function () {
  'use strict';

  // Detect if we are inside the /pages/ subdirectory
  const isInPages = window.location.pathname.includes('/pages/');
  const root = isInPages ? '../' : '';

  // Current page identifier for active-nav highlighting
  const pageName = window.location.pathname.split('/').pop().replace('.html', '') || 'index';

  // Line icon set (24px grid, stroke 1.75). Shared with index.html card icons.
  const S = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  const svg = (inner) => `<svg viewBox="0 0 24 24" ${S} aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    home:       svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
    teleop:     svg('<rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/>'),
    pathplanner:svg('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>'),
    strategy:   svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>'),
    curriculum: svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
    report:     svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>'),
    about:      svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
    menu:       svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    close:      svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    moon:       svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    sun:        svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    download:   svg('<path d="M12 15V3M7 10l5 5 5-5M4 21h16"/>'),
    upload:     svg('<path d="M12 3v12M7 8l5-5 5 5M4 21h16"/>'),
    // Rundle ridgeline mark (logo)
    mark: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#800020"/><path d="M4 17.5 8.2 12.4 10.4 14.6 15.2 6.5 16.6 9.4 20 17.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>',

    // ── Icons used by the tool pages (they replaced v1's emoji) ──
    check:      svg('<path d="M20 6 9 17l-5-5"/>'),
    checkCircle:svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
    x:          svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    xCircle:    svg('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>'),
    lock:       svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    unlock:     svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
    star:       svg('<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>'),
    starFill:   '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>',
    medal:      svg('<circle cx="12" cy="15" r="6"/><path d="M8.6 9.9 6 2h4l2 5.2L14 2h4l-2.6 7.9"/><path d="m12 12.5.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3z"/>'),
    trophy:     svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
    flag:       svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>'),
    clock:      svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    hourglass:  svg('<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4A2 2 0 0 0 7 17.8V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2"/>'),
    flame:      svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    graduation: svg('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'),
    target:     svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
    zap:        svg('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),
    settings:   svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    refresh:    svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>'),
    rotate:     svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>'),
    shuffle:    svg('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
    sparkle:    svg('<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="m19 17 .7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>'),
    shield:     svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    play:       svg('<path d="M6 4v16l14-8z"/>'),
    pause:      svg('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
    stop:       svg('<rect x="5" y="5" width="14" height="14" rx="2"/>'),
    save:       svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>'),
    folder:     svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    camera:     svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
    trash:      svg('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'),
    undo:       svg('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'),
    redo:       svg('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>'),
    pencil:     svg('<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>'),
    arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    arrowLeft:  svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    chevronDown:svg('<path d="m6 9 6 6 6-6"/>'),
    chevronUp:  svg('<path d="m18 15-6-6-6 6"/>'),
    chevronRight:svg('<path d="m9 6 6 6-6 6"/>'),
    chevronLeft:svg('<path d="m15 6-6 6 6 6"/>'),
    square:     svg('<rect x="4" y="4" width="16" height="16" rx="2"/>'),
    circle:     svg('<circle cx="12" cy="12" r="8"/>'),
    disc:       svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'),
    robot:      svg('<rect x="5" y="7" width="14" height="12" rx="2"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6"/>'),
    eraser:     svg('<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7M5 11l9 9"/>'),
    copy:       svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    alert:      svg('<path d="m10.3 3.9-8.5 14.7A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.4L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
    book:       svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    file:       svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
    chart:      svg('<path d="M3 3v18h18"/><path d="M8 17V9M13 17V5M18 17v-6"/>'),
    help:       svg('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>'),
    party:      svg('<path d="M5.8 11.3 2 22l10.7-3.8z"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01M13.5 8.5 16 6M17 12l3-1M11 5l1-3"/>'),
    plus:       svg('<path d="M12 5v14M5 12h14"/>'),
    bulb:       svg('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>'),
    externalLink:svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>')
  };
  ICONS.gamepad = ICONS.teleop;
  window.RT_ICONS = ICONS;

  // Inline icon helper for page scripts: rtIcon('check', 'extra-class') → a
  // text-sized <span class="rt-icon">. The SVG strings are ours (never user input).
  window.rtIcon = function (name, cls) {
    return '<span class="rt-icon' + (cls ? ' ' + cls : '') + '">' + (ICONS[name] || '') + '</span>';
  };

  const NAV_ITEMS = [
    { id: 'index', href: root + 'index.html', icon: ICONS.home, label: 'Home' },
    { id: 'teleop', href: root + 'pages/teleop.html', icon: ICONS.teleop, label: 'TeleOp Practice' },
    { id: 'pathplanner', href: root + 'pages/pathplanner.html', icon: ICONS.pathplanner, label: 'Path Planner' },
    { id: 'strategy', href: root + 'pages/strategy.html', icon: ICONS.strategy, label: 'Strategy' },
    { id: 'curriculum', href: root + 'pages/curriculum.html', icon: ICONS.curriculum, label: 'Curriculum' },
    { id: 'report', href: root + 'pages/report.html', icon: ICONS.report, label: 'Driver Report' },
    { id: 'about', href: root + 'pages/about.html', icon: ICONS.about, label: 'About' },
  ];

  function buildSidebarHTML() {
    const navItems = NAV_ITEMS.map(item => {
      const active = item.id === pageName ? ' active' : '';
      return `<a href="${item.href}" class="nav-item${active}"><span class="nav-icon">${item.icon}</span>${item.label}</a>`;
    }).join('');

    return `
      <button class="hamburger" id="hamburger" onclick="toggleSidebar()" aria-label="Toggle navigation"><span class="ham-icon">${ICONS.menu}</span></button>
      <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>
      <nav class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-logo"><span class="sidebar-mark">${ICONS.mark}</span><span><span class="ftc">R-</span><span class="sim">Tracker</span></span></div>
          <div class="sidebar-tagline">Rundle Robotics Visualizer</div>
        </div>
        <ul class="sidebar-nav">${navItems}</ul>
        <div class="sidebar-progress" id="sidebar-progress"></div>
        <div class="sidebar-footer">
          <div class="theme-toggle" onclick="toggleTheme()">
            <span>Toggle Theme</span>
            <span class="theme-toggle-icon" id="themeIcon"></span>
          </div>
        </div>
      </nav>
    `;
  }

  function injectSidebar() {
    const container = document.getElementById('sidebar-container');
    const html = buildSidebarHTML();
    if (container) container.innerHTML = html;
    else document.body.insertAdjacentHTML('afterbegin', html);
  }

  // ── Theme ──────────────────────────────────────────────────────────────────
  // The only localStorage key in the app: a UI preference, not student data (see AUDIT.md).
  // `light` on <html> is light glass and is what the boot script sets by default;
  // removing it gives dark glass. Stored value is 'light' | 'dark'.
  let isDark = !document.documentElement.classList.contains('light');
  let themeTimer = null;

  function syncThemeIcon() {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.innerHTML = isDark ? ICONS.sun : ICONS.moon;
  }

  window.toggleTheme = function () {
    isDark = !isDark;
    const html = document.documentElement;
    html.classList.add('rt-theming');
    html.classList.toggle('light', !isDark);
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => html.classList.remove('rt-theming'), 520);
    try { localStorage.setItem('rt-theme', isDark ? 'dark' : 'light'); } catch (e) {}
    // Canvas-drawn things (report charts, the 3D scene) re-read their tokens on this.
    try { window.dispatchEvent(new CustomEvent('rt-themechange', { detail: { dark: isDark } })); } catch (e) {}
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    icon.classList.add('spin');
    setTimeout(() => { syncThemeIcon(); icon.classList.remove('spin'); }, 200);
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
    if (hamIcon) {
      hamIcon.classList.add('swap');
      setTimeout(() => { hamIcon.innerHTML = sidebarOpen ? ICONS.close : ICONS.menu; hamIcon.classList.remove('swap'); }, 140);
    }
    if (backdrop) backdrop.classList.toggle('visible', sidebarOpen && window.innerWidth <= 820);
    if (sidebarOpen) animateNavItems();   // stagger in on open; on close the items ride the panel out
  };

  function animateNavItems() {
    const items = document.querySelectorAll('.nav-item');
    items.forEach((item, i) => {
      item.classList.remove('nav-visible');
      setTimeout(() => item.classList.add('nav-visible'), 60 + i * 40);
    });
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 820) {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (sidebar) sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('visible');
    }
  });

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
          '<button class="sb-progress-btn" id="sb-export-btn" onclick="rtExportProgress()" title="Download your progress as a .json file">' + ICONS.download + 'Export</button>' +
          '<button class="sb-progress-btn" id="sb-import-btn" onclick="rtImportProgress()" title="Open a progress file you exported earlier">' + ICONS.upload + 'Import</button>' +
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

  // Static markup asks for an icon with <span class="rt-icon" data-rt-icon="save"></span>;
  // fill those in once the DOM is ready (page scripts that rebuild a control use rtIcon()).
  function hydrateIcons() {
    document.querySelectorAll('[data-rt-icon]').forEach(function (el) {
      const svgStr = ICONS[el.getAttribute('data-rt-icon')];
      if (svgStr && !el.firstChild) el.innerHTML = svgStr;
    });
  }
  window.rtHydrateIcons = hydrateIcons;

  // ── initSidebar ───────────────────────────────────────────────────────────
  window.initSidebar = function () {
    injectSidebar();
    hydrateIcons();
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initSidebar);
  } else {
    window.initSidebar();
  }
})();
