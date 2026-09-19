
const VAPID_PUBLIC_KEY = 'BKLKHNr-4AE6fR0ZwNOqMC9oD8SfaInfzkus_ORrorTyfp16YUY_GT9hqtRhlqGT-ikfcXcI31zj2tMgxwyYyO0';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!('serviceWorker' in navigator)) return { ok: false, error: 'Service Worker not supported' };
    if (!('PushManager' in window)) return { ok: false, error: 'Push API not supported — install as PWA first' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, error: `Permission ${permission}` };

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      } catch (subErr) {
        return { ok: false, error: `Subscribe failed: ${(subErr as Error).message}` };
      }
    }

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint ?? '';
    const p256dh = subJson.keys?.p256dh ?? '';
    const auth = subJson.keys?.auth ?? '';

    if (!endpoint || !p256dh || !auth) return { ok: false, error: 'Invalid subscription keys' };

    const id = `push_${userId}_${Date.now()}`;
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ id, user_id: userId, endpoint, p256dh, auth }, { onConflict: 'user_id,endpoint' });

    if (error) return { ok: false, error: `DB save failed: ${error.message}` };

    return { ok: true };
  } catch (err) {
    return { ok: false, error: `${(err as Error).message}` };
  }
}

export async function sendPushToUser(userId: string, title: string, body: string, tag?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, tag }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: data.sent > 0, error: data.sent === 0 ? `No subscriptions found (${data.message})` : undefined };
  } catch (err) {
    return { ok: false, error: `${(err as Error).message}` };
  }
}
