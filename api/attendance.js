const { services, requireUser } = require('../server/firebase.cjs');
const { runAttendance } = require('../server/attendance.cjs');
const { fail } = require('../server/leave.cjs');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const actor = await requireUser(req, ['staff', 'manager', 'super_admin']);
    const { db } = services();
    const { action, id, data = {}, reason } = req.body || {};
    if (['status', 'check-in', 'check-out', 'switch-mode'].includes(action)) {
      const { attendanceAction } = require('../server/work-attendance.cjs');
      return res.status(200).json(await attendanceAction(db, actor, req.body));
    }
    if (!['manager', 'super_admin'].includes(actor.role)) fail('Manager required', 403);
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
        const workType = data.workType || (data.isWfh !== undefined ? data.isWfh ? 'wfh' : 'on_site' : old?.workType || (old?.isWfh ? 'wfh' : 'on_site'));
        if (!['on_site', 'wfh', 'remote'].includes(workType)) fail('Invalid work mode');
        const isWfh = workType === 'wfh';
        const location = locationId ? (await tx.get(db.collection('locations').doc(locationId))).data() : null;
        if (workType === 'on_site' && !location) fail('Choose a check-in location');
        const { domain, loadContext, rolePolicy } = require('../server/work-arrangements.cjs');
        const d = await domain();
        const policy = (await tx.get(db.collection('work_policies').doc('global'))).data() || d.DEFAULT_POLICY;
        const context = await loadContext(db, tx);
        const scheduled = d.currentSchedule(userId, new Date(checkInAt), context.arrangements, rolePolicy(policy, context, userId), context);
        const userLock = db.collection('work_locks').doc(userId);
        await tx.get(userLock);
        const otherChecks = await tx.get(db.collection('check_ins').where('userId', '==', userId));
        if (otherChecks.docs.some(c => c.id !== ref.id && Date.parse(c.data().checkInAt) < (checkOutAt ? Date.parse(checkOutAt) : Infinity) && (c.data().checkOutAt ? Date.parse(c.data().checkOutAt) : Infinity) > Date.parse(checkInAt))) fail('This attendance interval overlaps another check-in', 409);
        tx.set(ref, { ...old, userId, userName: user.displayName, userRole: user.role, checkInAt: new Date(checkInAt).toISOString(), checkOutAt: checkOutAt ? new Date(checkOutAt).toISOString() : null,
          locationId: workType === 'on_site' ? locationId : '', locationName: isWfh ? 'Home' : workType === 'remote' ? 'Remote' : location.name, isWfh, workType,
          workDate: scheduled.date, timezone: scheduled.timezone, scheduledStart: scheduled.start, scheduledEnd: scheduled.end,
          arrangementId: scheduled.arrangementId,
          editedBy: actor.id, editReason: reason, updatedAt: new Date().toISOString() });
        tx.set(userLock, { updatedAt: new Date().toISOString() });
      } else tx.delete(ref);
      tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName, action: 'attendance_' + action, entityType: 'check_in', entityId: ref.id,
        description: actor.displayName + ': ' + reason, before: old || null, createdAt: new Date().toISOString() });
    });
    return res.status(200).json({ id: ref.id });
  } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to update attendance' }); }
};
