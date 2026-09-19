// TODO: Migrate all Supabase references to Firestore

const BREAK_MINUTES: Record<string, number> = { 'Check In': 60, 'Back Office': 30, 'Back Office Extra': 30, 'Office': 30 };

function getBreak(roles: string[]): number {
  let max = 30;
  for (const r of roles) { if (BREAK_MINUTES[r] && BREAK_MINUTES[r] > max) max = BREAK_MINUTES[r]; }
  return max;
}

// ─── EXPORT ATTENDANCE TO CSV ─────────────────────────────
export async function exportAttendanceCSV(year: number, month: number) {
  console.log('TODO: Implement exportAttendanceCSV with Firestore');
  return null;
}

export async function generateMonthlySchedule(year: number, month: number) {
  console.log('TODO: Implement generateMonthlySchedule with Firestore');
  return null;
}

export async function getWorkersForDate(date: string) {
  console.log('TODO: Implement getWorkersForDate with Firestore');
  return [];
}

export async function recordAutoCheckout(checkInId: string, newCheckoutTime: string) {
  console.log('TODO: Implement recordAutoCheckout with Firestore');
  return null;
}

export async function fixMissingCheckout(checkInId: string, checkoutTime: string) {
  console.log('TODO: Implement fixMissingCheckout with Firestore');
  return null;
}

export async function sendLateAlerts() {
  console.log('TODO: Implement sendLateAlerts with Firestore');
}

export async function sendCheckoutReminders() {
  console.log('TODO: Implement sendCheckoutReminders with Firestore');
}
