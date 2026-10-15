const { services, requireUser } = require('../server/firebase.cjs');
const {
  fail, getStaffingError, validateStaffing, approvalReplacements, validateMonthlyAllowance,
  countedMonthDates, monthlyAllowance, monthLabel,
} = require('../server/leave.cjs');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const actor = await requireUser(req, ['staff', 'manager', 'super_admin']);
    const { db } = services();
    const { action, id, data = {} } = req.body || {};
    const settingsRef = db.collection('leave_settings').doc('global');
    if (action === 'get-settings' || action === 'set-settings') {
      if (!['manager', 'super_admin'].includes(actor.role)) fail('Permission denied', 403);
      if (action === 'get-settings') {
        const settings = (await settingsRef.get()).data();
        return res.status(200).json({ autoApprove: settings?.autoApprove === true });
      }
      if (actor.role !== 'super_admin') fail('Only a super admin can change Auto Approve', 403);
      if (typeof data.autoApprove !== 'boolean') fail('Invalid Auto Approve setting');
      await db.runTransaction(async tx => {
        const now = new Date().toISOString();
        tx.set(settingsRef, { autoApprove: data.autoApprove, updatedAt: now, updatedBy: actor.id });
        tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName,
          action: 'leave_auto_approve_changed', entityType: 'leave_setting', entityId: 'global',
          description: actor.displayName + (data.autoApprove ? ' enabled' : ' disabled') + ' Auto Approve for green requests', createdAt: now });
      });
      return res.status(200).json({ autoApprove: data.autoApprove });
    }
    if (action === 'assign-all') {
      if (actor.role !== 'super_admin') fail('Only a super admin can give everyone a day off', 403);
      const date = String(data.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) fail('Invalid date');
      const name = String(data.name || '').trim().slice(0, 120) || 'Day off for everyone';
      const consumesBalance = data.consumesBalance === true;
      const leaveType = consumesBalance ? 'regular_day_off' : 'special_day';
      const month = date.slice(0, 7);
      const result = await db.runTransaction(async tx => {
        const now = new Date().toISOString();
        const actorRef = { id: actor.id, displayName: actor.displayName, role: actor.role };
        const [usersSnap, monthSnap] = await Promise.all([
          tx.get(db.collection('users').where('isActive', '==', true)),
          tx.get(db.collection('leave_requests').where('date', '>=', month + '-01').where('date', '<=', month + '-31')),
        ]);
        await tx.get(db.collection('leave_day_locks').doc(date));
        const monthLeaves = monthSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const assigned = [];
        const skipped = [];
        const people = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role !== 'spectator');
        for (const u of people) {
          const mine = monthLeaves.filter(l => l.userId === u.id);
          if (mine.some(l => l.date === date && ['pending', 'approved'].includes(l.status))) {
            skipped.push({ name: u.displayName, reason: 'already has leave that day' }); continue;
          }
          if (consumesBalance) {
            const dates = countedMonthDates(month, mine);
            const allowance = monthlyAllowance(u);
            if (!dates.has(date) && dates.size >= allowance) {
              skipped.push({ name: u.displayName, reason: 'no days left in ' + monthLabel(month) }); continue;
            }
          }
          assigned.push(u);
        }
        const specialRef = db.collection('special_days').doc();
        tx.create(specialRef, { id: specialRef.id, name, date, consumesBalance, appliesToAll: true, appliesTo: [], createdBy: actor.id, createdAt: now });
        for (const u of assigned) {
          const leaveRef = db.collection('leave_requests').doc();
          tx.create(leaveRef, { userId: u.id, userRef: { id: u.id, displayName: u.displayName, role: u.role },
            date, leaveType, status: 'approved', staffNote: name,
            approverNote: 'Everyone off: ' + name, decidedBy: actorRef, decidedAt: now,
            isOverridden: false, overriddenBy: null, overriddenAt: null, createdAt: now, updatedAt: now });
          tx.create(db.collection('notifications').doc(), { userId: u.id, type: 'leave_approved',
            title: 'Day off: ' + name, body: actor.displayName + ' gave everyone ' + date + ' off' + (consumesBalance ? ' (counts towards your monthly days off).' : '.'),
            isRead: false, confirmStatus: 'pending', rejectReason: '', entityType: 'leave_request', entityId: leaveRef.id, createdAt: now });
        }
        tx.set(db.collection('leave_day_locks').doc(date), { updatedAt: now, requestId: specialRef.id });
        tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName, action: 'leave_assigned_all',
          entityType: 'special_day', entityId: specialRef.id,
          description: actor.displayName + ' gave everyone ' + date + ' off (' + name + '): ' + assigned.length + ' assigned, ' + skipped.length + ' skipped', createdAt: now });
        return { assigned: assigned.map(u => u.displayName), skipped };
      });
      return res.status(200).json(result);
    }
    if (!['create', 'update'].includes(action)) fail('Invalid action');
    const ref = action === 'create' ? db.collection('leave_requests').doc() : db.collection('leave_requests').doc(String(id));
    const saved = await db.runTransaction(async tx => {
      const isAdmin = actor.role === 'super_admin';
      const isManager = actor.role === 'manager';
      const now = new Date().toISOString();
      const actorRef = { id: actor.id, displayName: actor.displayName, role: actor.role };
      let description;
      let auditAction;
      let result;
      let cancelledIds = [];
      if (action === 'create') {
        if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(data.date))) fail('Invalid date');
        if (!['regular_day_off', 'paid_vacation', 'sick_day', 'auto_assigned', 'auto_sunday', 'special_day'].includes(data.leaveType)) fail('Invalid leave type');
        if (actor.id !== data.userId && !isAdmin) fail('You can only request your own leave', 403);
        if (!isAdmin && !['regular_day_off', 'paid_vacation', 'sick_day'].includes(data.leaveType)) fail('Administrator required', 403);
        const target = (await tx.get(db.collection('users').doc(data.userId))).data();
        if (!target?.isActive) fail('User not found', 404);
        const sameDate = await tx.get(db.collection('leave_requests').where('date', '==', data.date));
        if (sameDate.docs.some(d => d.data().userId === data.userId && ['pending', 'approved'].includes(d.data().status))) fail('A request already exists for this date', 409);
        // Serialize approvals on a date, including when there are no leaves yet.
        const dayLock = db.collection('leave_day_locks').doc(data.date);
        await tx.get(dayLock);
        const settings = (await tx.get(settingsRef)).data();
        if (!isAdmin) await validateStaffing(tx, db, data);
        const directApproval = isAdmin && data.status === 'approved';
        const autoApproved = !directApproval && settings?.autoApprove === true
          && ['regular_day_off', 'paid_vacation', 'sick_day'].includes(data.leaveType)
          && !(await getStaffingError(tx, db, data, true));
        const status = directApproval || autoApproved ? 'approved' : 'pending';
        const toCancel = autoApproved ? await approvalReplacements(tx, db, data, ref.id) : [];
        cancelledIds = toCancel.map(source => source.id);
        // Staff can't book past the allowance even with pending requests; an
        // approval (direct or automatic) is checked against approved days.
        await validateMonthlyAllowance(tx, db, { ...data, userId: data.userId }, {
          includePending: status !== 'approved', ignoreIds: cancelledIds,
        });
        const decisionActor = autoApproved ? { id: 'system', displayName: 'Auto Approve', role: 'super_admin' } : actorRef;
        result = { userId: data.userId, userRef: { id: data.userId, displayName: target.displayName, role: target.role },
          date: data.date, leaveType: data.leaveType, status, staffNote: String(data.staffNote || '').slice(0, 4000),
          approverNote: autoApproved ? 'Automatically approved: enough staffing cover.' : isAdmin ? String(data.approverNote || '') : '', decidedBy: status === 'approved' ? decisionActor : null,
          decidedAt: status === 'approved' ? now : null, isOverridden: false, overriddenBy: null, overriddenAt: null, createdAt: now, updatedAt: now };
        for (const source of toCancel) tx.update(source, { status: 'cancelled', updatedAt: now, replacedBy: ref.id });
        if (status === 'approved') tx.set(dayLock, { updatedAt: now, requestId: ref.id });
        tx.create(ref, result);
        if (autoApproved) {
          tx.create(db.collection('notifications').doc(), { userId: data.userId, type: 'leave_approved',
            title: 'Leave automatically approved', body: 'Your request for ' + data.date + ' was automatically approved because there is enough staffing cover.',
            isRead: false, confirmStatus: 'pending', rejectReason: '', entityType: 'leave_request', entityId: ref.id, createdAt: now });
          tx.create(db.collection('audit_log').doc(), { actorId: 'system', actorName: 'Auto Approve', action: 'leave_approved',
            entityType: 'leave_request', entityId: ref.id, description: 'Automatically approved ' + target.displayName + "'s leave on " + data.date + ' after checking staffing', createdAt: now });
        }
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
        const greenOnly = data.greenOnly === true;
        if (greenOnly && (status !== 'approved' || old.status !== 'pending' || old.leaveType === 'auto_sunday' || data.isOverridden)) fail('Only pending requests can be auto-approved', 409);
        if (greenOnly && !target?.isActive) fail('User is no longer active', 409);
        let dayLock;
        if (status === 'approved') {
          dayLock = db.collection('leave_day_locks').doc(old.date);
          await tx.get(dayLock);
          if (greenOnly || !isAdmin) await validateStaffing(tx, db, old, greenOnly);
        }
        const patch = { status, updatedAt: now };
        if (data.isOverridden) Object.assign(patch, { isOverridden: true, overriddenBy: actorRef, overriddenAt: now });
        if (!ownCancel) Object.assign(patch, { decidedBy: actorRef, decidedAt: now, approverNote: String(data.approverNote || '').slice(0, 4000) });
        const toCancel = status === 'approved' ? await approvalReplacements(tx, db, old, id) : [];
        cancelledIds = toCancel.map(source => source.id);
        if (status === 'approved' && old.status !== 'approved') {
          await validateMonthlyAllowance(tx, db, old, { ignoreIds: [id, ...cancelledIds] });
        }
        for (const source of toCancel) tx.update(source, { status: 'cancelled', updatedAt: now, replacedBy: id });
        if (dayLock) tx.set(dayLock, { updatedAt: now, requestId: ref.id });
        tx.update(ref, patch);
        result = { ...old, ...patch };
        description = actor.displayName + ' changed ' + (target?.displayName || old.userId) + "'s " + (old.leaveType || 'leave') + ' on ' + old.date + ' to ' + status;
        auditAction = data.isOverridden ? 'leave_overridden' : 'leave_' + status;
      }
      tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName, action: auditAction, entityType: 'leave_request', entityId: ref.id, description, createdAt: now });
      return { request: { ...result, id: ref.id }, cancelledIds };
    });
    res.status(200).json({ id: ref.id, ...saved });
  } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to save request' }); }
};
