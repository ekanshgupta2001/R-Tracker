#!/bin/bash

# Generate config.js from Vercel environment variables
cat > config.js << EOF
const FIREBASE_CONFIG = {
  apiKey: "${FIREBASE_API_KEY}",
  authDomain: "${FIREBASE_AUTH_DOMAIN}",
  projectId: "${FIREBASE_PROJECT_ID}",
  storageBucket: "${FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${FIREBASE_APP_ID}"
};
EOF
echo "config.js generated from environment variables"

# Remove sensitive files from deployment output
rm -f firestore.rules
rm -f firebase.json
rm -f config.example.js
rm -f README.md
rm -f CLAUDE.md
rm -rf functions/

echo "Sensitive files removed from deployment"
