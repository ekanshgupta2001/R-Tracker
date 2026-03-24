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
    { id: 'index', href: root + 'index.html', icon: '🏠', label: 'Home' },
    { id: 'teleop', href: root + 'pages/teleop.html', icon: '🎮', label: 'TeleOp Practice' },
    { id: 'pathplanner', href: root + 'pages/pathplanner.html', icon: '📐', label: 'Path Planner' },
    { id: 'strategy', href: root + 'pages/strategy.html', icon: '📋', label: 'Strategy' },
    { id: 'curriculum', href: root + 'pages/curriculum.html', icon: '📚', label: 'Curriculum' },
    { id: 'report', href: root + 'pages/report.html', icon: '📄', label: 'Driver Report' },
    { id: 'dashboard', href: root + 'pages/dashboard.html', icon: '📊', label: 'Dashboard', coachOnly: true },
    { id: 'manage-team', href: root + 'pages/manage-team.html', icon: '👥', label: 'Manage Team', coachOnly: true },
    { id: 'about', href: root + 'pages/about.html', icon: 'ℹ️', label: 'About' },
  ];

  // Build sidebar HTML
  function buildSidebarHTML() {
    const navItems = NAV_ITEMS.map(item => {
      const active = item.id === pageName ? ' active' : '';
      const coachAttr = item.coachOnly ? ' data-coach="true" style="display:none"' : '';
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
        <div class="sidebar-team-section" id="sidebar-team-section"></div>
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
  // Read initial state from localStorage (inline <head> script already applied the class)
  let isDark = !document.documentElement.classList.contains('light');

  // Sync the theme icon on init (after sidebar is injected)
  function syncThemeIcon() {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = isDark ? '🌙' : '☀️';
  }

  window.toggleTheme = function () {
    isDark = !isDark;
    document.documentElement.classList.toggle('light', !isDark);
    try { localStorage.setItem('rt-theme', isDark ? 'dark' : 'light'); } catch (e) {}
    // Save to Firebase if signed in
    if (window.rtUser && window.rtDb) {
      window.rtDb.collection('users').doc(window.rtUser.uid)
        .set({ theme: isDark ? 'dark' : 'light' }, { merge: true }).catch(() => {});
    }
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
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (sidebar) sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('visible');
    }
  });

  // ── Role-based nav visibility (called by auth.js after role resolves) ─────
  window.updateSidebarRole = function (role) {
    document.querySelectorAll('[data-coach="true"]').forEach(el => {
      el.style.display = role === 'coach' ? 'flex' : 'none';
    });
    // Update team section in sidebar
    updateSidebarTeamSection(role);
  };

  // ── Team Section in Sidebar ────────────────────────────────────────────────
  function updateSidebarTeamSection(role) {
    const el = document.getElementById('sidebar-team-section');
    if (!el) return;

    const teamId = window.rtUserTeamId || null;

    if (role === 'coach') {
      if (teamId) {
        // Coach with a team — show team name
        window.rtDb.collection('teams').doc(teamId).get().then(doc => {
          const name = doc.exists ? (doc.data().name || 'Your Team') : 'Your Team';
          el.innerHTML = '<div class="sb-team-info"><span class="sb-team-label">Team:</span> <span class="sb-team-name">' + escSidebar(name) + '</span></div>';
        }).catch(() => {
          el.innerHTML = '<div class="sb-team-info"><span class="sb-team-label">Team:</span> <span class="sb-team-name">Your Team</span></div>';
        });
      } else {
        el.innerHTML = '<a href="' + root + 'pages/manage-team.html" class="sb-team-create">+ Create Team</a>';
      }
    } else {
      // Player
      if (teamId) {
        window.rtDb.collection('teams').doc(teamId).get().then(doc => {
          const name = doc.exists ? (doc.data().name || 'Your Team') : 'Your Team';
          el.innerHTML = '<div class="sb-team-info"><span class="sb-team-label">Team:</span> <span class="sb-team-name">' + escSidebar(name) + '</span> <button class="sb-team-leave" onclick="sidebarLeaveTeam()">Leave</button></div>';
        }).catch(() => {
          el.innerHTML = '';
        });
      } else {
        el.innerHTML =
          '<div class="sb-join-team">' +
            '<div class="sb-join-row">' +
              '<input class="sb-join-input" id="sb-join-code" type="text" maxlength="6" placeholder="Invite code" autocomplete="off" spellcheck="false">' +
              '<button class="sb-join-btn" id="sb-join-btn" onclick="sidebarJoinTeam()">Join</button>' +
            '</div>' +
            '<div class="sb-join-msg" id="sb-join-msg"></div>' +
          '</div>';
      }
    }
  }

  function escSidebar(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Join Team (sidebar) ────────────────────────────────────────────────────
  window.sidebarJoinTeam = async function () {
    const input = document.getElementById('sb-join-code');
    const msg = document.getElementById('sb-join-msg');
    const btn = document.getElementById('sb-join-btn');
    if (!input || !msg || !btn) return;

    const raw = input.value.trim().toUpperCase();
    msg.textContent = '';
    msg.className = 'sb-join-msg';

    if (!raw || raw.length < 6 || raw.length > 8) {
      msg.textContent = 'Enter a valid invite code (6\u20138 characters).';
      msg.className = 'sb-join-msg error';
      return;
    }
    if (!window.rtUser) return;

    // Rate limit failed join attempts
    var joinAttempts = parseInt(localStorage.getItem('rt-join-attempts') || '0');
    var joinLockUntil = parseInt(localStorage.getItem('rt-join-lock-until') || '0');
    if (Date.now() < joinLockUntil) {
      var waitSec = Math.ceil((joinLockUntil - Date.now()) / 1000);
      msg.textContent = 'Too many attempts. Try again in ' + waitSec + 's.';
      msg.className = 'sb-join-msg error';
      return;
    }

    btn.disabled = true;

    try {
      const snap = await window.rtDb.collection('teams').where('inviteCode', '==', raw).limit(1).get();
      if (snap.empty) {
        joinAttempts++;
        localStorage.setItem('rt-join-attempts', joinAttempts.toString());
        if (joinAttempts >= 5) {
          localStorage.setItem('rt-join-lock-until', (Date.now() + 60000).toString());
          localStorage.setItem('rt-join-attempts', '0');
          msg.textContent = 'Too many failed attempts. Locked for 60 seconds.';
        } else {
          msg.textContent = 'Invalid code.';
        }
        msg.className = 'sb-join-msg error';
        btn.disabled = false;
        return;
      }
      const teamDoc = snap.docs[0];
      const teamId = teamDoc.id;
      const teamData = teamDoc.data();
      const user = window.rtUser;
      const name = user.displayName || user.email.split('@')[0];

      await window.rtDb.collection('teams').doc(teamId).collection('members').doc(user.uid).set({
        displayName: name, email: user.email, role: 'player',
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await window.rtDb.collection('users').doc(user.uid).set({ teamId: teamId }, { merge: true });
      window.rtUserTeamId = teamId;
      localStorage.setItem('rt-join-attempts', '0');

      msg.textContent = 'Joined ' + (teamData.name || 'team') + '!';
      msg.className = 'sb-join-msg success';
      setTimeout(function () { location.reload(); }, 1000);
    } catch (e) {
      msg.textContent = 'Failed: ' + e.message;
      msg.className = 'sb-join-msg error';
      btn.disabled = false;
    }
  };

  // ── Leave Team (sidebar) ───────────────────────────────────────────────────
  window.sidebarLeaveTeam = async function () {
    if (!window.rtUser) return;
    if (!confirm('Leave this team?')) return;
    try {
      const uid = window.rtUser.uid;
      const teamId = window.rtUserTeamId;
      if (teamId) {
        await window.rtDb.collection('teams').doc(teamId).collection('members').doc(uid).delete();
      }
      await window.rtDb.collection('users').doc(uid).set({ teamId: null }, { merge: true });
      window.rtUserTeamId = null;
      location.reload();
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

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
    setupPageTransitions();
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initSidebar);
  } else {
    window.initSidebar();
  }
})();
