// Copy this file to config.js and fill in your Firebase credentials.
// DO NOT put real keys in this file — it is tracked by Git.
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// NOTE: The Gemini key is used client-side. For production deployment,
// move Gemini API calls to Firebase Cloud Functions (requires Blaze plan).
// For now, restrict the key to specific HTTP referrers in Google Cloud Console.
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
