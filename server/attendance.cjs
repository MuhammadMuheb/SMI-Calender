const TIME_ZONE = 'Europe/Rome';
function localParts(instant) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant).map(x => [x.type, x.value]));
  return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
}
function atLocal(date, time) {
  const wall = Date.parse(date + 'T' + time + ':00Z');
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(guess));
    guess += wall - Date.parse(p.date + 'T' + p.time + ':00Z');
  }
  return new Date(guess);
}
function shiftFor(checkIn, assignments, roles) {
  const assigned = assignments.filter(a => a.userId === checkIn.userId);
  const assignment = assigned.find(a => a.isPrimary) || assigned[0];
  const role = roles.find(r => r.id === assignment?.jobRoleId);
  const startTime = role?.shiftStart || role?.shiftStartTime || '09:00';
  const endTime = role?.shiftEnd || role?.shiftEndTime || '18:00';
  let date = localParts(new Date(checkIn.checkInAt)).date;
  const inTime = localParts(new Date(checkIn.checkInAt)).time;
  if (endTime <= startTime && inTime < endTime) date = new Date(Date.parse(date + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
  const start = atLocal(date, startTime);
  const endDate = endTime <= startTime ? new Date(Date.parse(date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10) : date;
  return { start, end: atLocal(endDate, endTime) };
}
async function runAttendance(db, now = new Date()) {
  const [checks, assignmentsSnap, rolesSnap, usersSnap] = await Promise.all([
    db.collection('check_ins').get(), db.collection('role_assignments').get(), db.collection('jobRoles').get(), db.collection('users').where('isActive', '==', true).get(),
  ]);
  const assignments = assignmentsSnap.docs.map(d => d.data());
  const roles = rolesSnap.docs.map(d => ({ ...d.data(), id: d.id }));
  const managers = usersSnap.docs.filter(d => ['manager', 'super_admin'].includes(d.data().role));
  let changed = 0;
  async function notifyOnce(key, userId, title, body, checkInId) {
    const ref = db.collection('notifications').doc(key);
    await db.runTransaction(async tx => {
      if ((await tx.get(ref)).exists) return;
      tx.create(ref, { userId, type: 'system_announcement', title, body, isRead: false, confirmStatus: 'pending', rejectReason: '', entityType: 'check_in', entityId: checkInId, createdAt: now.toISOString() });
    });
  }
  for (const snap of checks.docs) {
    const c = snap.data();
    if (!c.checkInAt || !Number.isFinite(Date.parse(c.checkInAt))) continue;
    const shift = shiftFor(c, assignments, roles);
    if (!c.checkOutAt && now.getTime() >= shift.end.getTime() + 2 * 3600000) {
      await db.runTransaction(async tx => {
        const current = (await tx.get(snap.ref)).data();
        if (!current || current.checkOutAt) return;
        const end = new Date(Math.max(Date.parse(current.checkInAt), shift.end.getTime())).toISOString();
        tx.update(snap.ref, { checkOutAt: end, autoCheckedOut: true, updatedAt: now.toISOString() });
        tx.create(db.collection('audit_log').doc(), { actorId: 'system', actorName: 'System', action: 'auto_checkout', entityType: 'check_in', entityId: snap.id, description: 'Closed missing checkout for ' + (c.userName || c.userId), createdAt: now.toISOString() });
      });
      changed++;
    } else if (!c.checkOutAt && now >= shift.end) {
      await notifyOnce('checkout_' + snap.id, c.userId, 'Remember to check out', 'Your scheduled shift has ended. Please check out when you finish.', snap.id);
    }
    if (localParts(new Date(c.checkInAt)).date === localParts(now).date && Date.parse(c.checkInAt) > shift.start.getTime() + 15 * 60000) {
      for (const manager of managers) await notifyOnce('late_' + snap.id + '_' + manager.id, manager.id, 'Late arrival', (c.userName || c.userId) + ' checked in after the shift grace period.', snap.id);
    }
  }
  const settings = (await db.collection('notificationSettings').doc('global').get()).data();
  const localNow = localParts(now);
  if (settings?.dailyReminderEnabled && localNow.time >= (settings.dailyReminderTime || '14:00')) {
    const tomorrow = new Date(Date.parse(localNow.date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
    const leaves = await db.collection('leave_requests').where('date', '==', tomorrow).get();
    const approved = leaves.docs.filter(d => d.data().status === 'approved');
    const off = new Set(approved.map(d => d.data().userId));
    for (const manager of managers) await notifyOnce('summary_' + localNow.date + '_' + manager.id, manager.id,
      "Tomorrow's absences", off.size + ' people have approved leave for ' + tomorrow, tomorrow);
  }
  return { autoCheckedOut: changed };
}
module.exports = { localParts, atLocal, shiftFor, runAttendance };
