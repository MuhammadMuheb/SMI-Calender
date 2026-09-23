const { services, requireUser } = require('../server/firebase.cjs');
const { runAttendance } = require('../server/attendance.cjs');
const { fail } = require('../server/leave.cjs');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const actor = await requireUser(req, ['manager', 'super_admin']);
    const { db } = services();
    const { action, id, data = {}, reason } = req.body || {};
    if (action === 'run') return res.status(200).json(await runAttendance(db));
    if (actor.role !== 'super_admin') fail('Administrator required', 403);
    if (!['save', 'delete'].includes(action) || !String(reason || '').trim()) fail('A reason is required');
    const ref = id ? db.collection('check_ins').doc(String(id)) : db.collection('check_ins').doc();
    await db.runTransaction(async tx => {
      const old = (await tx.get(ref)).data();
      if (id && !old) fail('Check-in not found', 404);
      if (action === 'save') {
        const userId = old?.userId || data.userId;
        const user = (await tx.get(db.collection('users').doc(String(userId)))).data();
        if (!user) fail('User not found');
        const checkInAt = data.checkInAt || old?.checkInAt;
        const checkOutAt = data.checkOutAt === null ? null : data.checkOutAt || old?.checkOutAt || null;
        if (!Number.isFinite(Date.parse(checkInAt)) || (checkOutAt && (!Number.isFinite(Date.parse(checkOutAt)) || Date.parse(checkOutAt) < Date.parse(checkInAt)))) fail('Checkout must be after check-in');
        const locationId = data.locationId || old?.locationId || '';
        const isWfh = data.isWfh ?? old?.isWfh ?? false;
        const location = locationId ? (await tx.get(db.collection('locations').doc(locationId))).data() : null;
        if (!isWfh && !location) fail('Choose a check-in location');
        tx.set(ref, { ...old, userId, userName: user.displayName, userRole: user.role, checkInAt: new Date(checkInAt).toISOString(), checkOutAt: checkOutAt ? new Date(checkOutAt).toISOString() : null,
          locationId, locationName: isWfh ? 'Home' : location.name, isWfh, workType: isWfh ? 'wfh' : 'on_site',
          editedBy: actor.id, editReason: reason, updatedAt: new Date().toISOString() });
      } else tx.delete(ref);
      tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName, action: 'attendance_' + action, entityType: 'check_in', entityId: ref.id,
        description: actor.displayName + ': ' + reason, before: old || null, createdAt: new Date().toISOString() });
    });
    return res.status(200).json({ id: ref.id });
  } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to update attendance' }); }
};
