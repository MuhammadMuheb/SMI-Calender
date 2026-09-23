const { createHash } = require('node:crypto');
const { services } = require('../server/firebase.cjs');
const { verifyPin } = require('../server/credentials.cjs');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const { username, pin } = req.body || {};
  if (typeof username !== 'string' || typeof pin !== 'string' || username.length > 100 || pin.length > 128) return res.status(400).json({ error: 'Invalid username or PIN' });
  try {
    const { db, auth } = services();
    const normalized = username.trim().toLowerCase();
    const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
    const now = Date.now();
    await db.runTransaction(async tx => {
      const refs = [`account:${normalized}`, `ip:${ip}`].map(k => db.collection('login_limits').doc(createHash('sha256').update(k).digest('hex')));
      const snaps = await tx.getAll(...refs);
      snaps.forEach((snap, i) => {
        const old = snap.data();
        const active = old && old.expiresAt > now;
        const attempts = active ? old.attempts : 0;
        if (attempts >= (i === 0 ? 8 : 40)) throw Object.assign(new Error('Too many attempts. Try again in 15 minutes.'), { status: 429 });
        tx.set(refs[i], { attempts: attempts + 1, expiresAt: active ? old.expiresAt : now + 900000 });
      });
    });
    const matches = await db.collection('users').where('username', '==', normalized).limit(2).get();
    const profile = matches.size === 1 ? matches.docs[0] : null;
    const user = profile?.data();
    const secret = profile ? (await db.collection('user_credentials').doc(profile.id).get()).data() : null;
    if (!user?.isActive || !verifyPin(pin, secret?.pinHash)) return res.status(401).json({ error: 'Invalid username or PIN' });
    return res.status(200).json({ token: await auth.createCustomToken(profile.id, { role: user.role }) });
  } catch (error) {
    return res.status(error.status || 503).json({ error: error.status ? error.message : 'Sign-in service unavailable' });
  }
};
