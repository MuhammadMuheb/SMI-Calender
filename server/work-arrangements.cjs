const { randomUUID } = require('node:crypto');
const domain = () => import('../shared/work-arrangements.mjs');
const rows = snap => snap.docs.map(d => ({ ...d.data(), id: d.id }));
function canManage(actor, target) { return actor.role === 'super_admin' || actor.role === 'manager' && actor.id !== target.id && target.role === 'staff'; }
async function loadContext(db, tx = db) {
  const names = ['leave_requests', 'holidays', 'special_days', 'work_calendar', 'role_assignments', 'jobRoles'];
  const snapshots = await Promise.all(names.map(name => tx === db ? db.collection(name).get() : tx.get(db.collection(name))));
  const [leaves, holidays, specialDays, arrangements, assignments, roles] = snapshots.map(rows);
  for (const entry of [...leaves, ...holidays, ...specialDays]) if (typeof entry.date === 'string') entry.date = entry.date.split('T')[0];
  return { leaves, holidays, specialDays, arrangements, assignments, roles };
}
function rolePolicy(policy, context, userId) {
  const assigned = context.assignments.filter(a => a.userId === userId);
  const primary = assigned.find(a => a.isPrimary) || assigned[0];
  const role = context.roles.find(r => r.id === primary?.jobRoleId);
  return { ...policy, employees: { ...policy.employees, [userId]: {
    ...(role ? { shiftStart: role.shiftStart || role.shiftStartTime || '09:00', shiftEnd: role.shiftEnd || role.shiftEndTime || '18:00' } : {}),
    ...policy.employees?.[userId],
  } } };
}
function notification(tx, db, userId, title, body, entityId, now, key) {
  const ref = db.collection('notifications').doc(key || randomUUID());
  tx.set(ref, { userId, title, body, type: 'system_announcement', isRead: false, confirmStatus: 'pending', rejectReason: '', entityType: 'work_arrangement', entityId, createdAt: now, pushPending: true });
}
async function mutate(db, actor, body, now = new Date()) {
  const d = await domain();
  const { action, id, data = {}, expectedVersion, note = '' } = body;
  const policyRef = db.collection('work_policies').doc('global');
  if (action === 'policy') {
    if (actor.role !== 'super_admin') d.fail('Administrator required', 403);
    const value = d.normalizePolicy(data);
    return db.runTransaction(async tx => {
      const currentActor = (await tx.get(db.collection('users').doc(actor.id))).data();
      if (!currentActor?.isActive || currentActor.role !== 'super_admin') d.fail('Administrator access changed. Sign in again.', 403);
      const old = (await tx.get(policyRef)).data() || { ...d.DEFAULT_POLICY, version: 0 };
      if (expectedVersion !== old.version) d.fail('Policy changed. Reload before saving.', 409);
      const saved = { ...value, version: old.version + 1, updatedAt: now.toISOString(), updatedBy: actor.id };
      tx.set(policyRef, saved);
      tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName, action: 'work_policy_updated', entityType: 'work_policy', entityId: 'global', description: 'Updated work arrangement policy', before: old, after: saved, createdAt: now.toISOString() });
      return { policy: saved };
    });
  }
  if (!['request', 'assign', 'approve', 'reject', 'modify', 'revoke', 'cancel'].includes(action)) d.fail('Invalid action');
  if (!['staff', 'manager', 'super_admin'].includes(actor.role)) d.fail('Permission denied', 403);
  if (!['request', 'assign'].includes(action) && (typeof id !== 'string' || !/^[\w-]{1,128}$/.test(id))) d.fail('Invalid request ID');
  const ref = db.collection('work_arrangements').doc(['request', 'assign'].includes(action) ? randomUUID() : id);
  return db.runTransaction(async tx => {
    const currentActor = (await tx.get(db.collection('users').doc(actor.id))).data();
    if (!currentActor?.isActive || currentActor.role !== actor.role) d.fail('Your access changed. Sign in again.', 403);
    const old = (await tx.get(ref)).data();
    if (!['request', 'assign'].includes(action) && !old) d.fail('Request not found', 404);
    if (old && old.version !== expectedVersion) d.fail('This request changed. Reload before deciding.', 409);
    const userId = old?.userId || (action === 'request' ? actor.id : data.userId);
    if (typeof userId !== 'string' || !/^[\w-]{1,128}$/.test(userId)) d.fail('Choose an employee');
    const target = { ...(await tx.get(db.collection('users').doc(userId))).data(), id: userId };
    if (!target.isActive || target.role === 'spectator') d.fail('Active employee required');
    const manager = canManage(actor, target);
    if (action === 'cancel') { if (actor.id !== userId && !manager) d.fail('Permission denied', 403); }
    else if (action !== 'request' && !manager) d.fail('Only a super admin can decide manager requests; managers can decide staff requests only', 403);
    if (old && !['pending', 'approved'].includes(old.status)) d.fail('This request is already closed', 409);
    if (['approve', 'reject', 'modify'].includes(action) && old.status !== 'pending') d.fail('Create a dated change to modify an approved schedule', 409);
    if (action === 'revoke' && old.status !== 'approved') d.fail('Only approved schedules can be revoked');
    if (!['request', 'assign', 'approve'].includes(action) && !String(note).trim()) d.fail('A decision reason is required');
    const policy = (await tx.get(policyRef)).data() || { ...d.DEFAULT_POLICY, version: 0 };
    const p = d.effectivePolicy(policy, userId);
    const lock = db.collection('work_locks').doc(userId);
    await tx.get(lock);
    const mine = rows(await tx.get(db.collection('work_arrangements').where('userId', '==', userId)));
    const context = await loadContext(db, tx);
    const people = rows(await tx.get(db.collection('users').where('isActive', '==', true)));
    const openChecks = ['revoke', 'cancel'].includes(action) && old?.status === 'approved'
      ? rows(await tx.get(db.collection('check_ins').where('userId', '==', userId))).filter(c => !c.checkOutAt && c.arrangementId === ref.id) : [];
    let value = old;
    if (['request', 'assign', 'modify'].includes(action)) value = { ...old, ...d.normalizeArrangement(data, p, now), userId, userName: target.displayName, requesterRole: target.role };
    if (action === 'approve') value = { ...old, ...d.normalizeArrangement(old, p, now) };
    const status = ['assign', 'approve'].includes(action) || action === 'request' && !p.approvalRequired ? 'approved'
      : ['request', 'modify'].includes(action) ? 'pending'
      : ({ cancel: 'cancelled', revoke: 'revoked', reject: 'rejected' })[action];
    const saved = { ...value, id: ref.id, status, version: (old?.version || 0) + 1,
      createdAt: old?.createdAt || now.toISOString(), createdBy: old?.createdBy || actor.id,
      updatedAt: now.toISOString(), approvedAt: status === 'approved' ? now.toISOString() : old?.approvedAt || null,
      endedAt: old?.status === 'approved' && ['cancelled', 'revoked'].includes(status) ? now.toISOString() : null,
      decisionNote: String(note).trim().slice(0, 2000), decidedBy: actor.id };
    if (['request', 'assign', 'modify', 'approve'].includes(action)) {
      d.validateSchedule(saved, mine.map(a => a.status === 'pending' ? { ...a, status: 'approved' } : a), policy, context);
    }
    const children = mine.filter(a => a.parentId === ref.id && ['pending', 'approved'].includes(a.status));
    if (['cancel', 'revoke'].includes(action) && children.length) d.fail('Cancel or revoke the dated changes first', 409);
    tx.set(ref, saved);
    for (const check of openChecks) {
      tx.update(db.collection('check_ins').doc(check.id), { checkOutAt: now.toISOString(), updatedAt: now.toISOString(), arrangementEnded: true });
      tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName, action: 'attendance_arrangement_ended', entityType: 'check_in', entityId: check.id,
        description: 'Closed attendance segment when work arrangement was ' + status, createdAt: now.toISOString() });
    }
    if (status === 'approved' || old?.approvedAt) tx.set(db.collection('work_calendar').doc(ref.id), d.publicArrangement(saved));
    tx.set(lock, { updatedAt: now.toISOString(), requestId: ref.id });
    tx.create(db.collection('work_arrangement_history').doc(), { arrangementId: ref.id, userId, actorId: actor.id, actorName: actor.displayName,
      action, note: saved.decisionNote, before: old || null, after: saved, createdAt: now.toISOString() });
    tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName, action: 'work_arrangement_' + action, entityType: 'work_arrangement', entityId: ref.id,
      description: actor.displayName + ': ' + action + ' ' + target.displayName + ' (' + saved.mode + ', ' + saved.startDate + ')', createdAt: now.toISOString() });
    const recipients = new Set([userId, ...people.filter(u => canManage(u, target)).map(u => u.id)]);
    for (const recipient of recipients) notification(tx, db, recipient, 'Work arrangement ' + status,
      target.displayName + ': ' + saved.mode.replace('_', ' ') + ' from ' + saved.startDate + '. ' + (status === 'pending' ? 'Review in Work arrangements.' : 'View your schedule in Work arrangements.'), ref.id, now.toISOString());
    return { arrangement: saved };
  });
}
async function read(db, actor, body) {
  const d = await domain();
  const policy = (await db.collection('work_policies').doc('global').get()).data() || { ...d.DEFAULT_POLICY, version: 0 };
  if (body.action === 'history') {
    if (typeof body.id !== 'string' || !/^[\w-]{1,128}$/.test(body.id)) d.fail('Invalid ID');
    const a = (await db.collection('work_arrangements').doc(body.id).get()).data();
    const target = a && { ...(await db.collection('users').doc(a.userId).get()).data(), id: a.userId };
    if (!a || actor.id !== a.userId && !canManage(actor, target)) d.fail('Permission denied', 403);
    return { history: rows(await db.collection('work_arrangement_history').where('arrangementId', '==', body.id).get()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  }
  const all = actor.role === 'super_admin' || actor.role === 'manager';
  const arrangements = rows(await (all ? db.collection('work_arrangements') : db.collection('work_arrangements').where('userId', '==', actor.id)).get());
  const users = rows(await db.collection('users').get());
  const context = await loadContext(db);
  const teamPolicy = { ...d.DEFAULT_POLICY, employees: {} };
  for (const user of users) {
    const p = d.effectivePolicy(rolePolicy(policy, context, user.id), user.id);
    teamPolicy.employees[user.id] = { workingDays: p.workingDays, timezone: p.timezone, shiftStart: p.shiftStart, shiftEnd: p.shiftEnd, splitTime: p.splitTime };
  }
  return { arrangements: arrangements.filter(a => a.userId === actor.id || canManage(actor, users.find(u => u.id === a.userId) || {})),
    teamPolicy,
    policy: actor.role === 'super_admin' ? policy : { ...d.effectivePolicy(policy, actor.id), version: policy.version },
    departments: Object.fromEntries(users.map(u => [u.id, policy.employees?.[u.id]?.department || 'Unassigned'])) };
}
module.exports = { domain, rows, canManage, loadContext, rolePolicy, notification, mutate, read };
