import { savePushSubscription } from './firestoreService';
import { VAPID_PUBLIC_KEY } from '../lib/firebase';

/**
 * Initialize and manage web push notifications
 */

export async function initPushNotifications(userId: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Request permission
    if (Notification.permission === 'granted') {
      await subscribeUserToPush(registration, userId);
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await subscribeUserToPush(registration, userId);
      }
    }
  } catch (error) {
    console.error('Failed to initialize push notifications:', error);
  }
}

async function subscribeUserToPush(
  registration: ServiceWorkerRegistration,
  userId: string
): Promise<void> {
  try {
    const vapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey.buffer as ArrayBuffer,
    });

    // Send subscription to backend
    await savePushSubscription(userId, subscription);

    console.log('Push subscription successful');
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
  }
}

export async function unsubscribeFromPush(_userId: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      // Note: In a real app, you'd delete the subscription from the database too
      // using: await removePushSubscription(subscriptionId);
      console.log('Unsubscribed from push notifications');
    }
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
  }
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Show a local notification (for testing without push)
 */
export function showLocalNotification(
  title: string,
  options?: NotificationOptions
): void {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      ...options,
    });
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    return await Notification.requestPermission();
  }

  return 'denied';
}
