const fs = require('fs');
fs.writeFileSync('config.js', `const FIREBASE_CONFIG = {
  apiKey: "${process.env.FIREBASE_API_KEY}",
  authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
  projectId: "${process.env.FIREBASE_PROJECT_ID}",
  storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${process.env.FIREBASE_APP_ID}"
};`);
['firestore.rules','firebase.json','config.example.js','README.md','CLAUDE.md'].forEach(f => {
  try { fs.unlinkSync(f); } catch(e) {}
});
try { fs.rmSync('functions', {recursive:true}); } catch(e) {}
console.log('Build complete');
