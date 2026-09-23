function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function staffingError(date, userId, leaveType, rules, assignments, leaves, activeIds) {
  if (leaveType === 'sick_day') return null;
  const day = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const roles = new Set(assignments.filter(a => a.userId === userId).map(a => a.jobRoleId));
  const off = new Set(leaves.filter(l => l.status === 'approved').map(l => l.userId));
  off.add(userId);
  for (const rule of rules) {
    if (!roles.has(rule.jobRoleId) || rule.enforcement !== 'hard_block' || (rule.dayOfWeek !== null && rule.dayOfWeek !== day)) continue;
    const working = new Set(assignments.filter(a => a.jobRoleId === rule.jobRoleId && activeIds.has(a.userId) && !off.has(a.userId)).map(a => a.userId));
    if (working.size < rule.minimumRequired) return 'Minimum staffing would not be met for this date';
  }
  return null;
}
async function validateStaffing(tx, db, leave) {
  const [rules, assignments, leaves, users] = await Promise.all([
    tx.get(db.collection('staffing_rules')), tx.get(db.collection('role_assignments')),
    tx.get(db.collection('leave_requests').where('date', '==', leave.date)), tx.get(db.collection('users').where('isActive', '==', true)),
  ]);
  const error = staffingError(leave.date, leave.userId, leave.leaveType, rules.docs.map(d => d.data()), assignments.docs.map(d => d.data()), leaves.docs.map(d => d.data()), new Set(users.docs.map(d => d.id)));
  if (error) fail(error, 409);
}
module.exports = { fail, staffingError, validateStaffing };
