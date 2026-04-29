import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    console.error('Firebase Admin init failed:', e.message);
  }
}

const ALLOWED = [
  'https://r-tracker.netlify.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

export async function handler(event) {
  const origin = event.headers.origin || '';
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!ALLOWED.includes(origin)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const authHeader = event.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const userId = decoded.uid;

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
    }

    const { role } = body;
    if (!role || !['player', 'coach'].includes(role)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid role' }) };
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    // Only allow setting role if user has no role yet OR has no team
    if (userDoc.exists && userDoc.data().role && userDoc.data().teamId) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Role is locked after joining a team.' }) };
    }

    await userRef.set({
      role: role,
      displayName: decoded.name || decoded.email || 'Unknown',
      email: decoded.email || ''
    }, { merge: true });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, role: role }) };

  } catch (error) {
    console.error('Set role error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'An unexpected error occurred.' }) };
  }
}
