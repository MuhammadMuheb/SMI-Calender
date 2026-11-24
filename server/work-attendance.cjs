const { domain, loadContext, rolePolicy, rows, notification } = require('./work-arrangements.cjs');
function distance(lat1, lng1, lat2, lng2) {
  const rad = n => n * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function attendanceAction(db, actor, body, now = new Date()) {
  const d = await domain();
  if (!['staff', 'manager', 'super_admin'].includes(actor.role)) d.fail('Employee access required', 403);
  const { action, data = {} } = body;
  return db.runTransaction(async tx => {
    const currentActor = (await tx.get(db.collection('users').doc(actor.id))).data();
    if (!currentActor?.isActive || currentActor.role !== actor.role) d.fail('Your access changed. Sign in again.', 403);
    const lock = db.collection('work_locks').doc(actor.id);
    await tx.get(lock);
    const checks = rows(await tx.get(db.collection('check_ins').where('userId', '==', actor.id)));
    const active = checks.filter(c => !c.checkOutAt).sort((a, b) => b.checkInAt.localeCompare(a.checkInAt));
    const policyData = (await tx.get(db.collection('work_policies').doc('global'))).data() || d.DEFAULT_POLICY;
    const context = await loadContext(db, tx);
    const policy = rolePolicy(policyData, context, actor.id);
    const p = d.effectivePolicy(policy, actor.id);
    const mine = rows(await tx.get(db.collection('work_arrangements').where('userId', '==', actor.id)));
    const current = d.currentSchedule(actor.id, now, mine, policy, context);
    const { location, ...publicCurrent } = current;
    if (action === 'status') return { active: active[0] || null, current: publicCurrent, validation: p.locationValidation[current.mode] || 'none', enforceHours: p.enforceHours };
    const managers = rows(await tx.get(db.collection('users').where('isActive', '==', true))).filter(u => ['manager', 'super_admin'].includes(u.role));
    const stamp = now.toISOString();
    if (action === 'check-out') {
      if (!active.length) return { active: null };
      // Close legacy duplicate sessions together so a user cannot get stuck checked in.
      for (const c of active) {
        tx.update(db.collection('check_ins').doc(c.id), { checkOutAt: stamp, updatedAt: stamp });
        tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName, action: 'attendance_check_out', entityType: 'check_in', entityId: c.id, description: actor.displayName + ' checked out', createdAt: stamp });
      }
      tx.set(lock, { updatedAt: stamp });
      for (const manager of managers) notification(tx, db, manager.id, 'Staff left', actor.displayName + ' checked out.', active[0].id, stamp);
      return { active: null };
    }
    if (!['check-in', 'switch-mode'].includes(action)) d.fail('Invalid attendance action');
    if (action === 'check-in' && active.length) d.fail('You are already checked in', 409);
    if (action === 'switch-mode' && !active.length) d.fail('Check in first', 409);
    if (current.mode === 'off') d.fail('Check-in unavailable: ' + current.reason, 409);
    if (p.enforceHours && !current.withinHours) d.fail('Check-in is outside your approved working hours');
    if (action === 'switch-mode' && active[0].workType === current.mode && active[0].arrangementId === current.arrangementId) d.fail('Your current check-in already matches this schedule');
    const validation = p.locationValidation[current.mode];
    const lat = data.latitude, lng = data.longitude;
    const validCoordinates = Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
    let locationId = '', locationName = current.mode === 'wfh' ? 'Home (WFH)' : current.mode === 'remote' ? 'Remote' : 'On-site';
    if (validation === 'coordinates' && !validCoordinates) d.fail('Share your current location to check in');
    if (current.mode === 'on_site') {
      const locations = rows(await tx.get(db.collection('locations'))).filter(l => l.isActive !== false);
      const place = locations.find(l => l.id === data.locationId);
      if (!place) d.fail('Choose an active office location');
      const roleIds = context.assignments.filter(a => a.userId === actor.id).map(a => a.jobRoleId);
      const names = context.roles.filter(r => roleIds.includes(r.id)).map(r => r.name.toLowerCase());
      const allowed = place.allowed_roles || place.allowedRoles || [];
      if (allowed.length && names.length && !allowed.some(r => names.includes(String(r).toLowerCase()) || roleIds.includes(r))) d.fail('This location is not available to your job role', 403);
      if (validation === 'office') {
        if (!validCoordinates) d.fail('Share your location to check in at the office');
        if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) d.fail('Office coordinates are not configured');
        const accuracy = Number.isFinite(data.accuracy) ? Math.min(Math.max(data.accuracy, 0), 100) : 0;
        if (distance(lat, lng, place.latitude, place.longitude) - accuracy > (place.radius_meters ?? place.radius ?? 100)) d.fail('You are outside this office check-in area');
      }
      locationId = place.id; locationName = place.name;
    }
    const ref = db.collection('check_ins').doc();
    const record = { userId: actor.id, userName: actor.displayName, userRole: actor.role,
      locationId, locationName, checkInAt: stamp, checkOutAt: null, isWfh: current.mode === 'wfh', workType: current.mode,
      arrangementId: current.arrangementId, workDate: current.date, timezone: current.timezone,
      scheduledStart: current.start, scheduledEnd: current.end, graceMinutes: p.graceMinutes,
      checkInLat: validation !== 'none' && validCoordinates ? lat : null, checkInLng: validation !== 'none' && validCoordinates ? lng : null,
      createdAt: stamp, updatedAt: stamp };
    if (action === 'switch-mode') for (const c of active) tx.update(db.collection('check_ins').doc(c.id), { checkOutAt: stamp, updatedAt: stamp, switchedTo: ref.id });
    tx.create(ref, record);
    tx.set(lock, { updatedAt: stamp });
    tx.create(db.collection('audit_log').doc(), { actorId: actor.id, actorName: actor.displayName, action: 'attendance_' + action.replace('-', '_'), entityType: 'check_in', entityId: ref.id,
      description: actor.displayName + ' checked in: ' + current.mode, createdAt: stamp });
    for (const manager of managers) notification(tx, db, manager.id, 'Staff arrived', actor.displayName + ': ' + locationName, ref.id, stamp);
    return { active: { ...record, id: ref.id } };
  });
}
module.exports = { attendanceAction, distance };
