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
// Leave types that use the monthly regular day-off allowance.
const COUNTED_TYPES = ['regular_day_off', 'auto_assigned', 'auto_sunday'];
const DEFAULT_MONTHLY_ALLOWANCE = 6;

function firstSundayOf(month) {
  const d = new Date(month + '-01T12:00:00Z');
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Days a person has off in a calendar month that count towards the allowance:
 * the first Sunday (always off) plus counted leave, as a set of dates so the
 * first Sunday or a duplicate is never counted twice.
 */
function countedMonthDates(month, leaves, { includePending = false, ignoreIds = [] } = {}) {
  const dates = new Set([firstSundayOf(month)]);
  for (const l of leaves) {
    if (ignoreIds.includes(l.id) || !COUNTED_TYPES.includes(l.leaveType) || !String(l.date || '').startsWith(month)) continue;
    if (l.status === 'approved' || (includePending && l.status === 'pending')) dates.add(l.date);
  }
  return dates;
}

function monthlyAllowance(user) {
  const override = user?.regularOverride;
  return typeof override === 'number' && override >= 0 ? override : DEFAULT_MONTHLY_ALLOWANCE;
}

function monthLabel(month) {
  return new Date(month + '-01T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Nobody may exceed their monthly allowance (6 days by default, including the
 * first Sunday). Reads only; call before any transaction writes.
 */
async function validateMonthlyAllowance(tx, db, leave, options = {}) {
  if (!COUNTED_TYPES.includes(leave.leaveType)) return;
  const month = leave.date.slice(0, 7);
  const [mine, user] = await Promise.all([
    tx.get(db.collection('leave_requests').where('userId', '==', leave.userId)),
    tx.get(db.collection('users').doc(leave.userId)),
  ]);
  const dates = countedMonthDates(month, mine.docs.map(d => ({ id: d.id, ...d.data() })), options);
  const allowance = monthlyAllowance(user.data());
  if (!dates.has(leave.date) && dates.size >= allowance) {
    const name = user.data()?.displayName || 'This person';
    fail(name + ' already has ' + dates.size + ' of ' + allowance + ' days off in ' + monthLabel(month) + ' (including the first Sunday).', 409);
  }
}

module.exports = {
  fail, staffingError, getStaffingError, validateStaffing, approvalReplacements,
  COUNTED_TYPES, firstSundayOf, countedMonthDates, monthlyAllowance, monthLabel, validateMonthlyAllowance,
};
