// ── R-Tracker Firebase Auth ──────────────────────────────────────────────────
// Shared across all pages. Load AFTER the three Firebase compat CDN scripts.
// Exposes: window.rtAuth, window.rtDb, window.rtUser, window.initAuth()
// Auth functions: rtSignInGoogle(), rtSignInEmail(), rtCreateAccount(), rtSignOut()

(function () {
  'use strict';

  // ── STEP 1: Inject styles immediately into <head> ─────────────────────────
  // This runs while the browser is still parsing <head>, blocking body parse.
  // Setting background here prevents ANY white flash before the loader appears.
  const EARLY_CSS = `
    /* Prevent flash of white while Firebase resolves */
    html, body { background: #1a1a1a !important; }

    /* ── Page loader (highest z-index, covers everything) ── */
    #rt-page-loader {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: #1a1a1a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      opacity: 1;
      pointer-events: all;
      transition: opacity 0.3s ease;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #rt-page-loader.rt-loader-out {
      opacity: 0;
      pointer-events: none;
    }
    .rt-loader-logo {
      font-size: 34px;
      font-weight: 800;
      letter-spacing: -1.5px;
      line-height: 1;
      animation: rt-logo-pulse 1.8s ease-in-out infinite;
    }
    .rt-logo-r {
      background: linear-gradient(135deg, #c73e5a, #a0334a);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .rt-logo-t { color: #fff; }
    .rt-loader-tagline {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #2e2e2e;
    }
    @keyframes rt-logo-pulse {
      0%, 100% { opacity: 0.4; transform: scale(0.97); }
      50%       { opacity: 1;   transform: scale(1); }
    }
  `;

  const earlyStyle = document.createElement('style');
  earlyStyle.id = 'rt-early-style';
  earlyStyle.textContent = EARLY_CSS;
  document.head.appendChild(earlyStyle);

  // ── Firebase init ─────────────────────────────────────────────────────────
  // FIREBASE_CONFIG is loaded from config.js (see config.example.js for template)
  if (typeof FIREBASE_CONFIG === 'undefined') {
    console.error('FIREBASE_CONFIG not found — make sure config.js is loaded before firebase-auth.js');
  }
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  window.rtAuth = firebase.auth();
  window.rtDb   = firebase.firestore();
  window.rtUser = null;

  // ── Auth overlay + UI CSS ─────────────────────────────────────────────────
  // NOTE: #rt-auth-overlay starts display:none — never visible until needed.
  const AUTH_CSS = `
    /* ── Auth Overlay ─────────────────────────────────────── */
    #rt-auth-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(10, 8, 12, 0.97);
      display: none;                /* HIDDEN by default — no flash */
      align-items: center;
      justify-content: center;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #rt-auth-card {
      background: #1e1e1e;
      border: 1px solid #333;
      border-top: 2px solid #c73e5a;
      border-radius: 16px;
      padding: 40px 36px 32px;
      width: 380px;
      max-width: 95vw;
      box-shadow: 0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(199,62,90,0.15);
    }
    #rt-auth-logo {
      text-align: center;
      margin-bottom: 6px;
      line-height: 1;
    }
    #rt-auth-logo .al-r {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -1.5px;
      background: linear-gradient(135deg, #c73e5a, #a0334a);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    #rt-auth-logo .al-t {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -1.5px;
      color: #fff;
    }
    #rt-auth-team {
      text-align: center;
      font-size: 11px;
      color: #555;
      letter-spacing: 0.5px;
      margin-bottom: 28px;
    }
    #rt-auth-google-btn {
      width: 100%;
      padding: 13px 20px;
      background: #fff;
      color: #222;
      border: none;
      border-radius: 9px;
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
      margin-bottom: 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    #rt-auth-google-btn:hover {
      background: #f0f0f0;
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
    }
    #rt-auth-google-btn:active { transform: translateY(0); }
    .rt-auth-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      color: #3a3a3a;
      font-size: 12px;
      letter-spacing: 0.5px;
    }
    .rt-auth-divider::before, .rt-auth-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #2d2d2d;
    }
    .rt-auth-input {
      width: 100%;
      padding: 11px 14px;
      background: #252525;
      border: 1px solid #2d2d2d;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      font-family: inherit;
      margin-bottom: 10px;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }
    .rt-auth-input:focus {
      outline: none;
      border-color: #c73e5a;
    }
    .rt-auth-input::placeholder { color: #444; }
    .rt-auth-btn-row { display: flex; gap: 8px; }
    .rt-auth-btn {
      flex: 1;
      padding: 11px;
      border: 1px solid #3a3a3a;
      border-radius: 8px;
      background: #2a2a2a;
      color: #ccc;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s, background 0.2s;
    }
    .rt-auth-btn:hover { border-color: #c73e5a; color: #fff; }
    .rt-auth-btn.primary {
      background: #800020;
      border-color: #c73e5a;
      color: #fff;
    }
    .rt-auth-btn.primary:hover { background: #9a0028; border-color: #9a0028; }
    #rt-auth-error {
      color: #ff5544;
      font-size: 12px;
      margin-top: 10px;
      min-height: 16px;
      text-align: center;
      line-height: 1.4;
    }
    #rt-auth-loading {
      color: #556;
      font-size: 12px;
      margin-top: 10px;
      text-align: center;
      display: none;
    }
    #rt-auth-loading::after {
      content: '';
      display: inline-block;
      width: 10px;
      animation: rt-dots 1.2s infinite;
    }
    @keyframes rt-dots {
      0%   { content: ''; }
      33%  { content: '.'; }
      66%  { content: '..'; }
      100% { content: '...'; }
    }

    /* ── User Profile in Sidebar ──────────────────────────── */
    .rt-user-section {
      padding: 10px 16px;
      border-bottom: 1px solid #2a2a2a;
      display: flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 0;
    }
    .rt-user-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      flex-shrink: 0;
      background: #800020;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      overflow: hidden;
    }
    .rt-user-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .rt-user-info { flex: 1; min-width: 0; }
    .rt-user-name {
      font-size: 12px;
      font-weight: 600;
      color: #ddd;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rt-user-email {
      font-size: 10px;
      color: #555;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rt-signout-btn {
      font-size: 11px;
      color: #445;
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 4px;
      font-family: inherit;
      transition: color 0.2s;
      flex-shrink: 0;
    }
    .rt-signout-btn:hover { color: #ff5544; }
  `;

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

  // ── Inject loader + auth UI into body ─────────────────────────────────────
  function injectUI() {
    // Auth CSS
    const style = document.createElement('style');
    style.textContent = AUTH_CSS;
    document.head.appendChild(style);

    // Loader — prepended so it's the first element, guaranteed on top
    document.body.insertAdjacentHTML('afterbegin', LOADER_HTML);

    // Auth overlay — appended, starts display:none
    document.body.insertAdjacentHTML('beforeend', OVERLAY_HTML);

    // Keyboard: Enter submits
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
  let googleSignInPending = false;

  window.rtSignInGoogle = function () {
    if (googleSignInPending) return;
    googleSignInPending = true;
    setLoading(true);

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
    window.rtAuth.createUserWithEmailAndPassword(email, pass)
      .then(function(userCredential) {
        userCredential.user.sendEmailVerification();
      })
      .catch(err => {
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
      'auth/user-not-found':         'Invalid email or password.',
      'auth/wrong-password':         'Invalid email or password.',
      'auth/invalid-email':          'Invalid email address.',
      'auth/email-already-in-use':   'An account with that email already exists.',
      'auth/weak-password':          'Password must be at least 6 characters.',
      'auth/popup-closed-by-user':   'Sign-in was cancelled.',
      'auth/network-request-failed': 'Network error. Check your connection.',
      'auth/invalid-credential':     'Invalid email or password.',
    };
    return map[err.code] || err.message;
  }

  // ── XSS sanitization ─────────────────────────────────────────────────────
  function sanitize(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  window.rtSanitize = sanitize;

  // ── User Profile in Sidebar ───────────────────────────────────────────────
  function injectUserProfile(user) {
    const existing = document.getElementById('rt-user-section');
    if (existing) existing.remove();

    const footer = document.querySelector('.sidebar-footer');
    if (!footer) return;

    const name   = sanitize(user.displayName || user.email.split('@')[0]);
    const email  = sanitize(user.email || '');
    const photo  = user.photoURL;
    const letter = sanitize(name.charAt(0).toUpperCase());

    const avatarHtml = photo
      ? `<div class="rt-user-avatar"><img src="${sanitize(photo)}" referrerpolicy="no-referrer" alt="${letter}"></div>`
      : `<div class="rt-user-avatar">${letter}</div>`;

    const section = document.createElement('div');
    section.id        = 'rt-user-section';
    section.className = 'rt-user-section';
    section.innerHTML = `
      ${avatarHtml}
      <div class="rt-user-info">
        <div class="rt-user-name">${name}</div>
        <div class="rt-user-email">${email} <a href="#" onclick="if(confirm('Sign out of R-Tracker?')){rtSignOut();}return false;" style="font-size:10px;color:#666;text-decoration:underline;margin-left:4px;">Not you?</a></div>
      </div>
      <button class="rt-signout-btn" onclick="rtSignOut()" title="Sign out">&#8594;&#xFE0E; out</button>
    `;
    footer.insertBefore(section, footer.firstChild);
  }

  // ── Email Verification Banner ─────────────────────────────────────────────
  function checkEmailVerification(user) {
    // Only show for email/password users who haven't verified
    if (!user || user.emailVerified) return;
    var isPasswordUser = false;
    if (user.providerData) {
      for (var i = 0; i < user.providerData.length; i++) {
        if (user.providerData[i].providerId === 'password') isPasswordUser = true;
      }
    }
    if (!isPasswordUser) return;

    // Don't add duplicate banners
    if (document.getElementById('rt-verify-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'rt-verify-banner';
    banner.style.cssText = 'background:#332800;border-bottom:1px solid #eab308;padding:8px 16px;text-align:center;font-size:13px;color:#eab308;position:fixed;top:0;left:0;right:0;z-index:9998;';
    banner.innerHTML = 'Please verify your email address. <button onclick="window.rtUser.sendEmailVerification().then(function(){document.getElementById(\'rt-verify-banner\').innerHTML=\'Verification email sent!\'}).catch(function(){})" style="background:none;border:none;color:#eab308;text-decoration:underline;cursor:pointer;font-size:13px;font-family:inherit;">Resend verification email</button>';
    document.body.insertBefore(banner, document.body.firstChild);
  }

  // ── Auth State Listener ───────────────────────────────────────────────────
  function setupListener(onSignedIn, onSignedOut) {
    // onAuthStateChanged fires once quickly with cached state (if any),
    // then fires again if state changes.
    let firstFire = true;

    window.rtAuth.onAuthStateChanged(user => {
      const isFirst = firstFire;
      firstFire = false;

      if (user) {
        // Logged in: dismiss loader, reveal page, hide auth modal
        window.rtUser = user;
        const overlay = document.getElementById('rt-auth-overlay');
        if (overlay) overlay.style.display = 'none';

        if (isFirst) {
          dismissLoader(() => {
            injectUserProfile(user);
            checkEmailVerification(user);
            if (typeof onSignedIn === 'function') onSignedIn(user);
          });
        } else {
          // Subsequent fires (e.g. token refresh): no loader to dismiss
          injectUserProfile(user);
          checkEmailVerification(user);
          if (typeof onSignedIn === 'function') onSignedIn(user);
        }
      } else {
        // Not logged in: dismiss loader, show auth modal
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
          // Sign-out happened mid-session: show auth modal immediately
          const overlay = document.getElementById('rt-auth-overlay');
          if (overlay) overlay.style.display = 'flex';
          if (typeof onSignedOut === 'function') onSignedOut();
        }
      }
    });
  }

  // ── initAuth ──────────────────────────────────────────────────────────────
  // Call once per page. onSignedIn(user) and onSignedOut() are optional callbacks.
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
