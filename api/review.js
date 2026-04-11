import admin from 'firebase-admin';

// Initialize Firebase Admin (only once per cold start)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error('Firebase Admin init failed:', e.message);
  }
}

const LIMITS = {
  perUserPerDay: 10,
  perUserPerMinute: 2,
  globalPerDay: 230
};

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getMinuteKey() {
  const now = new Date();
  return `${now.getUTCHours()}:${now.getUTCMinutes()}`;
}

async function checkRateLimits(userId) {
  const db = admin.firestore();
  const today = getToday();
  const minuteKey = getMinuteKey();

  try {
    const globalRef = db.collection('rateLimits').doc('global-' + today);
    const globalDoc = await globalRef.get();
    const globalCount = globalDoc.exists ? (globalDoc.data().count || 0) : 0;

    if (globalCount >= LIMITS.globalPerDay) {
      return { allowed: false, reason: 'AI reviews are at capacity for today. Try again tomorrow.', remaining: 0 };
    }

    const userDayRef = db.collection('rateLimits').doc('user-' + userId + '-' + today);
    const userDayDoc = await userDayRef.get();
    const userDayCount = userDayDoc.exists ? (userDayDoc.data().count || 0) : 0;

    if (userDayCount >= LIMITS.perUserPerDay) {
      return { allowed: false, reason: 'You\'ve used all ' + LIMITS.perUserPerDay + ' AI reviews for today. Try again tomorrow.', remaining: 0 };
    }

    const userMinRef = db.collection('rateLimits').doc('user-' + userId + '-' + today + '-' + minuteKey);
    const userMinDoc = await userMinRef.get();
    const userMinCount = userMinDoc.exists ? (userMinDoc.data().count || 0) : 0;

    if (userMinCount >= LIMITS.perUserPerMinute) {
      return { allowed: false, reason: 'Please wait a moment before submitting another review.', remaining: LIMITS.perUserPerDay - userDayCount };
    }

    return { allowed: true, remaining: LIMITS.perUserPerDay - userDayCount };

  } catch (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: false, reason: 'Unable to verify rate limit. Please try again in a moment.', remaining: 0 };
  }
}

async function recordUsage(userId) {
  const db = admin.firestore();
  const today = getToday();
  const minuteKey = getMinuteKey();

  try {
    const batch = db.batch();

    batch.set(db.collection('rateLimits').doc('global-' + today), {
      count: admin.firestore.FieldValue.increment(1),
      lastRequest: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    batch.set(db.collection('rateLimits').doc('user-' + userId + '-' + today), {
      count: admin.firestore.FieldValue.increment(1),
      lastRequest: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    batch.set(db.collection('rateLimits').doc('user-' + userId + '-' + today + '-' + minuteKey), {
      count: admin.firestore.FieldValue.increment(1),
      lastRequest: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
  } catch (error) {
    console.error('Failed to record usage:', error);
  }
}

async function verifyFirebaseToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigins = ['https://r-tracker-liard.vercel.app', 'http://localhost:5500', 'http://127.0.0.1:5500'];
  const isAllowed = allowedOrigins.some(o => origin.startsWith(o));

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAllowed) {
    return res.status(403).json({ error: 'Unauthorized origin' });
  }

  try {
    // Verify Firebase auth token
    const userId = await verifyFirebaseToken(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to use AI reviews.' });
    }

    const { prompt, type } = req.body;

    if (!prompt || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validTypes = ['code_review', 'theory_review'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid review type' });
    }

    if (prompt.length > 50000) {
      return res.status(400).json({ error: 'Submission too long. Maximum 50,000 characters.' });
    }

    // Check rate limits
    const rateCheck = await checkRateLimits(userId);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.reason, remaining: rateCheck.remaining });
    }

    // Call Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI review service not configured' });
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
        })
      }
    );

    if (geminiResponse.status === 429) {
      return res.status(429).json({ error: 'AI review limit reached for today. Try again tomorrow.', remaining: 0 });
    }

    if (!geminiResponse.ok) {
      return res.status(502).json({ error: 'AI review service temporarily unavailable.' });
    }

    // Record successful usage
    await recordUsage(userId);

    const data = await geminiResponse.json();
    return res.status(200).json({ ...data, _rateLimit: { remaining: rateCheck.remaining - 1 } });

  } catch (error) {
    console.error('Review API error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}
