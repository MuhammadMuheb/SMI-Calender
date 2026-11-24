// Run against the demo Auth/Firestore emulators and Vite on 5178 only.
// Optional browser dependency: npm install --prefix .qa.local playwright
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { DEFAULT_POLICY, addDays, localParts } from '../shared/work-arrangements.mjs';
assert.equal(process.env.FIREBASE_PROJECT_ID, 'demo-smi-calendar');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
const require = createRequire(import.meta.url);
const { chromium } = require('../.qa.local/node_modules/playwright');
const { services } = require('../server/firebase.cjs');
const { hashPin } = require('../server/credentials.cjs');
const { db, auth } = services();
const stamp = new Date().toISOString();
const today = localParts(new Date()).date;
let date = addDays(today, 1);
if (new Date(date + 'T12:00:00Z').getUTCDay() === 0 && Number(date.slice(8)) <= 7) date = addDays(date, 1);
for (const col of await db.listCollections()) for (const doc of (await col.get()).docs) await doc.ref.delete();
for (const [id, role] of [['qa_staff', 'staff'], ['qa_manager', 'manager'], ['qa_admin', 'super_admin']]) {
  await db.collection('users').doc(id).set({ id, username: id, displayName: id.replace('qa_', 'QA '), role, isActive: true, jobRole: ['Office'], createdAt: stamp, updatedAt: stamp });
  await db.collection('user_credentials').doc(id).set({ pinHash: hashPin('4971') });
  try { await auth.createUser({ uid: id }); } catch (e) { if (e.code !== 'auth/uid-already-exists') throw e; }
}
await db.collection('work_policies').doc('global').set({ ...DEFAULT_POLICY, employees: { qa_staff: { department: 'Operations' } } });
await db.collection('locations').doc('qa_office').set({ name: 'QA Office', isActive: true, latitude: 41.9, longitude: 12.5, radius_meters: 100, allowed_roles: [] });
fs.mkdirSync('.qa.local/screenshots', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const failures = [];
async function session(username, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, geolocation: { latitude: 41.9, longitude: 12.5 }, permissions: ['geolocation'] });
  const page = await context.newPage();
  page.on('pageerror', e => failures.push(e.message));
  await page.goto('http://127.0.0.1:5178');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('PIN', { exact: true }).fill('4971');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Manage arrangements', exact: true }).waitFor({ timeout: 30000 });
  return { context, page };
}
try {
  const { page: staff } = await session('qa_staff', 390);
  await staff.getByRole('button', { name: 'Manage arrangements', exact: true }).click();
  await staff.getByRole('button', { name: 'Request arrangement', exact: true }).click();
  await staff.getByLabel('Start date', { exact: true }).fill(date);
  await staff.getByLabel('Working location (private to you and approvers)', { exact: true }).fill('QA home office');
  await staff.getByLabel('Reason', { exact: true }).fill('Browser verification request');
  await staff.screenshot({ path: '.qa.local/screenshots/mobile-request.png', fullPage: true });
  await staff.getByRole('button', { name: 'Submit request', exact: true }).click();
  await staff.getByRole('dialog').waitFor({ state: 'hidden' });
  await staff.getByText('Browser verification request', { exact: true }).waitFor();
  assert.equal(await staff.getByRole('button', { name: 'Approve', exact: true }).count(), 0);
  assert(await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page overflows');
  await staff.screenshot({ path: '.qa.local/screenshots/mobile-requests.png', fullPage: true });

  const { page: manager } = await session('qa_manager', 1440);
  await manager.getByRole('button', { name: 'Manage arrangements', exact: true }).click();
  await manager.getByRole('button', { name: 'Approve', exact: true }).click();
  await manager.getByRole('button', { name: 'Confirm decision', exact: true }).click();
  await manager.getByRole('dialog').waitFor({ state: 'hidden' });
  await manager.getByRole('button', { name: 'Dated change', exact: true }).waitFor();
  await manager.getByRole('button', { name: 'Approval history', exact: true }).click();
  await manager.getByText('approve · QA manager', { exact: true }).waitFor();
  await manager.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await manager.getByRole('tab', { name: 'Attendance report', exact: true }).click();
  await manager.getByRole('button', { name: 'Download CSV', exact: true }).waitFor();
  await manager.screenshot({ path: '.qa.local/screenshots/desktop-report.png', fullPage: true });

  const { page: admin } = await session('qa_admin', 768);
  await admin.getByRole('button', { name: 'Manage arrangements', exact: true }).click();
  await admin.getByRole('tab', { name: 'Policies & eligibility', exact: true }).click();
  await admin.getByLabel('Configure', { exact: true }).selectOption('qa_staff');
  await admin.getByLabel('Department', { exact: true }).fill('Operations QA');
  await admin.getByRole('button', { name: 'Save all policy changes', exact: true }).click();
  await admin.getByText('Work policies saved', { exact: true }).waitFor();
  assert.equal((await db.collection('work_policies').doc('global').get()).data().employees.qa_staff.department, 'Operations QA');
  await admin.screenshot({ path: '.qa.local/screenshots/tablet-policy.png', fullPage: true });
  await manager.getByRole('button', { name: 'Calendar', exact: true }).click();
  await manager.getByLabel('Employee work modes', { exact: true }).selectOption('qa_staff');
  await manager.getByLabel('Work arrangement', { exact: true }).selectOption('wfh');
  await manager.locator(`[data-date="${date}"]`).click();
  await manager.getByRole('dialog').waitFor({ state: 'visible' });
  assert.equal(await manager.getByLabel('Employee work modes', { exact: true }).inputValue(), 'qa_staff');
  assert.equal(await manager.getByLabel('Work arrangement', { exact: true }).inputValue(), 'wfh');
  await manager.getByText(`Team work modes · ${date}`, { exact: true }).last().waitFor();
  await manager.screenshot({ path: '.qa.local/screenshots/desktop-calendar.png', fullPage: true });
  await staff.getByRole('button', { name: 'Refresh', exact: true }).click();
  await staff.getByRole('button', { name: 'Dated change', exact: true }).waitFor();
  await staff.getByRole('button', { name: 'Cancel arrangement', exact: true }).click();
  await staff.getByLabel('Decision note (required)').fill('Browser verification complete');
  await staff.getByRole('button', { name: 'Confirm decision', exact: true }).click();
  await staff.getByRole('dialog').waitFor({ state: 'hidden' });
  await staff.getByText('No work arrangements in this view.', { exact: true }).waitFor();
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ passed: true, viewports: [390, 768, 1440], flows: ['employee request', 'manager approval', 'history', 'policy save', 'report', 'filtered calendar', 'cancellation'], uncaughtErrors: failures.length }));
} finally { await browser.close(); await db.terminate(); }
