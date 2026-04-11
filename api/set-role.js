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
  const isAllowed = allowedOrigins.some(o => o === origin);

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowed) return res.status(403).json({ error: 'Unauthorized' });

  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const userId = decoded.uid;

    const { role } = req.body;
    if (!role || !['player', 'coach'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    // Only allow setting role if user has no role yet OR has no team
    if (userDoc.exists && userDoc.data().role && userDoc.data().teamId) {
      return res.status(403).json({ error: 'Role is locked after joining a team.' });
    }

    await userRef.set({
      role: role,
      displayName: decoded.name || decoded.email || 'Unknown',
      email: decoded.email || ''
    }, { merge: true });

    return res.status(200).json({ success: true, role: role });

  } catch (error) {
    console.error('Set role error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}
