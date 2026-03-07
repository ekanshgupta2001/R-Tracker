// ── R-Tracker Auth ───────────────────────────────────────────────────────────
// Load AFTER: firebase CDN scripts, config.js, js/firebase-init.js
// Exposes: window.initAuth(), window.rtSignInGoogle(), window.rtSignInEmail(),
//          window.rtCreateAccount(), window.rtSignOut()
// CSS lives in css/login.css (linked in <head> of each page).

(function () {
  'use strict';

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

  // ── Inject loader + auth overlay into body ────────────────────────────────
  function injectUI() {
    document.body.insertAdjacentHTML('afterbegin', LOADER_HTML);
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

  // ── Dismiss the page loader (fade out then remove) ────────────────────────
  function dismissLoader(cb) {
    const loader = document.getElementById('rt-page-loader');
    if (!loader) { if (cb) cb(); return; }
    loader.classList.add('rt-loader-out');
    setTimeout(() => {
      loader.remove();
      if (cb) cb();
    }, 320);
  }

  // ── Auth Actions ──────────────────────────────────────────────────────────
  window.rtSignInGoogle = function () {
    setLoading(true);
    const provider = new firebase.auth.GoogleAuthProvider();
    window.rtAuth.signInWithPopup(provider).catch(err => {
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
    window.rtAuth.signOut();
  };

  function setError(msg) {
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
      'auth/user-not-found':         'No account found with that email.',
      'auth/wrong-password':         'Incorrect password.',
      'auth/invalid-email':          'Invalid email address.',
      'auth/email-already-in-use':   'An account with that email already exists.',
      'auth/weak-password':          'Password must be at least 6 characters.',
      'auth/popup-closed-by-user':   'Sign-in was cancelled.',
      'auth/network-request-failed': 'Network error. Check your connection.',
      'auth/invalid-credential':     'Incorrect email or password.',
    };
    return map[err.code] || err.message;
  }

  // ── User Profile in Sidebar ───────────────────────────────────────────────
  function injectUserProfile(user) {
    const existing = document.getElementById('rt-user-section');
    if (existing) existing.remove();

    const footer = document.querySelector('.sidebar-footer');
    if (!footer) return;

    const name   = user.displayName || user.email.split('@')[0];
    const email  = user.email || '';
    const photo  = user.photoURL;
    const letter = name.charAt(0).toUpperCase();

    const avatarHtml = photo
      ? `<div class="rt-user-avatar"><img src="${photo}" referrerpolicy="no-referrer" alt="${letter}"></div>`
      : `<div class="rt-user-avatar">${letter}</div>`;

    const section = document.createElement('div');
    section.id        = 'rt-user-section';
    section.className = 'rt-user-section';
    section.innerHTML = `
      ${avatarHtml}
      <div class="rt-user-info">
        <div class="rt-user-name">${name}</div>
        <div class="rt-user-email">${email}</div>
      </div>
      <button class="rt-signout-btn" onclick="rtSignOut()" title="Sign out">&#8594;&#xFE0E; out</button>
    `;
    footer.insertBefore(section, footer.firstChild);
  }

  // ── Auth State Listener ───────────────────────────────────────────────────
  function setupListener(onSignedIn, onSignedOut) {
    let firstFire = true;

    window.rtAuth.onAuthStateChanged(user => {
      const isFirst = firstFire;
      firstFire = false;

      if (user) {
        window.rtUser = user;
        const overlay = document.getElementById('rt-auth-overlay');
        if (overlay) overlay.style.display = 'none';

        if (isFirst) {
          dismissLoader(() => {
            injectUserProfile(user);
            if (typeof onSignedIn === 'function') onSignedIn(user);
          });
        } else {
          injectUserProfile(user);
          if (typeof onSignedIn === 'function') onSignedIn(user);
        }
      } else {
        window.rtUser = null;
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
