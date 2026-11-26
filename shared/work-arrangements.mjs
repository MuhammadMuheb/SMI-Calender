// Pure schedule rules shared by the API, scheduler and PWA. No credentials here.
export const MODES = ['on_site', 'wfh', 'remote', 'hybrid'];
export function hasExecutiveRole(userId, assignments = [], roles = []) {
  const ids = new Set(roles.filter(r => r.leavePolicy === 'executive').map(r => r.id));
  return assignments.some(a => a.userId === userId && ids.has(a.jobRoleId));
}
export function isWeekend(date) { return [0, 6].includes(weekday(date)); }
export function weekendDates(start, end) {
  const dates = [];
  for (let date = start; date <= end; date = addDays(date, 1)) if (isWeekend(date)) dates.push(date);
  return dates;
}
export function executiveLeaveError(date, type) {
  if (isWeekend(date)) return 'Saturday and Sunday are already scheduled days off; no leave is needed.';
  if (['regular_day_off', 'auto_assigned', 'auto_sunday'].includes(type)) return 'Executive regular days off are Saturday and Sunday. Use vacation or sick leave for weekdays.';
  return null;
}
export const DEFAULT_POLICY = {
  version: 1, approvalRequired: true, eligible: true, allowedModes: MODES,
  workingDays: [0, 1, 2, 3, 4, 5, 6], mandatoryOfficeDays: [], minOfficeDays: 0,
  maxWfhDaysPerMonth: null, remoteAllowed: true, allowedCountries: [],
  locationValidation: { on_site: 'office', wfh: 'none', remote: 'none' },
  enforceHours: false, earlyCheckInMinutes: 60, graceMinutes: 15,
  timezone: 'Europe/Rome', shiftStart: '09:00', shiftEnd: '18:00', splitTime: '13:30',
  employees: {},
};
export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
export function addDays(date, count) { return new Date(Date.parse(date + 'T12:00:00Z') + count * 86400000).toISOString().slice(0, 10); }
export function weekday(date) { return new Date(date + 'T12:00:00Z').getUTCDay(); }
const formatters = new Map();
export function localParts(instant, timezone = 'Europe/Rome') {
  if (!formatters.has(timezone)) formatters.set(timezone, new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  const p = Object.fromEntries(formatters.get(timezone).formatToParts(new Date(instant)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function atLocal(date, time, timezone = 'Europe/Rome') {
  const wall = Date.parse(date + 'T' + time + ':00Z');
  let guess = wall;
  for (let i = 0; i < 4; i++) {
    const p = localParts(guess, timezone);
    guess += wall - Date.parse(p.date + 'T' + p.time + ':00Z');
  }
  return new Date(guess);
}
export function effectivePolicy(policy = {}, userId) {
  const personal = policy.employees?.[userId] || {};
  return { ...DEFAULT_POLICY, ...policy, ...personal, locationValidation: { ...DEFAULT_POLICY.locationValidation, ...policy.locationValidation, ...personal.locationValidation }, employees: undefined };
}
const timeOK = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const text = (v, n = 500) => typeof v === 'string' ? v.trim().slice(0, n) : '';
function days(value, label) {
  if (!Array.isArray(value) || value.some(n => !Number.isInteger(n) || n < 0 || n > 6)) fail('Invalid ' + label);
  return [...new Set(value)].sort();
}
export function normalizePolicy(input, employee = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid work policy');
  const base = employee ? {} : { ...DEFAULT_POLICY, employees: {} };
  for (const key of ['approvalRequired', 'eligible', 'remoteAllowed', 'enforceHours']) if (key in input) {
    if (typeof input[key] !== 'boolean') fail('Invalid ' + key); base[key] = input[key];
  }
  for (const key of ['workingDays', 'mandatoryOfficeDays']) if (key in input) base[key] = days(input[key], key);
  if (base.workingDays?.length === 0) fail('Choose at least one working day');
  if ('allowedModes' in input) {
    if (!Array.isArray(input.allowedModes) || input.allowedModes.some(v => !MODES.includes(v))) fail('Invalid allowed modes');
    base.allowedModes = [...new Set(input.allowedModes)];
  }
  for (const [key, max] of [['minOfficeDays', 7], ['maxWfhDaysPerMonth', 31], ['earlyCheckInMinutes', 240], ['graceMinutes', 120]]) if (key in input) {
    if (key === 'maxWfhDaysPerMonth' && input[key] === null) { base[key] = null; continue; }
    if (!Number.isInteger(input[key]) || input[key] < 0 || input[key] > max) fail('Invalid ' + key);
    base[key] = input[key];
  }
  if ('timezone' in input) { if (typeof input.timezone !== 'string' || !input.timezone || input.timezone.length > 80) fail('Invalid timezone'); try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format(); } catch { fail('Invalid timezone'); } base.timezone = input.timezone; }
  for (const key of ['shiftStart', 'shiftEnd', 'splitTime']) if (key in input) { if (!timeOK(input[key])) fail('Invalid working hours'); base[key] = input[key]; }
  if ('allowedCountries' in input) {
    if (!Array.isArray(input.allowedCountries) || input.allowedCountries.length > 100 || input.allowedCountries.some(v => typeof v !== 'string' || !/^[A-Z]{2}$/.test(v))) fail('Use two-letter country codes');
    base.allowedCountries = [...new Set(input.allowedCountries)];
  }
  if ('locationValidation' in input) {
    base.locationValidation = {};
    for (const mode of ['on_site', 'wfh', 'remote']) {
      const value = input.locationValidation?.[mode];
      if (!(mode === 'on_site' ? ['none', 'office'] : ['none', 'coordinates']).includes(value)) fail('Invalid location validation');
      base.locationValidation[mode] = value;
    }
  }
  if ('department' in input) base.department = text(input.department, 80);
  if (!employee) {
    if (!input.employees || typeof input.employees !== 'object' || Array.isArray(input.employees)) base.employees = {};
    else for (const [id, value] of Object.entries(input.employees)) {
      if (['__proto__', 'constructor', 'prototype'].includes(id) || !/^[\w-]{1,128}$/.test(id) || !value || typeof value !== 'object') fail('Invalid employee policy');
      base.employees[id] = normalizePolicy(value, true);
    }
    for (const id of [null, ...Object.keys(base.employees)]) {
      const p = effectivePolicy(base, id);
      if (p.shiftStart === p.shiftEnd) fail('Start and end times must be different');
      if (p.minOfficeDays > p.workingDays.length || p.mandatoryOfficeDays.some(d => !p.workingDays.includes(d))) fail('Office requirements must fit working days');
    }
  }
  return base;
}
export function normalizeArrangement(input, policy, now = new Date()) {
  const mode = input.mode;
  if (!MODES.includes(mode)) fail('Choose a work mode');
  if (mode !== 'on_site' && (!policy.eligible || !policy.allowedModes.includes(mode))) fail('This employee is not eligible for that work mode');
  const kind = input.kind;
  if (!['single', 'half', 'multi', 'recurring', 'temporary', 'permanent'].includes(kind)) fail('Choose an arrangement duration');
  const startDate = input.startDate;
  const endDate = kind === 'permanent' ? null : ['single', 'half'].includes(kind) ? startDate : input.endDate;
  if (!validDate(startDate) || (endDate !== null && (!validDate(endDate) || endDate < startDate))) fail('Invalid date range');
  const today = localParts(now, policy.timezone).date;
  if (startDate < today || startDate > addDays(today, 366)) fail('Start date must be today or within the next 12 months');
  if (endDate && endDate > addDays(startDate, 366)) fail('Use a permanent arrangement for periods longer than a year');
  const timezone = text(input.timezone, 80) || policy.timezone;
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { fail('Invalid timezone'); }
  const shiftStart = input.shiftStart || policy.shiftStart, shiftEnd = input.shiftEnd || policy.shiftEnd, splitTime = input.splitTime || policy.splitTime;
  if (![shiftStart, shiftEnd, splitTime].every(timeOK) || shiftStart === shiftEnd) fail('Invalid working hours');
  if ((kind === 'half' || input.portion && input.portion !== 'full') && !(shiftStart < splitTime && splitTime < shiftEnd)) fail('Half days require a split time between start and end on the same day');
  const portion = kind === 'half' ? input.portion : (input.portion || 'full');
  if (!['full', 'am', 'pm'].includes(portion) || (kind === 'half' && portion === 'full')) fail('Choose morning or afternoon');
  const weekdays = days(input.weekdays || policy.workingDays, 'weekdays');
  if (!weekdays.length || weekdays.some(d => !policy.workingDays.includes(d))) fail('Choose days within the employee working week');
  const schedule = {};
  if (mode === 'hybrid') for (const day of weekdays) {
    if (!['on_site', 'wfh', 'remote'].includes(input.schedule?.[day])) fail('Choose a mode for each hybrid working day');
    schedule[day] = input.schedule[day];
  }
  const modes = mode === 'hybrid' ? Object.values(schedule) : [mode];
  if (modes.includes('remote') && !policy.remoteAllowed) fail('Remote work is disabled');
  if (modes.some(m => m !== 'on_site' && !policy.allowedModes.includes(m))) fail('A scheduled work mode is not permitted');
  const location = text(input.location, 200), city = text(input.city, 100), country = text(input.country, 2).toUpperCase();
  if (modes.some(m => m !== 'on_site') && !location) fail('Describe the working location');
  if (modes.includes('remote') && (!city || !/^[A-Z]{2}$/.test(country))) fail('Remote work requires a city and two-letter country code');
  if (modes.includes('remote') && policy.allowedCountries.length && !policy.allowedCountries.includes(country)) fail('Remote work is not allowed in this country');
  const reason = text(input.reason, 2000);
  if (!reason) fail('A reason is required');
  return { mode, kind, startDate, endDate, portion, weekdays, schedule, hybridStyle: input.hybridStyle === 'flexible' ? 'flexible' : 'fixed', timezone, shiftStart, shiftEnd, splitTime,
    location, city, country, reason, parentId: text(input.parentId, 128) || null };
}
export function applies(a, date, portion = 'am') {
  return date >= a.startDate && (!a.endDate || date <= a.endDate) && a.weekdays.includes(weekday(date))
    && (a.portion === 'full' || a.portion === portion);
}
function interval(a, date) {
  const start = atLocal(date, a.portion === 'pm' ? a.splitTime : a.shiftStart, a.timezone).getTime();
  const end = atLocal(a.portion !== 'am' && a.shiftEnd <= a.shiftStart ? addDays(date, 1) : date, a.portion === 'am' ? a.splitTime : a.shiftEnd, a.timezone).getTime();
  return { start, end };
}
export function absenceFor(userId, date, context = {}) {
  if ((context.leaves || []).some(l => l.userId === userId && l.date === date && l.status === 'approved')) return 'Approved leave';
  if ((context.holidays || []).some(h => h.date === date || h.isRecurring && h.date.slice(5) === date.slice(5))) return 'Public holiday';
  if ((context.specialDays || []).some(d => d.date === date && (d.appliesToAll || d.appliesTo?.includes(userId)))) return 'Special day off';
  if (weekday(date) === 0 && Number(date.slice(8)) <= 7) return 'Monthly Sunday off';
  return null;
}
export function resolveDay(userId, date, arrangements = [], policy = DEFAULT_POLICY, context = {}) {
  const p = effectivePolicy(policy, userId);
  const absent = absenceFor(userId, date, context) || (!p.workingDays.includes(weekday(date)) ? 'Non-working day' : null);
  const slots = ['am', 'pm'].map(portion => {
    // Explicit dated changes override their approved base schedule. Later unrelated overlaps are rejected at write time.
    const matches = arrangements.filter(a => a.userId === userId && (a.status === 'approved' || a.approvedAt && a.endedAt) && applies(a, date, portion));
    matches.sort((a, b) => Number(!!b.parentId) - Number(!!a.parentId) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const a = matches.find(a => !a.endedAt || atLocal(date, portion === 'am' ? a.shiftStart : a.splitTime, a.timezone) < new Date(a.endedAt));
    const mode = a ? a.mode === 'hybrid' ? a.schedule[weekday(date)] : a.mode : 'on_site';
    return { portion, mode: absent ? 'off' : mode, reason: absent, arrangementId: a?.id || null, hybrid: a?.mode === 'hybrid',
      timezone: a?.timezone || p.timezone, shiftStart: a?.shiftStart || p.shiftStart, shiftEnd: a?.shiftEnd || p.shiftEnd,
      splitTime: a?.splitTime || p.splitTime, location: a?.location || '', endedAt: a?.endedAt || null };
  });
  // A single approved half defines the boundary for the remaining default half,
  // otherwise custom hours could make the two portions overlap or leave a gap.
  if (!!slots[0].arrangementId !== !!slots[1].arrangementId) {
    const approved = slots.find(s => s.arrangementId);
    const fallback = slots.find(s => !s.arrangementId);
    for (const key of ['timezone', 'shiftStart', 'shiftEnd', 'splitTime']) fallback[key] = approved[key];
  }
  return slots;
}
export function validateSchedule(candidate, existing, policy, context = {}) {
  const p = effectivePolicy(policy, candidate.userId);
  const active = existing.filter(a => a.id !== candidate.id && ['pending', 'approved'].includes(a.status));
  const parent = candidate.parentId && active.find(a => a.id === candidate.parentId && a.status === 'approved' && !a.parentId);
  if (candidate.parentId && !parent) fail('The original approved arrangement is no longer available', 409);
  if (parent && (candidate.startDate < parent.startDate || parent.endDate && (!candidate.endDate || candidate.endDate > parent.endDate))) fail('Changes must fit inside the original arrangement');
  if (parent && candidate.portion !== 'full' && ['timezone', 'shiftStart', 'shiftEnd', 'splitTime'].some(key => candidate[key] !== parent[key])) fail('A half-day change must retain the original timezone and working hours');
  // A finite recurrence is bounded at one year. For permanent recurrences, inspect all
  // existing finite boundaries plus a complete annual cycle after the last start.
  const lastStart = active.reduce((last, a) => a.startDate > last ? a.startDate : last, candidate.startDate);
  const end = candidate.endDate || addDays(lastStart, 371);
  let count = 0;
  for (let date = candidate.startDate; date <= end; date = addDays(date, 1)) {
    if (candidate.weekdays.includes(weekday(date))) {
      const span = interval(candidate, date);
      for (const other of active) {
        if (other.id === candidate.parentId || other.parentId === candidate.id) continue;
        // Adjacent calendar dates can overlap in UTC for remote and overnight shifts.
        for (const otherDate of [addDays(date, -1), date, addDays(date, 1)]) {
          if (!applies(other, otherDate, other.portion === 'pm' ? 'pm' : 'am')) continue;
          const otherSpan = interval(other, otherDate);
          if (span.start < otherSpan.end && otherSpan.start < span.end) fail('Overlapping working hours on ' + date, 409);
        }
      }
    }
    for (const portion of ['am', 'pm']) {
      if (!applies(candidate, date, portion)) continue;
      if (parent && !applies(parent, date, portion)) fail('An exception must fall on a day covered by its original schedule');
      for (const other of active) {
        if (other.id === candidate.parentId || other.parentId === candidate.id) continue;
        if (applies(other, date, portion)) fail('Overlapping work arrangement on ' + date + ' (' + portion + ')', 409);
      }
      if (absenceFor(candidate.userId, date, context)) {
        if (['single', 'half'].includes(candidate.kind)) fail('This date is already time off', 409);
        continue;
      }
      count++;
    }
  }
  if (!count) fail('No working days in this date range');
  const proposed = [...existing.filter(a => a.id !== candidate.id), { ...candidate, status: 'approved' }];
  const reserved = proposed.map(a => a.status === 'pending' ? { ...a, status: 'approved' } : a);
  const monthTotals = new Map();
  // Include the whole first/last month and complete weeks so limits cannot be bypassed by short requests.
  let from = candidate.startDate.slice(0, 7) + '-01';
  from = addDays(from, -((weekday(from) + 6) % 7));
  const endMonth = new Date(end + 'T12:00:00Z'); endMonth.setUTCMonth(endMonth.getUTCMonth() + 1, 0);
  const through = addDays(endMonth.toISOString().slice(0, 10), 6);
  let office = 0, possible = 0, relevantWeek = false;
  for (let date = from; date <= through; date = addDays(date, 1)) {
    const slots = resolveDay(candidate.userId, date, proposed, policy, context);
    const reservedSlots = resolveDay(candidate.userId, date, reserved, policy, context);
    if (slots.some(s => s.mode !== 'off')) {
      possible++;
      if (slots.every((s, i) => s.mode === 'on_site' && reservedSlots[i].mode === 'on_site')) office++;
      if (date >= candidate.startDate && date <= end && candidate.weekdays.includes(weekday(date))) relevantWeek = true;
      for (const [index, slot] of slots.entries()) {
        // Pending changes can reserve capacity but must never release existing
        // approved WFH days/office requirements before the change is approved.
        if (slot.mode === 'wfh' || reservedSlots[index].mode === 'wfh') monthTotals.set(date.slice(0, 7), (monthTotals.get(date.slice(0, 7)) || 0) + 0.5);
        if (applies(candidate, date, slot.portion) && slot.mode !== 'off' && slot.mode !== 'on_site' && p.mandatoryOfficeDays.includes(weekday(date))) fail('Mandatory office day: ' + date);
      }
    }
    if (weekday(date) === 0) {
      if (relevantWeek && office < Math.min(possible, p.minOfficeDays)) fail('Weekly office-day requirement is not met for week ending ' + date);
      office = 0; possible = 0; relevantWeek = false;
    }
  }
  if (p.maxWfhDaysPerMonth !== null) for (const [month, total] of monthTotals) {
    if (total > p.maxWfhDaysPerMonth) fail('WFH limit exceeded for ' + month + ' (' + total + ' days)');
  }
}
export function publicArrangement(a) {
  const { id, userId, mode, kind, startDate, endDate, portion, weekdays, schedule, hybridStyle, timezone, shiftStart, shiftEnd, splitTime, parentId, status, createdAt, approvedAt, endedAt } = a;
  return { id, userId, mode, kind, startDate, endDate, portion, weekdays, schedule, hybridStyle, timezone, shiftStart, shiftEnd, splitTime, parentId, status, createdAt, approvedAt: approvedAt || null, endedAt: endedAt || null };
}
export function currentSchedule(userId, now, arrangements, policy, context = {}) {
  arrangements = arrangements.filter(a => !a.endedAt || new Date(a.endedAt) > now);
  const p = effectivePolicy(policy, userId);
  const zones = [...new Set([p.timezone, ...arrangements.filter(a => a.userId === userId).map(a => a.timezone)])];
  const candidates = [];
  for (const zone of zones) {
    const local = localParts(now, zone);
    for (const date of [addDays(local.date, -1), local.date]) {
      const slots = resolveDay(userId, date, arrangements, policy, context);
      for (const slot of slots) {
        if (slot.timezone !== zone) continue;
        const same = slots[0].arrangementId === slots[1].arrangementId && slots[0].mode === slots[1].mode;
        if (same && slot.portion === 'pm') continue;
        const endDate = slot.shiftEnd <= slot.shiftStart ? addDays(date, 1) : date;
        const start = atLocal(date, !same && slot.portion === 'pm' ? slot.splitTime : slot.shiftStart, zone);
        const end = atLocal(!same && slot.portion === 'am' ? date : endDate, !same && slot.portion === 'am' ? slot.splitTime : slot.shiftEnd, zone);
        const until = slot.endedAt && new Date(slot.endedAt) < end ? new Date(slot.endedAt) : end;
        const early = !same && slot.portion === 'pm' ? 0 : p.earlyCheckInMinutes;
        if (now >= new Date(start.getTime() - early * 60000) && now < until) candidates.push({ ...slot, date, start: start.toISOString(), end: until.toISOString(), withinHours: true });
      }
    }
  }
  candidates.sort((a, b) => Number(!!b.arrangementId) - Number(!!a.arrangementId) || b.start.localeCompare(a.start));
  if (candidates.length) return candidates[0];
  const fallback = zones.flatMap(zone => {
    const local = localParts(now, zone);
    return resolveDay(userId, local.date, arrangements, policy, context)
      .filter(s => s.timezone === zone && s.portion === (local.time < s.splitTime ? 'am' : 'pm'))
      .map(slot => ({ slot, date: local.date }));
  }).sort((a, b) => Number(!!b.slot.arrangementId) - Number(!!a.slot.arrangementId));
  const baseLocal = localParts(now, p.timezone);
  const baseSlot = resolveDay(userId, baseLocal.date, [], policy, context).find(s => s.portion === (baseLocal.time < s.splitTime ? 'am' : 'pm'));
  const { slot, date } = fallback[0] || { slot: baseSlot, date: baseLocal.date };
  const start = atLocal(date, slot.shiftStart, slot.timezone);
  const end = atLocal(slot.shiftEnd <= slot.shiftStart ? addDays(date, 1) : date, slot.shiftEnd, slot.timezone);
  return { ...slot, date, start: start.toISOString(), end: end.toISOString(), withinHours: false };
}
