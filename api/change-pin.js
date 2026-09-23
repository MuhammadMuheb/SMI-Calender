const { services, requireUser } = require('../server/firebase.cjs');
const { hashPin, verifyPin } = require('../server/credentials.cjs');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const user = await requireUser(req);
    const { currentPin, newPin } = req.body || {};
    if (typeof currentPin !== 'string' || currentPin.length > 128 || typeof newPin !== 'string' || !/^[0-9]{4,12}$/.test(newPin)) return res.status(400).json({ error: 'Invalid PIN' });
    const { db, auth } = services();
    const ref = db.collection('user_credentials').doc(user.id);
    await db.runTransaction(async tx => {
      const secret = (await tx.get(ref)).data();
      const now = Date.now();
      if (secret?.lockUntil > now) throw Object.assign(new Error('Try again in 15 minutes'), { status: 429 });
      if (!verifyPin(currentPin, secret?.pinHash)) {
        const attempts = (secret?.failedAttempts || 0) + 1;
        tx.update(ref, { failedAttempts: attempts, lockUntil: attempts >= 8 ? now + 900000 : 0 });
        return false;
      }
      tx.set(ref, { pinHash: hashPin(newPin), failedAttempts: 0, lockUntil: 0 });
      return true;
    }).then(async valid => {
      if (!valid) return res.status(401).json({ error: 'Current PIN is incorrect' });
      await auth.revokeRefreshTokens(user.id);
      return res.status(200).json({ ok: true });
    });
  } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to change PIN' }); }
};
