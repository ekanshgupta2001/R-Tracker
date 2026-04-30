export async function handler(event) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'ok',
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      hasFirebaseApiKey: !!process.env.FIREBASE_API_KEY,
      nodeVersion: process.version
    })
  };
}
