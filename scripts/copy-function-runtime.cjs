const fs = require('node:fs');
const path = require('node:path');
for (const file of ['attendance.cjs', 'work-reminders.cjs', 'work-arrangements.cjs', 'work-push.cjs']) {
  fs.copyFileSync(path.join(__dirname, '../server', file), path.join(__dirname, '../functions/lib', file));
}
fs.mkdirSync(path.join(__dirname, '../functions/shared'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '../shared/work-arrangements.mjs'), path.join(__dirname, '../functions/shared/work-arrangements.mjs'));
