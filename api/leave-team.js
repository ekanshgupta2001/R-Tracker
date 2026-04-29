import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    console.error('Firebase Admin init failed:', e.message);
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigins = ['https://r-tracker-liard.vercel.app', 'http://localhost:5500', 'http://127.0.0.1:5500'];
  const isAllowed = allowedOrigins.includes(origin);

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowed) return res.status(403).json({ error: 'Unauthorized origin' });

  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const userId = decoded.uid;

    const db = admin.firestore();

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const teamId = userData.teamId;

    if (!teamId) {
      return res.status(400).json({ error: 'You are not on a team.' });
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
          return res.status(400).json({
            error: 'You are the only coach on this team. Please promote another member to coach before leaving, or remove all members first.',
            needsCoachTransfer: true
          });
        }
      }
    }

    await db.collection('teams').doc(teamId)
      .collection('members').doc(userId).delete();

    await db.collection('users').doc(userId).update({
      teamId: admin.firestore.FieldValue.delete()
    });

    return res.status(200).json({ success: true, message: 'You have left the team.' });

  } catch (error) {
    console.error('Leave team error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}
