const { test, before } = require('node:test');
const assert = require('node:assert/strict');
let d;
before(async () => { d = await import('../shared/work-arrangements.mjs'); });
const now = new Date('2026-11-24T09:00:00Z');
function arrangement(patch = {}, policy = d.DEFAULT_POLICY) {
  return { ...d.normalizeArrangement({ mode: 'wfh', kind: 'single', startDate: '2026-11-25', reason: 'Focused work', location: 'Home', ...patch }, d.effectivePolicy(policy, 'a'), now), id: 'request', userId: 'a', status: 'approved', createdAt: now.toISOString(), approvedAt: now.toISOString() };
}
test('strict dates, half-day hours, recurrence, timezone and remote location validation', () => {
  for (const patch of [{ startDate: '2026-11-31' }, { startDate: '2026-11-20' }, { timezone: 'Bad/Zone' }, { mode: 'remote' }, { kind: 'half', portion: 'am', splitTime: '22:00' }, { weekdays: [] }, { reason: '' }]) assert.throws(() => arrangement(patch));
  assert.equal(arrangement({ mode: 'remote', city: 'Karachi', country: 'pk' }).country, 'PK');
  assert.equal(arrangement({ kind: 'permanent' }).endDate, null);
});
test('policy validates eligibility, remote countries, weekly constraints and limits', () => {
  assert.throws(() => arrangement({}, { ...d.DEFAULT_POLICY, eligible: false }));
  assert.throws(() => arrangement({ mode: 'remote', city: 'Karachi', country: 'PK' }, { ...d.DEFAULT_POLICY, remoteAllowed: false }));
  assert.throws(() => arrangement({ mode: 'remote', city: 'Karachi', country: 'PK' }, { ...d.DEFAULT_POLICY, allowedCountries: ['IT'] }));
  assert.throws(() => d.normalizePolicy({ workingDays: [1, 2], minOfficeDays: 3 }));
  assert.throws(() => d.normalizePolicy({ maxWfhDaysPerMonth: -1 }));
});
test('half days coexist, but UTC overlaps across timezones and overnight dates are rejected', () => {
  const am = arrangement({ kind: 'half', portion: 'am' });
  const pm = { ...arrangement({ kind: 'half', portion: 'pm', mode: 'on_site' }), id: 'pm' };
  d.validateSchedule(pm, [am], d.DEFAULT_POLICY);
  assert.throws(() => d.validateSchedule({ ...pm, timezone: 'Asia/Karachi' }, [am], d.DEFAULT_POLICY), /Overlapping/);
  const night = arrangement({ shiftStart: '22:00', shiftEnd: '06:00' });
  const morning = { ...arrangement({ startDate: '2026-11-26', shiftStart: '05:00', shiftEnd: '09:00' }), id: 'morning' };
  assert.throws(() => d.validateSchedule(morning, [night], d.DEFAULT_POLICY), /Overlapping/);
});
test('permanent recurrences detect future overlaps and monthly WFH quotas include half days', () => {
  const permanent = arrangement({ kind: 'permanent', weekdays: [3] });
  const future = { ...arrangement({ startDate: '2027-02-10' }), id: 'future' };
  assert.throws(() => d.validateSchedule(permanent, [future], d.DEFAULT_POLICY), /Overlapping/);
  assert.throws(() => d.validateSchedule(arrangement(), [], { ...d.DEFAULT_POLICY, maxWfhDaysPerMonth: 0 }), /WFH limit/);
  d.validateSchedule(arrangement({ kind: 'half', portion: 'am' }), [], { ...d.DEFAULT_POLICY, maxWfhDaysPerMonth: 1 });
});
test('hybrid office requirements, dated exceptions and sibling conflicts', () => {
  const policy = { ...d.DEFAULT_POLICY, workingDays: [1, 2, 3, 4, 5], minOfficeDays: 3, mandatoryOfficeDays: [1] };
  const parent = arrangement({ mode: 'hybrid', kind: 'permanent', weekdays: [1, 2, 3, 4, 5], schedule: { 1: 'on_site', 2: 'on_site', 3: 'on_site', 4: 'wfh', 5: 'wfh' } }, policy);
  d.validateSchedule(parent, [], policy);
  const change = { ...arrangement({ startDate: '2026-11-26', mode: 'on_site', parentId: parent.id }, policy), id: 'change' };
  d.validateSchedule(change, [parent], policy);
  assert.equal(d.resolveDay('a', '2026-11-26', [parent, change], policy)[0].mode, 'on_site');
  assert.throws(() => d.validateSchedule({ ...change, id: 'second' }, [parent, change], policy), /Overlapping/);
  assert.throws(() => d.validateSchedule({ ...change, startDate: '2026-11-30', endDate: '2026-11-30', mode: 'wfh' }, [parent], policy), /Mandatory office/);
});
test('leave, recurring holidays, monthly Sunday and non-working days override arrangements', () => {
  const a = arrangement({ kind: 'permanent' });
  const context = { leaves: [{ userId: 'a', date: '2026-11-26', status: 'approved' }], holidays: [{ date: '2025-12-25', isRecurring: true }] };
  for (const date of ['2026-11-26', '2026-12-25', '2026-12-06']) assert.equal(d.resolveDay('a', date, [a], d.DEFAULT_POLICY, context)[0].mode, 'off');
  assert.throws(() => d.validateSchedule(arrangement({ startDate: '2026-11-26' }), [], d.DEFAULT_POLICY, context), /time off/);
  assert.equal(d.resolveDay('a', '2026-11-28', [a], { ...d.DEFAULT_POLICY, workingDays: [1, 2, 3, 4, 5] })[0].mode, 'off');
});
test('revocation preserves historical days but removes the active approval immediately', () => {
  const a = { ...arrangement({ kind: 'permanent' }), status: 'revoked', endedAt: '2026-11-26T10:00:00Z' };
  assert.equal(d.resolveDay('a', '2026-11-25', [a])[0].mode, 'wfh');
  assert.equal(d.currentSchedule('a', new Date('2026-11-26T11:00:00Z'), [a], d.DEFAULT_POLICY).mode, 'on_site');
});
test('DST and overnight schedules resolve UTC start/end, and split modes switch at the boundary', () => {
  assert.equal(d.atLocal('2027-03-29', '09:00', 'Europe/Rome').toISOString(), '2027-03-29T07:00:00.000Z');
  assert.equal(d.atLocal('2027-01-25', '09:00', 'Europe/Rome').toISOString(), '2027-01-25T08:00:00.000Z');
  const half = arrangement({ kind: 'half', portion: 'pm' });
  assert.equal(d.currentSchedule('a', new Date('2026-11-25T11:00:00Z'), [half], d.DEFAULT_POLICY).mode, 'on_site');
  assert.equal(d.currentSchedule('a', new Date('2026-11-25T13:00:00Z'), [half], d.DEFAULT_POLICY).mode, 'wfh');
  const night = arrangement({ shiftStart: '22:00', shiftEnd: '06:00' });
  assert.equal(d.currentSchedule('a', new Date('2026-11-26T02:00:00Z'), [night], d.DEFAULT_POLICY).date, '2026-11-25');
});
test('calendar projection excludes reasons and precise locations', () => {
  const result = d.publicArrangement(arrangement({ city: 'Private city', location: 'Secret address' }));
  for (const key of ['reason', 'location', 'city', 'country', 'decisionNote']) assert.equal(result[key], undefined);
});
