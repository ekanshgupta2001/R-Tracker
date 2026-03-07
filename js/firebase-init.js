// Firebase initialization — config.js must exist locally (see config.example.js).
// Load AFTER the three Firebase compat CDN scripts and config.js.
// Exposes: window.rtAuth, window.rtDb, window.rtUser
if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
window.rtAuth = firebase.auth();
window.rtDb   = firebase.firestore();
window.rtUser = null;
