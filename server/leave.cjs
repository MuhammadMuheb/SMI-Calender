function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function staffingError(date, userId, leaveType, rules, assignments, leaves, activeIds, greenOnly = false) {
  if (leaveType === 'sick_day' && !greenOnly) return null;
  const day = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const roles = new Set(assignments.filter(a => a.userId === userId).map(a => a.jobRoleId));
  const off = new Set(leaves.filter(l => l.status === 'approved').map(l => l.userId));
  off.add(userId);
  for (const rule of rules) {
    if (!roles.has(rule.jobRoleId) || (!greenOnly && rule.enforcement !== 'hard_block') || (rule.dayOfWeek !== null && rule.dayOfWeek !== day)) continue;
    const working = new Set(assignments.filter(a => a.jobRoleId === rule.jobRoleId && activeIds.has(a.userId) && !off.has(a.userId)).map(a => a.userId));
    if (working.size < rule.minimumRequired) return 'Minimum staffing would not be met for this date';
  }
  return null;
}
async function getStaffingError(tx, db, leave, greenOnly = false) {
  const [rules, assignments, leaves, users] = await Promise.all([
    tx.get(db.collection('staffing_rules')), tx.get(db.collection('role_assignments')),
    tx.get(db.collection('leave_requests').where('date', '==', leave.date)), tx.get(db.collection('users').where('isActive', '==', true)),
  ]);
  return staffingError(leave.date, leave.userId, leave.leaveType, rules.docs.map(d => d.data()), assignments.docs.map(d => d.data()), leaves.docs.map(d => d.data()), new Set(users.docs.map(d => d.id)), greenOnly);
}
async function validateStaffing(tx, db, leave, greenOnly = false) {
  const error = await getStaffingError(tx, db, leave, greenOnly);
  if (error) fail(error, 409);
}

// Read replacement documents before any transaction writes. Auto approvals must
// perform the same move/allowance replacement as a manager's approval.
async function approvalReplacements(tx, db, leave, id) {
  const mine = await tx.get(db.collection('leave_requests').where('userId', '==', leave.userId));
  const moveFrom = /(?:^|[| ]+)move_from:([^ |]+)/.exec(leave.staffNote || '')?.[1];
  if (moveFrom) {
    const source = mine.docs.find(d => d.id === moveFrom);
    if (!source || source.data().status !== 'approved') fail('The original day off is no longer available', 409);
    return [source.ref];
  }
  const approved = mine.docs.filter(d => d.id !== id && d.data().status === 'approved' && d.data().date?.startsWith(leave.date.slice(0, 7)));
  if (approved.length < 6) return [];
  const automatic = approved.filter(d => d.data().leaveType === 'auto_assigned').sort((a, b) => String(a.data().createdAt).localeCompare(String(b.data().createdAt)));
  return automatic.length ? [automatic[automatic.length - 1].ref] : [];
}
module.exports = { fail, staffingError, getStaffingError, validateStaffing, approvalReplacements };
