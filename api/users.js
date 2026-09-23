const { services, requireUser } = require('../server/firebase.cjs');
const { hashPin } = require('../server/credentials.cjs');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const actor = await requireUser(req, ['super_admin']);
    const { db, auth } = services();
    const { action, id, updates = {} } = req.body || {};
    if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id)) return res.status(400).json({ error: 'Invalid user ID' });
    const ref = db.collection('users').doc(id);
    if (!['create', 'update', 'delete'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    if (id === actor.id && (action === 'delete' || updates.isActive === false || (updates.role && updates.role !== actor.role))) {
      return res.status(400).json({ error: 'You cannot remove your own administrator access' });
    }
    if (action === 'delete') {
      await db.runTransaction(async tx => {
        tx.delete(ref);
        tx.delete(db.collection('user_credentials').doc(id));
      });
      try { await auth.deleteUser(id); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    } else {
      const allowed = ['displayName', 'role', 'isActive', 'vacationOverride', 'vacationOverrideAt', 'regularOverride', 'jobRole'];
      const data = Object.fromEntries(Object.entries(updates).filter(([key]) => allowed.includes(key)));
      if (data.role && !['staff', 'manager', 'super_admin', 'spectator'].includes(data.role)) return res.status(400).json({ error: 'Invalid role' });
      if (data.isActive !== undefined && typeof data.isActive !== 'boolean') return res.status(400).json({ error: 'Invalid active status' });
      if (updates.pin !== undefined && !/^\d{4,12}$/.test(updates.pin)) return res.status(400).json({ error: 'PIN must have 4–12 digits' });
      const pinHash = updates.pin ? hashPin(updates.pin) : undefined;
      await db.runTransaction(async tx => {
        const current = await tx.get(ref);
        if (action === 'create') {
          const username = String(updates.username || '').trim().toLowerCase();
          if (!/^[a-z0-9_.-]{1,100}$/.test(username) || !pinHash || !data.displayName) throw Object.assign(new Error('Username, name and PIN required'), { status: 400 });
          const duplicates = await tx.get(db.collection('users').where('username', '==', username));
          if (current.exists || !duplicates.empty) throw Object.assign(new Error('Username already exists'), { status: 409 });
          tx.create(ref, { ...data, id, username, jobRole: [], isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        } else {
          if (!current.exists) throw Object.assign(new Error('User not found'), { status: 404 });
          tx.update(ref, { ...data, updatedAt: new Date().toISOString() });
        }
        if (pinHash) tx.set(db.collection('user_credentials').doc(id), { pinHash });
      });
      if (updates.pin || updates.isActive === false || updates.role) {
        try { await auth.revokeRefreshTokens(id); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      }
    }
    await db.collection('audit_log').add({ actorId: actor.id, actorName: actor.displayName, action: 'user_' + action, entityType: 'user', entityId: id, description: actor.displayName + ' performed user ' + action + ' for ' + id, createdAt: new Date().toISOString() });
    return res.status(200).json({ id });
  } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to save user' }); }
};
