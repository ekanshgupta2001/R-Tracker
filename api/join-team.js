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
      return res.status(401).json({ error: 'Please sign in first.' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const userId = decoded.uid;

    const { inviteCode } = req.body;
    if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.length < 4 || inviteCode.length > 12) {
      return res.status(400).json({ error: 'Invalid invite code format.' });
    }

    const db = admin.firestore();

    // Rate limit: 10 join attempts per day per user
    const today = new Date().toISOString().split('T')[0];
    const rateLimitRef = db.collection('rateLimits').doc('join-' + userId + '-' + today);
    const rateLimitDoc = await rateLimitRef.get();
    const attempts = rateLimitDoc.exists ? (rateLimitDoc.data().count || 0) : 0;

    if (attempts >= 10) {
      return res.status(429).json({ error: 'Too many join attempts today. Try again tomorrow.' });
    }

    // Record attempt
    await rateLimitRef.set({
      count: admin.firestore.FieldValue.increment(1),
      lastAttempt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Find team with matching invite code (server-side — code never sent to client)
    const teamsSnapshot = await db.collection('teams')
      .where('inviteCode', '==', inviteCode.toUpperCase())
      .limit(1)
      .get();

    if (teamsSnapshot.empty) {
      return res.status(404).json({ error: 'Invalid invite code. Please check and try again.' });
    }

    const teamDoc = teamsSnapshot.docs[0];
    const teamId = teamDoc.id;
    const teamData = teamDoc.data();

    // Check if user is already a member
    const memberDoc = await db.collection('teams').doc(teamId).collection('members').doc(userId).get();
    if (memberDoc.exists) {
      return res.status(400).json({ error: 'You are already a member of this team.' });
    }

    // Get user's current role
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    const role = userData.role || 'player';

    // Add user to team
    await db.collection('teams').doc(teamId).collection('members').doc(userId).set({
      displayName: decoded.name || decoded.email || 'Unknown',
      email: decoded.email || '',
      role: role,
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update user's teamId
    await db.collection('users').doc(userId).update({ teamId: teamId });

    return res.status(200).json({
      success: true,
      teamName: teamData.name || 'Team',
      teamId: teamId
    });

  } catch (error) {
    console.error('Join team error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}
