const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    console.warn('FIREBASE_SERVICE_ACCOUNT_PATH not set. Push notifications disabled.');
    return;
  }

  const resolvedPath = path.resolve(serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    console.warn(`Firebase service account file not found at ${resolvedPath}. Push notifications disabled.`);
    return;
  }

  try {
    const serviceAccount = require(resolvedPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
  }
}

// Initialize on module load
initializeFirebase();

/**
 * Send FCM push notification to a list of tokens
 * @param {string[]} tokens - Array of FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 */
async function sendPushNotification(tokens, title, body, data = {}) {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized. Skipping push notification.');
    return;
  }

  const validTokens = tokens.filter((t) => t && typeof t === 'string' && t.length > 0);
  if (validTokens.length === 0) return;

  const message = {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    tokens: validTokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(
      `FCM: ${response.successCount} sent, ${response.failureCount} failed`
    );

    // Log individual failures
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        console.error(`FCM failed for token ${validTokens[idx]}:`, resp.error?.message);
      }
    });
  } catch (err) {
    console.error('FCM send error:', err);
  }
}

module.exports = { sendPushNotification };
