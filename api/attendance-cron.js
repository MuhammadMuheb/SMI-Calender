const { timingSafeEqual } = require('node:crypto');
const { services } = require('../server/firebase.cjs');
const { runAttendance } = require('../server/attendance.cjs');
module.exports = async (req, res) => {
  const pushOnly = req.query?.action === 'push' || /[?&]action=push(?:&|$)/.test(req.url || '');
  const secret = pushOnly ? process.env.WORK_PUSH_SECRET : process.env.CRON_SECRET;
  const expected = Buffer.from('Bearer ' + (secret || ''));
  const actual = Buffer.from(req.headers.authorization || '');
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Unauthorized' });
  try { return res.status(200).json(await (pushOnly ? require('../server/work-push.cjs').flushWorkPush(services().db) : runAttendance(services().db))); }
  catch { return res.status(500).json({ error: 'Attendance job failed' }); }
};
