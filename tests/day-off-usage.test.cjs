const { test } = require('node:test');
const assert = require('node:assert/strict');

test('team usage caps historical overbooking while retaining the real count in its description', async () => {
  const { getDayOffUsage } = await import('../src/features/staff/dayOffUsage.ts');
  for (const approved of [7, 10]) {
    const result = getDayOffUsage(approved, 6);
    assert.equal(result.used, 6);
    assert.equal(result.allowed, 6);
    assert.equal(result.percentage, 100);
    assert.match(result.description, new RegExp(`${approved} approved days`));
  }
  assert.equal(getDayOffUsage(3, 6).used, 3);
  assert.equal(getDayOffUsage(3, 6).percentage, 50);
});

test('team usage handles zero, invalid values and explicit administrator allowances', async () => {
  const { getDayOffUsage } = await import('../src/features/staff/dayOffUsage.ts');
  assert.equal(getDayOffUsage(7, 4).used, 4);
  assert.equal(getDayOffUsage(7, 8).used, 7);
  for (const [approved, allowed] of [[7, 0], [-1, 6], [NaN, 6], [7, Infinity], [7, -2]]) {
    const result = getDayOffUsage(approved, allowed);
    assert(result.used >= 0 && result.used <= result.allowed);
    assert(result.percentage >= 0 && result.percentage <= 100);
  }
});
