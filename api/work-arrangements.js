const { services, requireUser } = require('../server/firebase.cjs');
const { read, mutate } = require('../server/work-arrangements.cjs');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const actor = await requireUser(req);
    const { db } = services();
    const body = req.body || {};
    const result = await (['list', 'history'].includes(body.action) ? read(db, actor, body) : mutate(db, actor, body));
    if (!['list', 'history'].includes(body.action)) {
      try { await require('../server/work-push.cjs').flushWorkPush(db); } catch { /* In-app delivery is committed; scheduler retries push. */ }
    }
    return res.status(200).json(result);
  } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to update work arrangements' }); }
};
