export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin || '';
    const allowedOrigins = ['https://r-tracker-liard.vercel.app', 'http://localhost:5500', 'http://127.0.0.1:5500'];
    if (allowedOrigins.some(o => origin.startsWith(o))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    return res.status(200).end();
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify origin
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = ['https://r-tracker-liard.vercel.app', 'http://localhost:5500', 'http://127.0.0.1:5500'];
  const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Unauthorized origin' });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { prompt, type, userId } = req.body;

    if (!prompt || !type || !userId) {
      return res.status(400).json({ error: 'Missing required fields: prompt, type, userId' });
    }

    // Validate type
    const validTypes = ['code_review', 'theory_review'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid review type' });
    }

    // Validate prompt length
    if (prompt.length > 50000) {
      return res.status(400).json({ error: 'Submission too long. Maximum 50,000 characters.' });
    }

    // Call Gemini API with the server-side key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured');
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
      return res.status(429).json({ error: 'AI review limit reached for today. Try again tomorrow.' });
    }

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', geminiResponse.status);
      return res.status(502).json({ error: 'AI review service temporarily unavailable. Try again in a moment.' });
    }

    const data = await geminiResponse.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Review API error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}
