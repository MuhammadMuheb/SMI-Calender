
/**
 * Schedule check-in reminder notifications.
 * Call this from your CycleManager or App component.
 *
 * Strategy: Since PWAs can't do reliable background scheduling,
 * we use the service worker's periodic sync OR simply check on
 * app open whether a reminder is due.
 */

// Check if user should get a "time to check in" reminder
export async function checkShiftReminder(userId: string): Promise<boolean> {
  // Only remind between 6 AM and 10 AM
  const now = new Date();
  const hour = now.getHours();
  if (hour < 6 || hour > 10) return false;

  // Check if already checked in today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: existing } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .gte('check_in_at', startOfDay.toISOString())
    .limit(1);

  if (existing && existing.length > 0) return false;

  // Check if already reminded today (use localStorage to avoid spam)
  const lastReminder = localStorage.getItem(`checkin_reminder_${userId}`);
  const today = now.toISOString().split('T')[0];
  if (lastReminder === today) return false;

  // Mark as reminded
  localStorage.setItem(`checkin_reminder_${userId}`, today);

  return true;
}

// Show local notification reminder
export async function showCheckInReminder() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) {
    registration.showNotification('📍 Time to Check In', {
      body: 'Open the app when you arrive to check in.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'checkin-reminder',
      
    });
  }
}

// Send push reminder to a specific user via the existing /api/send-push
export async function sendPushReminder(userId: string) {
  const { data: user } = await supabase
    .from('users')
    .select('push_subscription, name')
    .eq('id', userId)
    .single();

  if (!user?.push_subscription) return;

  try {
    await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: user.push_subscription,
        title: '📍 Don\'t forget to check in!',
        body: 'Open the app when you arrive at work.',
      }),
    });
  } catch {
    // Silent fail
  }
}

// Batch send morning reminders to all staff (call from admin or cron)
export async function sendMorningReminders() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Get all users who haven't checked in today
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, push_subscription')
    .not('push_subscription', 'is', null);

  if (!allUsers) return;

  const { data: todayCheckIns } = await supabase
    .from('check_ins')
    .select('user_id')
    .gte('check_in_at', startOfDay.toISOString());

  const checkedInIds = new Set(todayCheckIns?.map((c) => c.user_id) || []);

  const needsReminder = allUsers.filter((u) => !checkedInIds.has(u.id));

  for (const user of needsReminder) {
    try {
      await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: user.push_subscription,
          title: '📍 Good morning!',
          body: 'Remember to check in when you arrive.',
        }),
      });
    } catch {
      // continue
    }
  }

  return needsReminder.length;
}
