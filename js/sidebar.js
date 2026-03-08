// ── R-Tracker Sidebar ────────────────────────────────────────────────────────
// Dynamically injects the sidebar and hamburger into every page.
// Load AFTER css/sidebar.css is linked. Call initSidebar() on DOMContentLoaded.
// Exposes: window.toggleSidebar(), window.toggleTheme(), window.initSidebar()

(function () {
  'use strict';

  // Detect if we are inside the /pages/ subdirectory
  const isInPages = window.location.pathname.includes('/pages/');
  const root = isInPages ? '../' : '';

  // Current page identifier for active-nav highlighting
  const pageName = window.location.pathname.split('/').pop().replace('.html', '') || 'index';

  const NAV_ITEMS = [
    { id: 'index',       href: root + 'index.html',              icon: '🏠', label: 'Home' },
    { id: 'teleop',      href: root + 'pages/teleop.html',       icon: '🎮', label: 'TeleOp Practice' },
    { id: 'pathplanner', href: root + 'pages/pathplanner.html',  icon: '📐', label: 'Path Planner' },
    { id: 'dashboard',   href: root + 'pages/dashboard.html',    icon: '📊', label: 'Dashboard',   coachOnly: true },
    { id: 'manage-team', href: root + 'pages/manage-team.html',  icon: '👥', label: 'Manage Team', coachOnly: true },
    { id: 'about',       href: root + 'pages/about.html',        icon: 'ℹ️',  label: 'About' },
  ];

  // Build sidebar HTML
  function buildSidebarHTML() {
    const navItems = NAV_ITEMS.map(item => {
      const active     = item.id === pageName ? ' active' : '';
      const coachAttr  = item.coachOnly ? ' data-coach="true" style="display:none"' : '';
      return `<a href="${item.href}" class="nav-item${active}"${coachAttr}><span class="nav-icon">${item.icon}</span>${item.label}</a>`;
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
        <div class="sidebar-footer">
          <!-- rt-user-section injected here by auth.js -->
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
  let isDark = true;

  window.toggleTheme = function () {
    isDark = !isDark;
    document.documentElement.classList.toggle('light', !isDark);
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    icon.classList.add('spin');
    setTimeout(() => {
      icon.textContent = isDark ? '🌙' : '☀️';
      icon.classList.remove('spin');
    }, 400);
  };

  // ── Sidebar Toggle ─────────────────────────────────────────────────────────
  let sidebarOpen = window.innerWidth > 820;

  window.toggleSidebar = function () {
    sidebarOpen = !sidebarOpen;
    const sidebar  = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const hamIcon  = document.querySelector('.ham-icon');
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

  // ── Page Transitions ───────────────────────────────────────────────────────
  function setupPageTransitions() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
      e.preventDefault();
      document.body.classList.add('page-leaving');
      setTimeout(() => { window.location.href = href; }, 180);
    });
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    if (window.innerWidth > 820) {
      const sidebar  = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (sidebar)  sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('visible');
    }
  });

  // ── Role-based nav visibility (called by auth.js after role resolves) ─────
  window.updateSidebarRole = function (role) {
    document.querySelectorAll('[data-coach="true"]').forEach(el => {
      el.style.display = role === 'coach' ? 'flex' : 'none';
    });
  };

  // ── initSidebar ───────────────────────────────────────────────────────────
  window.initSidebar = function () {
    injectSidebar();
    if (window.innerWidth <= 820) {
      sidebarOpen = false;
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.add('collapsed');
      document.body.classList.remove('sidebar-open');
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.add('sidebar-open');
    }
    animateNavItems();
    setupPageTransitions();
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initSidebar);
  } else {
    window.initSidebar();
  }
})();
