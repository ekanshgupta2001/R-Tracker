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
  'https://r-tracker-ftc.netlify.app',
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
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required.' }) };
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const userId = decoded.uid;

    const db = admin.firestore();

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const teamId = userData.teamId;

    if (!teamId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'You are not on a team.' }) };
    }

    const memberDoc = await db.collection('teams').doc(teamId)
      .collection('members').doc(userId).get();
    const memberData = memberDoc.exists ? memberDoc.data() : {};

    if (memberData.role === 'coach') {
      const coachesSnapshot = await db.collection('teams').doc(teamId)
        .collection('members')
        .where('role', '==', 'coach')
        .get();

      const otherCoaches = coachesSnapshot.docs.filter(d => d.id !== userId);

      if (otherCoaches.length === 0) {
        const allMembers = await db.collection('teams').doc(teamId)
          .collection('members').get();
        const otherMembers = allMembers.docs.filter(d => d.id !== userId);

        if (otherMembers.length > 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: 'You are the only coach on this team. Please promote another member to coach before leaving, or remove all members first.',
              needsCoachTransfer: true
            })
          };
        }
      }
    }

    await db.collection('teams').doc(teamId)
      .collection('members').doc(userId).delete();

    await db.collection('users').doc(userId).update({
      teamId: admin.firestore.FieldValue.delete()
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'You have left the team.' }) };

  } catch (error) {
    console.error('Leave team error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'An unexpected error occurred.' }) };
  }
}
