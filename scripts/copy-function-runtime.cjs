const fs = require('node:fs');
const path = require('node:path');
fs.copyFileSync(path.join(__dirname, '../server/attendance.cjs'), path.join(__dirname, '../functions/lib/attendance.cjs'));
