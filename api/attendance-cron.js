const { timingSafeEqual } = require('node:crypto');
const { services } = require('../server/firebase.cjs');
const { runAttendance } = require('../server/attendance.cjs');
module.exports = async (req, res) => {
  const expected = Buffer.from('Bearer ' + (process.env.CRON_SECRET || ''));
  const actual = Buffer.from(req.headers.authorization || '');
  if (!process.env.CRON_SECRET || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Unauthorized' });
  try { return res.status(200).json(await runAttendance(services().db)); }
  catch { return res.status(500).json({ error: 'Attendance job failed' }); }
};
