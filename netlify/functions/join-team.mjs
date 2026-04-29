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
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized origin' }) };
  }

  try {
    const authHeader = event.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Please sign in first.' }) };
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

    const { inviteCode } = body;
    if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.length < 4 || inviteCode.length > 12) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid invite code format.' }) };
    }

    const db = admin.firestore();

    // Rate limit: 10 join attempts per day per user
    const today = new Date().toISOString().split('T')[0];
    const rateLimitRef = db.collection('rateLimits').doc('join-' + userId + '-' + today);
    const rateLimitDoc = await rateLimitRef.get();
    const attempts = rateLimitDoc.exists ? (rateLimitDoc.data().count || 0) : 0;

    if (attempts >= 10) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many join attempts today. Try again tomorrow.' }) };
    }

    await rateLimitRef.set({
      count: admin.firestore.FieldValue.increment(1),
      lastAttempt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const teamsSnapshot = await db.collection('teams')
      .where('inviteCode', '==', inviteCode.toUpperCase())
      .limit(1)
      .get();

    if (teamsSnapshot.empty) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid invite code. Please check and try again.' }) };
    }

    const teamDoc = teamsSnapshot.docs[0];
    const teamId = teamDoc.id;
    const teamData = teamDoc.data();

    const memberDoc = await db.collection('teams').doc(teamId).collection('members').doc(userId).get();
    if (memberDoc.exists) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'You are already a member of this team.' }) };
    }

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    const role = userData.role || 'player';

    await db.collection('teams').doc(teamId).collection('members').doc(userId).set({
      displayName: decoded.name || decoded.email || 'Unknown',
      email: decoded.email || '',
      role: role,
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('users').doc(userId).update({ teamId: teamId });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, teamName: teamData.name || 'Team', teamId: teamId })
    };

  } catch (error) {
    console.error('Join team error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'An unexpected error occurred.' }) };
  }
}
