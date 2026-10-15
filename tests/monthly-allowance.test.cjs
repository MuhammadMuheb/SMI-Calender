const { test } = require('node:test');
const assert = require('node:assert/strict');
const { countedMonthDates, firstSundayOf, monthlyAllowance } = require('../server/leave.cjs');

const leave = (date, status = 'approved', leaveType = 'regular_day_off', id = date) => ({ id, userId: 'u', date, status, leaveType });

test('first Sunday is always counted once, even when it is also recorded', () => {
  assert.equal(firstSundayOf('2026-10'), '2026-10-04');
  assert.equal(countedMonthDates('2026-10', []).size, 1);
  assert.equal(countedMonthDates('2026-10', [leave('2026-10-04', 'approved', 'auto_sunday')]).size, 1);
});

test('5 days plus the first Sunday fills the 6-day allowance', () => {
  const days = ['2026-10-03', '2026-10-11', '2026-10-15', '2026-10-19', '2026-10-26'].map((d) => leave(d));
  const dates = countedMonthDates('2026-10', days);
  assert.equal(dates.size, 6);
  assert.equal(dates.size >= monthlyAllowance({}), true);
});

test('pending requests count only when asked, and other months, other types and ignored ids never count', () => {
  const list = [
    leave('2026-10-03', 'pending'),
    leave('2026-11-05'),
    leave('2026-10-07', 'approved', 'special_day'),
    leave('2026-10-08', 'approved', 'paid_vacation'),
    leave('2026-10-09', 'rejected'),
    leave('2026-10-12', 'approved', 'auto_assigned', 'auto-1'),
  ];
  assert.equal(countedMonthDates('2026-10', list).size, 2);
  assert.equal(countedMonthDates('2026-10', list, { includePending: true }).size, 3);
  assert.equal(countedMonthDates('2026-10', list, { ignoreIds: ['auto-1'] }).size, 1);
});

test('an administrator allowance override replaces the default of 6', () => {
  assert.equal(monthlyAllowance({ regularOverride: 4 }), 4);
  assert.equal(monthlyAllowance({ regularOverride: null }), 6);
});
