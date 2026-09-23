const { services, requireUser } = require('../server/firebase.cjs');
const { fail } = require('../server/leave.cjs');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const actor = await requireUser(req, ['staff', 'manager', 'super_admin']);
    const { db } = services();
    const { action, id, originalRequestId, receiverId } = req.body || {};
    if (!['propose', 'accept', 'decline'].includes(action)) fail('Invalid action');
    const ref = db.collection('swaps').doc(action === 'propose' ? String(originalRequestId) : String(id));
    await db.runTransaction(async tx => {
      const old = (await tx.get(ref)).data();
      const now = new Date().toISOString();
      if (action === 'propose') {
        if (old?.status === 'pending') fail('A swap is already pending', 409);
        const leave = (await tx.get(db.collection('leave_requests').doc(String(originalRequestId)))).data();
        const receiver = (await tx.get(db.collection('users').doc(String(receiverId)))).data();
        if (!leave || leave.userId !== actor.id || leave.status !== 'approved' || leave.leaveType !== 'regular_day_off') fail('Choose one of your approved days off');
        if (!receiver?.isActive || receiverId === actor.id || receiver.role === 'spectator') fail('Invalid recipient');
        const assignments = (await tx.get(db.collection('role_assignments'))).docs.map(d => d.data());
        const common = assignments.find(a => a.userId === actor.id && assignments.some(b => b.userId === receiverId && b.jobRoleId === a.jobRoleId));
        if (!common) fail('Swaps require a shared job role');
        tx.set(ref, { id: ref.id, proposerId: actor.id, proposerName: actor.displayName, receiverId, receiverName: receiver.displayName,
          date: leave.date, originalRequestId, commonJobRoleId: common.jobRoleId, status: 'pending', createdAt: now, resolvedAt: null });
      } else {
        if (!old || old.receiverId !== actor.id || old.status !== 'pending') fail('This swap is not available', 409);
        if (action === 'accept') {
          const sourceRef = db.collection('leave_requests').doc(old.originalRequestId);
          const source = (await tx.get(sourceRef)).data();
          const sameDate = await tx.get(db.collection('leave_requests').where('date', '==', old.date));
          const assignments = (await tx.get(db.collection('role_assignments'))).docs.map(d => d.data());
          const proposer = (await tx.get(db.collection('users').doc(old.proposerId))).data();
          if (!proposer?.isActive || !assignments.some(a => a.userId === actor.id && a.jobRoleId === old.commonJobRoleId) ||
              !assignments.some(a => a.userId === old.proposerId && a.jobRoleId === old.commonJobRoleId)) fail('The shared role is no longer assigned', 409);
          if (!source || source.status !== 'approved' || source.userId !== old.proposerId || source.date !== old.date) fail('The original day off has changed', 409);
          if (sameDate.docs.some(d => d.data().userId === actor.id && ['pending', 'approved'].includes(d.data().status))) fail('You already have leave on this day', 409);
          // A swap transfers the day off: the proposer works, the recipient is off.
          tx.update(sourceRef, { status: 'cancelled', updatedAt: now, swappedTo: actor.id });
          tx.create(db.collection('leave_requests').doc(), { ...source, userId: actor.id, userRef: { id: actor.id, displayName: actor.displayName, role: actor.role }, staffNote: 'Day off transferred by swap', createdAt: now, updatedAt: now, swapId: ref.id });
        }
        tx.update(ref, { status: action === 'accept' ? 'accepted' : 'declined', resolvedAt: now });
      }
      tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName, action: 'swap_' + action, entityType: 'swap', entityId: ref.id, description: actor.displayName + ' performed swap ' + action, createdAt: now });
    });
    res.status(200).json({ id: ref.id });
  } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to save swap' }); }
};
