let webpush;
try {
  webpush = require('web-push');
} catch (e) {
  // Fallback: will return error below
}

const { services, requireUser } = require('../server/firebase.cjs');
const { createECDH } = require('node:crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Health check
  if (req.method === 'GET') {
    let firebase = false;
    try { firebase = !!services().db; } catch { /* Report configuration readiness without exposing credentials. */ }
    let vapidKeysMatch = false;
    let vapidPublicKey;
    try {
      const key = createECDH('prime256v1');
      const privateKey = Buffer.from(process.env.VAPID_PRIVATE_KEY || '', 'base64url');
      if (privateKey.length !== 32) throw new Error('Invalid VAPID private key length');
      key.setPrivateKey(privateKey);
      vapidPublicKey = key.getPublicKey().toString('base64url');
      vapidKeysMatch = key.getPublicKey().equals(Buffer.from(process.env.VAPID_PUBLIC_KEY || '', 'base64url'));
    } catch { /* Missing or malformed push keys are reported separately from Firebase. */ }
    return res.status(firebase ? 200 : 503).json({
      status: firebase ? 'ok' : 'not-configured',
      firebase,
      webpush: !!webpush,
      hasVapidPublic: !!process.env.VAPID_PUBLIC_KEY,
      hasVapidPrivate: !!process.env.VAPID_PRIVATE_KEY,
      vapidKeysMatch,
      // VAPID public keys are intentionally shared with browsers for subscriptions.
      ...(vapidPublicKey ? { vapidPublicKey } : {}),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!webpush) return res.status(500).json({ error: 'web-push module not available' });

  let db;
  let actor;
  try { actor = await requireUser(req); db = services().db; }
  catch (error) { return res.status(error.status || 503).json({ error: 'Sign in required' }); }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) return res.status(500).json({ error: 'VAPID keys missing from env' });

  try {
    webpush.setVapidDetails('mailto:admin@showmeitaly.com', vapidPublic, vapidPrivate);
  } catch (e) {
    return res.status(500).json({ error: 'VAPID setup failed: ' + e.message });
  }

  const { userId, title, body, tag } = req.body || {};
  if (userId !== actor.id && !['manager', 'super_admin'].includes(actor.role)) return res.status(403).json({ error: 'Permission denied' });
  if (!userId || !title) return res.status(400).json({ error: 'userId and title required' });

  try {
    if (!db) return res.status(500).json({ error: 'Firebase not initialized' });

    // Query Firestore for push subscriptions for this user
    const subsSnapshot = await db.collection('push_subscriptions').doc(userId).get();

    if (!subsSnapshot.exists) {
      return res.status(200).json({ sent: 0, message: 'No subscriptions found for user' });
    }

    const subData = subsSnapshot.data();
    // Handle both single subscription and array of subscriptions
    const subs = Array.isArray(subData)
      ? subData
      : [subData];

    if (!subs || subs.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No subscriptions' });
    }

    const payload = JSON.stringify({ title, body: body || '', tag: tag || 'smi' });
    let sent = 0;
    const errors = [];

    for (const sub of subs) {
      try {
        if (!sub.endpoint || !sub.auth || !sub.p256dh) {
          errors.push({ subscription: sub.endpoint || 'unknown', msg: 'Missing required subscription fields' });
          continue;
        }

        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        errors.push({ endpoint: sub.endpoint, status: err.statusCode, msg: err.message });
        // Remove invalid subscriptions from Firestore
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.collection('push_subscriptions').doc(userId).delete();
        }
      }
    }

    return res.status(200).json({ sent, total: subs.length, errors });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
