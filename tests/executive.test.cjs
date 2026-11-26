const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rolePolicy } = require('../server/work-arrangements.cjs');
test('Executive schedules keep weekends off across months and allow WFH and Hybrid weekdays', async () => {
  const d = await import('../shared/work-arrangements.mjs');
  const context = { assignments: [{ userId: 'a', jobRoleId: 'executive' }], roles: [{ id: 'executive', leavePolicy: 'executive' }] };
  assert(d.hasExecutiveRole('a', context.assignments, context.roles));
  assert(!d.hasExecutiveRole('b', context.assignments, context.roles));
  const policy = rolePolicy(d.DEFAULT_POLICY, context, 'a');
  const p = d.effectivePolicy(policy, 'a');
  for (const date of ['2026-11-28', '2026-11-29', '2026-12-05', '2026-12-06', '2027-01-02', '2027-01-03']) {
    assert(d.resolveDay('a', date, [], policy).every(s => s.mode === 'off'));
    assert(d.executiveLeaveError(date, 'paid_vacation'));
  }
  assert.equal(d.weekendDates('2026-11-01', '2026-11-30').length, 9);
  assert.equal(d.weekendDates('2027-02-01', '2027-02-28').length, 8);
  assert.equal(d.executiveLeaveError('2026-11-27', 'paid_vacation'), null);
  assert(d.executiveLeaveError('2026-11-27', 'regular_day_off'));
  for (const mode of ['wfh', 'hybrid']) {
    const a = { ...d.normalizeArrangement({ mode, kind: 'multi', startDate: '2026-11-27', endDate: '2026-11-30', schedule: { 1: 'on_site', 2: 'wfh', 3: 'on_site', 4: 'wfh', 5: 'wfh' }, location: 'Home', reason: 'Focused work' }, p, new Date('2026-11-26')), userId: 'a', id: mode, status: 'approved' };
    d.validateSchedule(a, [], policy);
    assert.equal(d.resolveDay('a', '2026-11-27', [a], policy)[0].mode, 'wfh');
    assert(d.resolveDay('a', '2026-11-28', [a], policy).every(s => s.mode === 'off'));
  }
  assert.equal(d.resolveDay('b', '2026-11-28', [], policy)[0].mode, 'on_site', 'Staff schedule is unchanged');
});
