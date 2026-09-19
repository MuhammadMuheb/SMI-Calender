
const BREAK_MINUTES: Record<string, number> = { 'Check In': 60, 'Back Office': 30, 'Back Office Extra': 30, 'Office': 30 };

function getBreak(roles: string[]): number {
  let max = 30;
  for (const r of roles) { if (BREAK_MINUTES[r] && BREAK_MINUTES[r] > max) max = BREAK_MINUTES[r]; }
  return max;
}

// ─── EXPORT ATTENDANCE TO CSV ─────────────────────────────
export async function exportAttendanceCSV(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const { data } = await supabase
    .from('check_ins')
    .select('id, user_id, check_in_at, check_out_at, is_wfh, work_type, auto_checked_out, users(display_name, job_role), locations(name)')
    .gte('check_in_at', startDate.toISOString())
    .lte('check_in_at', endDate.toISOString())
    .order('check_in_at', { ascending: true });

  if (!data || data.length === 0) return null;

  const rows: string[][] = [
    ['Name', 'Job Role', 'Date', 'Check In', 'Check Out', 'Location', 'WFH', 'Gross Hours', 'Break (min)', 'Net Hours', 'Auto Checkout']
  ];

  for (const r of data) {
    const user = (r as any).users;
    const loc = (r as any).locations;
    const name = user?.display_name || 'Unknown';
    const roles: string[] = user?.job_role || ['Office'];
    const breakMin = getBreak(roles);

    const checkIn = new Date(r.check_in_at);
    const checkOut = r.check_out_at ? new Date(r.check_out_at) : null;
    const grossMs = checkOut ? checkOut.getTime() - checkIn.getTime() : 0;
    const grossH = grossMs / 3600000;
    const netH = Math.max(grossH - breakMin / 60, 0);

    rows.push([
      name,
      roles.join(', '),
      checkIn.toLocaleDateString('en-CA'),
      checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      checkOut ? checkOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'MISSING',
      loc?.name || 'Unknown',
      r.is_wfh ? 'Yes' : 'No',
      grossH > 0 ? grossH.toFixed(2) : '',
      String(breakMin),
      netH > 0 ? netH.toFixed(2) : '',
      r.auto_checked_out ? 'Yes' : '',
    ]);
  }

  // Build CSV
  const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });
  a.download = `Attendance_${monthName}_${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

// ─── LATE ARRIVAL CHECK ───────────────────────────────────
// Call this on app load for managers/admins. Returns staff who are on duty but haven't checked in by cutoff.
export async function checkLateArrivals(cutoffHour = 9, cutoffMinute = 30): Promise<{ id: string; name: string }[]> {
  const now = new Date();
  if (now.getHours() < cutoffHour || (now.getHours() === cutoffHour && now.getMinutes() < cutoffMinute)) return [];
  if (now.getHours() > 12) return []; // Don't check after noon

  const today = now.toISOString().split('T')[0];

  // Get all active users
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('is_active', true);
  if (!allUsers) return [];

  // Get who has approved leave today
  const { data: offToday } = await supabase
    .from('leave_requests')
    .select('user_id')
    .eq('date', today)
    .eq('status', 'approved');
  const offIds = new Set((offToday || []).map((r: any) => r.user_id));

  // Get who already checked in today
  const startOfDay = `${today}T00:00:00`;
  const { data: checkedIn } = await supabase
    .from('check_ins')
    .select('user_id')
    .gte('check_in_at', startOfDay);
  const checkedInIds = new Set((checkedIn || []).map((r: any) => r.user_id));

  // Late = on duty (not off) AND not checked in
  return allUsers
    .filter((u: any) => !offIds.has(u.id) && !checkedInIds.has(u.id))
    .map((u: any) => ({ id: u.id, name: u.display_name }));
}

// ─── AUTO CHECKOUT REMINDER ──────────────────────────────
// Call periodically. Returns users who have been checked in for > thresholdHours.
export async function getOverdueCheckIns(thresholdHours = 9): Promise<{ id: string; userId: string; userName: string; hours: number }[]> {
  const cutoff = new Date(Date.now() - thresholdHours * 3600000).toISOString();

  const { data } = await supabase
    .from('check_ins')
    .select('id, user_id, check_in_at, users(display_name)')
    .is('check_out_at', null)
    .lt('check_in_at', cutoff);

  if (!data) return [];

  return data.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.users?.display_name || 'Unknown',
    hours: Math.round((Date.now() - new Date(r.check_in_at).getTime()) / 3600000 * 10) / 10,
  }));
}

// Send push reminder to overdue users
export async function sendCheckoutReminders() {
  const overdue = await getOverdueCheckIns(9);
  for (const o of overdue) {
    try {
      await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: o.userId,
          title: '⏰ Still checked in?',
          body: `You've been checked in for ${o.hours}h. Did you forget to check out?`,
          tag: 'checkout-reminder',
        }),
      });
    } catch {}
  }
  return overdue.length;
}

// Send late arrival alerts to managers
export async function sendLateAlerts() {
  const late = await checkLateArrivals();
  if (late.length === 0) return 0;

  const names = late.map((l) => l.name).join(', ');

  // Get managers
  const { data: managers } = await supabase
    .from('users')
    .select('id')
    .in('role', ['super_admin', 'manager']);

  if (!managers) return 0;

  for (const mgr of managers) {
    try {
      await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: mgr.id,
          title: `⚠️ ${late.length} staff not checked in`,
          body: `${names} — still not checked in by 9:30`,
          tag: 'late-alert',
        }),
      });
    } catch {}
  }
  return late.length;
}
