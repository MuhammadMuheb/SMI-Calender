const { test } = require('node:test');
const assert = require('node:assert/strict');

test('recognises stale-deployment load errors from Chrome, Firefox, Safari and Vite', async () => {
  const { isChunkLoadError } = await import('../src/lib/lazyWithReload.ts');
  for (const message of [
    'Failed to fetch dynamically imported module: https://smi-calender.vercel.app/assets/CalendarPage-CA8kJEjB.js',
    'error loading dynamically imported module: https://smi-calender.vercel.app/assets/TaskBoard-x.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/index-abc.css',
  ]) assert.equal(isChunkLoadError(new TypeError(message)), true, message);
});

test('ordinary errors are not treated as a new version', async () => {
  const { isChunkLoadError } = await import('../src/lib/lazyWithReload.ts');
  assert.equal(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'id')")), false);
  assert.equal(isChunkLoadError(null), false);
});
