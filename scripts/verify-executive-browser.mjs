// Demo emulators only. Start Vite at 5178 with VITE_USE_EMULATORS=true.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { migrateExecutive } from './migrate-executive.mjs';
import { addDays, isWeekend, localParts } from '../shared/work-arrangements.mjs';
assert.equal(process.env.FIREBASE_PROJECT_ID, 'demo-smi-calendar');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
const require = createRequire(import.meta.url);
const { chromium } = require('../.qa.local/node_modules/playwright');
const { services } = require('../server/firebase.cjs');
const { db } = services();
for (const col of await db.listCollections()) for (const doc of (await col.get()).docs) await doc.ref.delete();
let credentials;
await migrateExecutive(db, { apply: true, saveCredentials: value => { credentials = value; } });
await db.collection('users').doc('usr_maria').update({ vacationOverride: 10 });
const login = credentials.find(p => p.username === 'maria');
let friday = addDays(localParts(new Date()).date, 1);
while (new Date(friday + 'T12:00:00Z').getUTCDay() !== 5) friday = addDays(friday, 1);
const monday = addDays(friday, 3);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
mkdirSync('.qa.local/screenshots', { recursive: true });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5178');
    await page.getByLabel('Username', { exact: true }).fill(login.username);
    await page.getByLabel('PIN', { exact: true }).fill(login.pin);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText('Weekends off', { exact: true }).waitFor({ timeout: 30000 });
    await page.getByText('Every Saturday and Sunday. Weekends do not use vacation days.', { exact: true }).waitFor();
    await page.screenshot({ path: `.qa.local/screenshots/executive-dashboard-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /^Request time off$/i }).first().click();
    const dialog = page.getByRole('dialog');
    assert.equal(await dialog.getByRole('radio').count(), 2, 'Executive has vacation and sick leave choices');
    await page.getByLabel('First day', { exact: true }).fill(friday);
    await page.getByLabel('Last day', { exact: true }).fill(monday);
    await page.screenshot({ path: `.qa.local/screenshots/executive-vacation-${width}.png`, fullPage: true });
    if (width === 390) {
      await dialog.locator('button[type="submit"]').click();
      await dialog.waitFor({ state: 'hidden' });
      const leaves = await db.collection('leave_requests').where('userId', '==', 'usr_maria').get();
      assert.deepEqual(leaves.docs.map(d => d.data().date).sort(), [friday, monday]);
      assert(leaves.docs.every(d => !isWeekend(d.data().date) && d.data().leaveType === 'paid_vacation'));
    } else await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Manage arrangements', exact: true }).click();
    await page.getByRole('button', { name: 'Request arrangement', exact: true }).click();
    await page.getByLabel('Work mode', { exact: true }).selectOption('hybrid');
    assert.equal(await page.getByRole('checkbox', { name: 'Sat', exact: true }).count(), 0);
    assert.equal(await page.getByRole('checkbox', { name: 'Sun', exact: true }).count(), 0);
    await page.getByLabel('Monday', { exact: true }).waitFor();
    await page.screenshot({ path: `.qa.local/screenshots/executive-hybrid-${width}.png`, fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, viewports: [390, 1440], vacationDays: 2, weekendDeductions: 0, hybridWeekdaysOnly: true, uncaughtErrors: 0 }));
} finally { await browser.close(); await db.terminate(); }
