import { setDoc, doc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Must match the VAPID_PUBLIC_KEY configured for /api/send-push on the server.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY?.startsWith('B')
  ? import.meta.env.VITE_VAPID_PUBLIC_KEY
  : 'BKLKHNr-4AE6fR0ZwNOqMC9oD8SfaInfzkus_ORrorTyfp16YUY_GT9hqtRhlqGT-ikfcXcI31zj2tMgxwyYyO0';

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

    // Save subscription to Firestore
    try {
      // toJSON() gives the keys as base64url strings, which is what both
      // Firestore and the web-push library on the server expect.
      const { keys } = subscription.toJSON();
      const subscriptionData = {
        endpoint: subscription.endpoint,
        auth: keys?.auth ?? '',
        p256dh: keys?.p256dh ?? '',
        userId,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(collection(db, 'push_subscriptions'), userId), subscriptionData);
    } catch (firestoreErr) {
      console.error('Failed to save subscription to Firestore:', firestoreErr);
      return { ok: false, error: 'Failed to save subscription' };
    }

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
    if (!res.ok) return { ok: false, error: `API error: ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `${(err as Error).message}` };
  }
}
