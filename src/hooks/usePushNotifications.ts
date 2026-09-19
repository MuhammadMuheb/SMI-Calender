import { useEffect, useState } from 'react';
import { initPushNotifications, requestNotificationPermission } from '../services/pushNotificationService';

/**
 * Hook to set up and manage push notifications for the logged-in user
 */
export function usePushNotifications(userId?: string) {
  const [permission, setPermission] = useState<NotificationPermission>(
    ('Notification' in window ? Notification.permission : 'denied') as NotificationPermission
  );
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (userId) {
      initPushNotifications(userId)
        .then(() => {
          setInitialized(true);
          if ('Notification' in window) {
            setPermission(Notification.permission);
          }
        })
        .catch((error) => console.error('Push notification init error:', error));
    }
  }, [userId]);

  const requestPermission = async () => {
    try {
      const newPermission = await requestNotificationPermission();
      setPermission(newPermission);

      if (newPermission === 'granted' && userId) {
        await initPushNotifications(userId);
        setInitialized(true);
      }

      return newPermission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  };

  return {
    permission,
    initialized,
    requestPermission,
    isSupported: 'Notification' in window && 'serviceWorker' in navigator,
  };
}
