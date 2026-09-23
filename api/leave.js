const { services, requireUser } = require('../server/firebase.cjs');
const { fail, validateStaffing } = require('../server/leave.cjs');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const actor = await requireUser(req, ['staff', 'manager', 'super_admin']);
    const { db } = services();
    const { action, id, data = {} } = req.body || {};
    if (!['create', 'update'].includes(action)) fail('Invalid action');
    const ref = action === 'create' ? db.collection('leave_requests').doc() : db.collection('leave_requests').doc(String(id));
    await db.runTransaction(async tx => {
      const isAdmin = actor.role === 'super_admin';
      const isManager = actor.role === 'manager';
      const now = new Date().toISOString();
      const actorRef = { id: actor.id, displayName: actor.displayName, role: actor.role };
      let description;
      let auditAction;
      if (action === 'create') {
        if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(data.date))) fail('Invalid date');
        if (!['regular_day_off', 'paid_vacation', 'sick_day', 'auto_assigned', 'auto_sunday', 'special_day'].includes(data.leaveType)) fail('Invalid leave type');
        if (actor.id !== data.userId && !isAdmin) fail('You can only request your own leave', 403);
        if (!isAdmin && !['regular_day_off', 'paid_vacation', 'sick_day'].includes(data.leaveType)) fail('Administrator required', 403);
        const target = (await tx.get(db.collection('users').doc(data.userId))).data();
        if (!target?.isActive) fail('User not found', 404);
        const sameDate = await tx.get(db.collection('leave_requests').where('date', '==', data.date));
        if (sameDate.docs.some(d => d.data().userId === data.userId && ['pending', 'approved'].includes(d.data().status))) fail('A request already exists for this date', 409);
        if (!isAdmin) await validateStaffing(tx, db, data);
        const status = isAdmin && data.status === 'approved' ? 'approved' : 'pending';
        tx.create(ref, { userId: data.userId, userRef: { id: data.userId, displayName: target.displayName, role: target.role },
          date: data.date, leaveType: data.leaveType, status, staffNote: String(data.staffNote || '').slice(0, 4000),
          approverNote: isAdmin ? String(data.approverNote || '') : '', decidedBy: status === 'approved' ? actorRef : null,
          decidedAt: status === 'approved' ? now : null, isOverridden: false, overriddenBy: null, overriddenAt: null, createdAt: now, updatedAt: now });
        description = actor.displayName + ' requested ' + data.leaveType + ' for ' + target.displayName + ' on ' + data.date;
        auditAction = 'leave_requested';
      } else {
        const old = (await tx.get(ref)).data();
        if (!old) fail('Request not found', 404);
        const target = (await tx.get(db.collection('users').doc(old.userId))).data();
        const status = data.status;
        if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status)) fail('Invalid status');
        const ownCancel = old.userId === actor.id && status === 'cancelled' && old.status === 'pending';
        const decision = isManager && old.userId !== actor.id && target?.role === 'staff' && old.status === 'pending' && ['approved', 'rejected'].includes(status) && !data.isOverridden;
        if (!isAdmin && !ownCancel && !decision) fail('Permission denied', 403);
        if (data.isOverridden && (!isAdmin || !String(data.approverNote || '').trim())) fail('Administrator and an override reason required', 403);
        if (status === 'approved' && !isAdmin) await validateStaffing(tx, db, old);
        const patch = { status, updatedAt: now };
        if (data.isOverridden) Object.assign(patch, { isOverridden: true, overriddenBy: actorRef, overriddenAt: now });
        if (!ownCancel) Object.assign(patch, { decidedBy: actorRef, decidedAt: now, approverNote: String(data.approverNote || '').slice(0, 4000) });
        const toCancel = [];
        if (status === 'approved') {
          const mine = await tx.get(db.collection('leave_requests').where('userId', '==', old.userId));
          const moveFrom = /(?:^|[| ]+)move_from:([^ |]+)/.exec(old.staffNote || '')?.[1];
          if (moveFrom) {
            const source = mine.docs.find(d => d.id === moveFrom);
            if (!source || source.data().status !== 'approved') fail('The original day off is no longer available', 409);
            toCancel.push(source.ref);
          } else {
            const approved = mine.docs.filter(d => d.id !== id && d.data().status === 'approved' && d.data().date?.startsWith(old.date.slice(0, 7)));
            if (approved.length >= 6) {
              const automatic = approved.filter(d => d.data().leaveType === 'auto_assigned').sort((a,b) => String(a.data().createdAt).localeCompare(String(b.data().createdAt)));
              if (automatic.length) toCancel.push(automatic[automatic.length - 1].ref);
            }
          }
        }
        for (const source of toCancel) tx.update(source, { status: 'cancelled', updatedAt: now, replacedBy: id });
        tx.update(ref, patch);
        description = actor.displayName + ' changed ' + (target?.displayName || old.userId) + "'s " + (old.leaveType || 'leave') + ' on ' + old.date + ' to ' + status;
        auditAction = data.isOverridden ? 'leave_overridden' : 'leave_' + status;
      }
      tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName, action: auditAction, entityType: 'leave_request', entityId: ref.id, description, createdAt: now });
    });
    res.status(200).json({ id: ref.id });
  } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to save request' }); }
};
