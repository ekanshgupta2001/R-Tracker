import { writeFileSync, unlinkSync, rmSync } from 'node:fs';

writeFileSync('config.js', `const FIREBASE_CONFIG = {
  apiKey: "${process.env.FIREBASE_API_KEY}",
  authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
  projectId: "${process.env.FIREBASE_PROJECT_ID}",
  storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${process.env.FIREBASE_APP_ID}"
};`);

// Strip files that shouldn't be served as static assets from the deploy output.
// (Source remains in git — this only affects what Netlify uploads.)
const filesToRemove = [
  'firestore.rules',
  'firebase.json',
  'config.example.js',
  'README.md',
  'CLAUDE.md',
  'vercel.json',
  '.vercelignore',
  'build.sh',
  '.netlifyignore'
];
for (const f of filesToRemove) {
  try { unlinkSync(f); } catch (e) {}
}

const dirsToRemove = ['functions', 'api'];
for (const d of dirsToRemove) {
  try { rmSync(d, { recursive: true, force: true }); } catch (e) {}
}

console.log('Build complete');
