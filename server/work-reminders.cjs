const { domain, rows, loadContext, rolePolicy, notification } = require('./work-arrangements.cjs');
async function runWorkReminders(db, now = new Date()) {
  const d = await domain();
  const [policySnap, context, peopleSnap, checksSnap] = await Promise.all([
    db.collection('work_policies').doc('global').get(), loadContext(db), db.collection('users').where('isActive', '==', true).get(), db.collection('check_ins').get(),
  ]);
  // Migration is the explicit activation boundary for the new reminders.
  if (!policySnap.exists) return;
  const policy = policySnap.data();
  const people = rows(peopleSnap).filter(u => u.role !== 'spectator'), checks = rows(checksSnap);
  for (const user of people) {
    const userPolicy = rolePolicy(policy, context, user.id);
    const current = d.currentSchedule(user.id, now, context.arrangements, userPolicy, context);
    const p = d.effectivePolicy(userPolicy, user.id);
    const local = d.localParts(now, current.timezone);
    const events = [];
    const hasCheck = checks.some(c => c.userId === user.id && (c.workType || (c.isWfh ? 'wfh' : 'on_site')) === current.mode
      && Date.parse(c.checkInAt) < Date.parse(current.end) && (!c.checkOutAt || Date.parse(c.checkOutAt) > Date.parse(current.start)));
    if (current.mode !== 'off' && now >= new Date(Date.parse(current.start) + p.graceMinutes * 60000) && now < new Date(current.end) && !hasCheck) {
      for (const recipient of people.filter(u => u.id === user.id || ['manager', 'super_admin'].includes(u.role))) events.push({ key: `work_missing_${user.id}_${current.date}_${current.portion}_${recipient.id}`, userId: recipient.id, title: 'Missing check-in', body: user.displayName + ' has not checked in for the scheduled ' + current.mode.replace('_', ' ') + ' shift.' });
    }
    if (local.time >= '16:00') {
      const tomorrow = d.addDays(local.date, 1);
      const slots = d.resolveDay(user.id, tomorrow, context.arrangements, userPolicy, context);
      if (slots.some(s => s.arrangementId && s.mode !== 'off')) events.push({ key: `work_reminder_${user.id}_${tomorrow}`, userId: user.id, title: 'Tomorrow’s work arrangement', body: tomorrow + ': ' + slots.map(s => s.portion.toUpperCase() + ' ' + s.mode.replace('_', ' ')).join(' / ') + '. Check your working hours in Work arrangements.' });
    }
    for (const event of events) await db.runTransaction(async tx => {
      if ((await tx.get(db.collection('notifications').doc(event.key))).exists) return;
      notification(tx, db, event.userId, event.title, event.body, current.arrangementId || user.id, now.toISOString(), event.key);
    });
  }
  try { await require('./work-push.cjs').flushWorkPush(db); } catch { /* Retry on the next scheduled run. */ }
}
module.exports = { runWorkReminders };
