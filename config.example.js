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

// Note: GEMINI_API_KEY is stored server-side in Vercel environment variables
// and accessed via the /api/review serverless function.
// For local development with direct Gemini calls, add:
// const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
