// ── R-Tracker Auth ───────────────────────────────────────────────────────────
// Load AFTER: firebase CDN scripts, config.js, js/firebase-init.js
// Exposes: window.initAuth(), window.rtSignInGoogle(), window.rtSignInEmail(),
//          window.rtCreateAccount(), window.rtSignOut(), window.rtSelectRole()
// CSS lives in css/login.css (linked in <head> of each page).

(function () {
  'use strict';

  // ── Globals exposed after auth resolves ───────────────────────────────────
  window.rtUserRole   = null;  // 'player' | 'coach'
  window.rtUserTeamId = null;  // teamId string or null

  // ── HTML ─────────────────────────────────────────────────────────────────
  const LOADER_HTML = `
    <div id="rt-page-loader" aria-label="Loading R-Tracker" role="status">
      <div class="rt-loader-logo">
        <span class="rt-logo-r">R-</span><span class="rt-logo-t">Tracker</span>
      </div>
      <div class="rt-loader-tagline">Rundle Robotics Castle</div>
    </div>
  `;

  const OVERLAY_HTML = `
    <div id="rt-auth-overlay">
      <div id="rt-auth-card">
        <div id="rt-auth-logo">
          <span class="al-r">R-</span><span class="al-t">Tracker</span>
        </div>
        <div id="rt-auth-team">Rundle Robotics Castle &middot; Team 27502</div>

        <button id="rt-auth-google-btn" onclick="rtSignInGoogle()">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google
        </button>

        <div class="rt-auth-divider">or use email</div>

        <input id="rt-auth-email" class="rt-auth-input" type="email"
               placeholder="Email address" autocomplete="email">
        <input id="rt-auth-password" class="rt-auth-input" type="password"
               placeholder="Password" autocomplete="current-password">
        <div class="rt-auth-btn-row">
          <button class="rt-auth-btn" onclick="rtSignInEmail()">Sign In</button>
          <button class="rt-auth-btn primary" onclick="rtCreateAccount()">Create Account</button>
        </div>
        <div id="rt-auth-error"></div>
        <div id="rt-auth-loading">Signing in</div>
      </div>
    </div>
  `;

  const ROLE_MODAL_HTML = `
    <div id="rt-role-overlay" style="display:none">
      <div id="rt-role-card">
        <div id="rt-auth-logo">
          <span class="al-r">R-</span><span class="al-t">Tracker</span>
        </div>
        <div class="rt-role-title">Welcome to R-Tracker!</div>
        <div class="rt-role-subtitle">Select your role to continue:</div>
        <div class="rt-role-options">
          <button class="rt-role-btn" onclick="rtSelectRole('player')">
            <span class="rt-role-icon">🎮</span>
            <div class="rt-role-name">Player / Driver</div>
            <div class="rt-role-desc">I'm a team member practicing driving skills. I'll complete levels, track my stats, and improve my driving.</div>
          </button>
          <button class="rt-role-btn" onclick="rtSelectRole('coach')">
            <span class="rt-role-icon">📋</span>
            <div class="rt-role-name">Coach / Mentor</div>
            <div class="rt-role-desc">I'm a coach or mentor. I'll manage players, view the team dashboard, and track everyone's progress.</div>
          </button>
        </div>
        <div id="rt-role-saving" style="display:none">Saving your role...</div>
        <div style="margin-top:12px;font-size:12px;color:#666;text-align:center;">You can change this later from the sidebar until you join a team.</div>
      </div>
    </div>
  `;

  // ── Role selection callback (set before showing modal) ────────────────────
  let _onRoleChosen = null;

  // Guard: prevent loader from being recreated after it has been dismissed
  let loaderDismissed = false;

  // Guard: prevent handling onAuthStateChanged more than once per session
  let authHandled = false;

  // ── Inject loader + overlays into body ────────────────────────────────────
  function injectUI() {
    if (!loaderDismissed && !document.getElementById('rt-page-loader')) {
      document.body.insertAdjacentHTML('afterbegin', LOADER_HTML);
    }
    if (!document.getElementById('rt-auth-overlay')) {
      document.body.insertAdjacentHTML('beforeend', OVERLAY_HTML);
      document.getElementById('rt-auth-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') rtSignInEmail();
      });
      document.getElementById('rt-auth-email').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const pw = document.getElementById('rt-auth-password');
          if (pw.value) rtSignInEmail(); else pw.focus();
        }
      });
    }
    if (!document.getElementById('rt-role-overlay')) {
      document.body.insertAdjacentHTML('beforeend', ROLE_MODAL_HTML);
    }
  }

  // ── Dismiss the page loader (fade out then remove) ────────────────────────
  function dismissLoader(cb) {
    loaderDismissed = true;
    const loader = document.getElementById('rt-page-loader');
    if (!loader) {
      if (cb) cb();
      return;
    }
    loader.style.transition = 'opacity 0.3s ease';
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(() => {
      loader.remove();
      if (cb) cb();
    }, 350);
  }

  // ── Auth Actions ──────────────────────────────────────────────────────────
  let googleSignInPending = false;

  window.rtSignInGoogle = function () {
    if (googleSignInPending) return;
    googleSignInPending = true;
    setLoading(true);

    // Disable button visually
    const btn = document.querySelector('[onclick*="rtSignInGoogle"]');
    if (btn) { btn.style.pointerEvents = 'none'; btn.style.opacity = '0.5'; }

    const provider = new firebase.auth.GoogleAuthProvider();
    window.rtAuth.signInWithPopup(provider)
      .then(function () { googleSignInPending = false; })
      .catch(function (err) {
        googleSignInPending = false;
        if (btn) { btn.style.pointerEvents = ''; btn.style.opacity = ''; }
        if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
          setLoading(false);
          return;
        }
        setError(friendlyError(err));
        setLoading(false);
      });
  };

  window.rtSignInEmail = function () {
    const email = document.getElementById('rt-auth-email').value.trim();
    const pass  = document.getElementById('rt-auth-password').value;
    if (!email || !pass) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    window.rtAuth.signInWithEmailAndPassword(email, pass).catch(err => {
      setError(friendlyError(err));
      setLoading(false);
    });
  };

  window.rtCreateAccount = function () {
    const email = document.getElementById('rt-auth-email').value.trim();
    const pass  = document.getElementById('rt-auth-password').value;
    if (!email || !pass) { setError('Please enter an email and password.'); return; }
    if (pass.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    window.rtAuth.createUserWithEmailAndPassword(email, pass).catch(err => {
      setError(friendlyError(err));
      setLoading(false);
    });
  };

  window.rtSignOut = function () {
    window.rtUserRole   = null;
    window.rtUserTeamId = null;
    window.rtAuth.signOut();
  };

  // ── Role Selection ────────────────────────────────────────────────────────
  window.rtSelectRole = function (role) {
    const saving = document.getElementById('rt-role-saving');
    const btns   = document.querySelectorAll('.rt-role-btn');
    if (saving) saving.style.display = 'block';
    btns.forEach(b => b.disabled = true);

    if (_onRoleChosen) {
      _onRoleChosen(role).catch(err => {
        console.error('Failed to save role:', err);
        if (saving) saving.style.display = 'none';
        btns.forEach(b => b.disabled = false);
      });
    }
  };

  // ── Check / load user profile from Firestore ──────────────────────────────
  // Calls onReady() once rtUserRole and rtUserTeamId are set.
  function checkUserProfile(user, onReady) {
    let settled = false;

    // Timeout fallback: if Firestore takes >3s, default to player and unblock
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn('[R-Tracker] Role check timed out — defaulting to player');
      window.rtUserRole   = 'player';
      window.rtUserTeamId = null;
      onReady();
    }, 3000);

    window.rtDb.collection('users').doc(user.uid).get()
      .then(doc => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;

        if (doc.exists && doc.data().role) {
          window.rtUserRole   = doc.data().role;
          window.rtUserTeamId = doc.data().teamId || null;
          // Sync theme from Firebase (overrides localStorage)
          var savedTheme = doc.data().theme;
          if (savedTheme === 'light' || savedTheme === 'dark') {
            try { localStorage.setItem('rt-theme', savedTheme); } catch (e) {}
            document.documentElement.classList.toggle('light', savedTheme === 'light');
            // Update sidebar icon if available
            var themeIcon = document.getElementById('themeIcon');
            if (themeIcon) themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
          }
          onReady();
          return;
        }

        // No profile yet — show role selection modal
        _onRoleChosen = async (role) => {
          const name = user.displayName || user.email.split('@')[0];
          await window.rtDb.collection('users').doc(user.uid).set({
            displayName: name,
            email:       user.email,
            role:        role,
            teamId:      null,
            createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          window.rtUserRole   = role;
          window.rtUserTeamId = null;
          const overlay = document.getElementById('rt-role-overlay');
          if (overlay) overlay.style.display = 'none';
          onReady();
        };

        const overlay = document.getElementById('rt-role-overlay');
        if (overlay) overlay.style.display = 'flex';
      })
      .catch(err => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;
        console.error('[R-Tracker] Role check failed:', err.message);
        window.rtUserRole   = 'player';
        window.rtUserTeamId = null;
        onReady();
      });
  }

  function setError(msg) {
    if (!msg) return;
    const el = document.getElementById('rt-auth-error');
    if (el) el.textContent = msg;
    setLoading(false);
  }

  function setLoading(on) {
    const ld  = document.getElementById('rt-auth-loading');
    const err = document.getElementById('rt-auth-error');
    if (ld)  ld.style.display = on ? 'block' : 'none';
    if (err && on) err.textContent = '';
  }

  function friendlyError(err) {
    const map = {
      'auth/user-not-found':           'Invalid email or password.',
      'auth/wrong-password':           'Invalid email or password.',
      'auth/invalid-credential':       'Invalid email or password.',
      'auth/invalid-email':            'Invalid email address.',
      'auth/email-already-in-use':     'An account with that email already exists.',
      'auth/weak-password':            'Password must be at least 6 characters.',
      'auth/popup-closed-by-user':     '',
      'auth/cancelled-popup-request':  '',
      'auth/network-request-failed':   'Network error. Check your connection.',
    };
    return map[err.code] !== undefined ? map[err.code] : err.message;
  }

  // ── User Profile in Sidebar ───────────────────────────────────────────────
  // Called after checkUserProfile so window.rtUserRole is already set.
  function injectUserProfile(user) {
    document.getElementById('rt-user-section')?.remove();
    document.getElementById('rt-role-popover')?.remove();

    const footer = document.querySelector('.sidebar-footer');
    if (!footer) return;

    var esc = function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    const name     = esc(user.displayName || user.email.split('@')[0]);
    const email    = esc(user.email || '');
    const photo    = user.photoURL;
    const letter   = esc((user.displayName || user.email || '?').charAt(0).toUpperCase());
    const role     = window.rtUserRole || 'player';
    const roleOther = role === 'coach' ? 'player' : 'coach';
    const roleLbl   = role === 'coach' ? 'Coach' : 'Player';
    const roleOtherLbl = role === 'coach' ? 'Player' : 'Coach';

    const avatarHtml = photo
      ? `<div class="rt-user-avatar"><img src="${esc(photo)}" referrerpolicy="no-referrer" alt="${letter}"></div>`
      : `<div class="rt-user-avatar">${letter}</div>`;

    // Popover (hidden by default)
    const popover = document.createElement('div');
    popover.id        = 'rt-role-popover';
    popover.className = 'rt-role-popover';
    popover.style.display = 'none';
    const hasTeam = !!window.rtUserTeamId;
    popover.innerHTML = hasTeam
      ? `<div class="rt-popover-role">Currently: <strong>${roleLbl}</strong></div>
         <div style="font-size:11px;color:#666;padding:4px 0;">Role locked while on a team</div>
         <div class="rt-popover-divider"></div>
         <button class="rt-popover-signout" onclick="rtSignOut()">Sign Out</button>`
      : `<div class="rt-popover-role">Currently: <strong>${roleLbl}</strong></div>
         <button class="rt-popover-btn" id="rt-switch-btn" onclick="rtSwitchRole('${roleOther}')">
           Switch to ${roleOtherLbl}
         </button>
         <div class="rt-popover-divider"></div>
         <button class="rt-popover-signout" onclick="rtSignOut()">Sign Out</button>`;

    // User section (clickable)
    const section = document.createElement('div');
    section.id        = 'rt-user-section';
    section.className = 'rt-user-section';
    section.innerHTML = `
      ${avatarHtml}
      <div class="rt-user-info">
        <div class="rt-user-name-row">
          <span class="rt-user-name">${name}</span>
          <span class="rt-role-badge">${roleLbl}</span>
        </div>
        <div class="rt-user-email">${email}</div>
      </div>
      <span class="rt-user-chevron">&#8250;</span>
    `;

    section.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = popover.style.display !== 'none';
      popover.style.display = isOpen ? 'none' : 'block';
      section.classList.toggle('active', !isOpen);
    });

    // Close popover on outside click
    document.addEventListener('click', e => {
      if (!section.contains(e.target) && !popover.contains(e.target)) {
        popover.style.display = 'none';
        section.classList.remove('active');
      }
    });

    // Insert before theme toggle
    const themeToggle = footer.querySelector('.theme-toggle');
    footer.insertBefore(popover, themeToggle);
    footer.insertBefore(section, popover);
  }

  // ── Role Switching ────────────────────────────────────────────────────────
  window.rtSwitchRole = async function (newRole) {
    if (!window.rtUser) return;
    const btn = document.getElementById('rt-switch-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Switching...'; }

    // Role is locked once the user joins a team
    if (window.rtUserTeamId) {
      if (btn) { btn.disabled = false; btn.textContent = 'Role locked — leave team to change'; }
      return;
    }

    try {
      await window.rtDb.collection('users').doc(window.rtUser.uid).set(
        { role: newRole }, { merge: true }
      );
      window.rtUserRole = newRole;

      // Re-render the profile section with new role
      const popover = document.getElementById('rt-role-popover');
      if (popover) popover.style.display = 'none';
      injectUserProfile(window.rtUser);

      // Update sidebar nav items
      if (typeof window.updateSidebarRole === 'function') {
        window.updateSidebarRole(newRole);
      }
    } catch (e) {
      console.error('Role switch failed:', e);
      if (btn) { btn.disabled = false; btn.textContent = 'Switch failed. Retry?'; }
    }
  };

  // ── Auth State Listener ───────────────────────────────────────────────────
  function setupListener(onSignedIn, onSignedOut) {
    let firstFire = true;

    window.rtAuth.onAuthStateChanged(user => {
      const isFirst = firstFire;
      firstFire = false;

      if (user) {
        // Skip duplicate fired callbacks once auth has been handled for this session
        if (authHandled) {
          return;
        }
        authHandled = true;

        window.rtUser = user;
        const overlay = document.getElementById('rt-auth-overlay');
        if (overlay) overlay.style.display = 'none';

        const proceed = () => {
          checkUserProfile(user, () => {
            injectUserProfile(user);
            if (typeof window.updateSidebarRole === 'function') {
              window.updateSidebarRole(window.rtUserRole);
            }
            if (typeof onSignedIn === 'function') onSignedIn(user);
          });
        };

        if (isFirst) {
          dismissLoader(proceed);
        } else {
          proceed();
        }
      } else {
        authHandled = false;  // reset so next sign-in is processed
        window.rtUser       = null;
        window.rtUserRole   = null;
        window.rtUserTeamId = null;
        const sec = document.getElementById('rt-user-section');
        if (sec) sec.remove();

        if (isFirst) {
          dismissLoader(() => {
            const overlay = document.getElementById('rt-auth-overlay');
            if (overlay) overlay.style.display = 'flex';
            if (typeof onSignedOut === 'function') onSignedOut();
          });
        } else {
          const overlay = document.getElementById('rt-auth-overlay');
          if (overlay) overlay.style.display = 'flex';
          if (typeof onSignedOut === 'function') onSignedOut();
        }
      }
    });
  }

  // ── initAuth ──────────────────────────────────────────────────────────────
  window.initAuth = function (onSignedIn, onSignedOut) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        injectUI();
        setupListener(onSignedIn, onSignedOut);
      });
    } else {
      injectUI();
      setupListener(onSignedIn, onSignedOut);
    }
  };
})();
