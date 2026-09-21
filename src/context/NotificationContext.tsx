import {
  createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode,
} from 'react';
import type { Notification, NotificationType, ConfirmStatus } from '../models/notification';
import { subscribeToPush, sendPushToUser } from '../utils/pushManager';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

/**
 * STATUS: LOCAL-ONLY NOTIFICATIONS
 * Notifications are stored in local memory during the session.
 * Push notifications can be enabled for real-time delivery.
 */

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  pushEnabled: boolean;
  addNotification: (
    userId: string, type: NotificationType,
    title: string, body: string,
    entityType?: string, entityId?: string,
    createdBy?: string,
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: (userId: string) => void;
  confirmNotification: (id: string) => void;
  rejectNotification: (id: string, reason: string) => void;
  getForUser: (userId: string) => Notification[];
  getUrgentRejections: () => Notification[];
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* silent */ }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const prevCountRef = useRef(0);
  const mountedRef = useRef(true);
  const userIdRef = useRef<string | null>(null);

  // Set user ID from session
  useEffect(() => {
    try {
      const session = localStorage.getItem('smi_session');
      if (session) {
        const parsed = JSON.parse(session);
        userIdRef.current = parsed.id ?? null;
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Subscribe to push (once, after mount)
  useEffect(() => {
    const userId = userIdRef.current;
    if (!userId) return;
    const timer = setTimeout(() => {
      subscribeToPush(userId).then((result) => {
        if (mountedRef.current) setPushEnabled(result.ok);
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Load notifications from Firestore in real-time
  const loadNotifications = useCallback(async () => {
    console.log('[NOTIFICATIONS] loadNotifications called, userIdRef:', userIdRef.current);
    if (!userIdRef.current || !mountedRef.current) {
      console.warn('[NOTIFICATIONS] Aborting load - userIdRef:', userIdRef.current, 'mounted:', mountedRef.current);
      return;
    }
    setLoading(true);

    try {
      const db = getFirestore();
      console.log('[NOTIFICATIONS] Setting up listener for userId:', userIdRef.current);
      const q = query(collection(db, 'notifications'), where('userId', '==', userIdRef.current));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!mountedRef.current) return;

        console.log('[LISTENER] ✓ Snapshot received for user', userIdRef.current, '- Found:', snapshot.docs.length, 'notifications');

        const notifs = snapshot.docs.map((doc) => {
          const data = doc.data();
          console.log('[LISTENER] Notification:', { id: doc.id, type: data.type, title: data.title, userId: data.userId });
          return {
            id: doc.id,
            userId: data.userId,
            type: data.type as NotificationType,
            title: data.title,
            body: data.body,
            isRead: data.isRead ?? false,
            confirmStatus: (data.confirmStatus ?? 'pending') as ConfirmStatus,
            rejectReason: data.rejectReason ?? '',
            entityType: data.entityType,
            entityId: data.entityId,
            createdAt: data.createdAt ?? new Date().toISOString(),
          } as Notification;
        });

        // Sort by createdAt descending (newest first)
        notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(notifs);
        setLoading(false);
      });

      return unsubscribe;
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    loadNotifications().then((unsub) => {
      unsubscribe = unsub;
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadNotifications]);

  const addNotification = useCallback(async (
    userId: string, type: NotificationType,
    title: string, body: string,
    entityType?: string, entityId?: string,
  ) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const notif: Notification = {
      id, userId, type, title, body,
      isRead: false, confirmStatus: 'pending', rejectReason: '',
      entityType, entityId, createdAt: new Date().toISOString(),
    };

    setNotifications((prev) => [notif, ...prev]);
    playNotificationSound();

    // Send real push (fire and forget)
    sendPushToUser(userId, title, body, id).catch(() => {});
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    // Persist to Firestore
    try {
      const db = getFirestore();
      updateDoc(doc(db, 'notifications', id), { isRead: true }).catch((err) => {
        console.error(`Failed to persist markAsRead for ${id}:`, err);
      });
    } catch (e) {
      console.error('Error updating notification in Firestore:', e);
    }
  }, []);

  const markAllAsRead = useCallback((userId: string) => {
    setNotifications((prev) => prev.map((n) => n.userId === userId ? { ...n, isRead: true } : n));
    // Persist to Firestore for all unread notifications
    try {
      const db = getFirestore();
      notifications
        .filter((n) => n.userId === userId && !n.isRead)
        .forEach((n) => {
          updateDoc(doc(db, 'notifications', n.id), { isRead: true }).catch((err) => {
            console.error(`Failed to persist markAllAsRead for ${n.id}:`, err);
          });
        });
    } catch (e) {
      console.error('Error marking all as read in Firestore:', e);
    }
  }, [notifications]);

  const confirmNotification = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, isRead: true, confirmStatus: 'confirmed' as ConfirmStatus } : n),
    );
    // Persist to Firestore
    try {
      const db = getFirestore();
      updateDoc(doc(db, 'notifications', id), {
        isRead: true,
        confirmStatus: 'confirmed'
      }).catch((err) => {
        console.error(`Failed to persist confirmNotification for ${id}:`, err);
      });
    } catch (e) {
      console.error('Error confirming notification in Firestore:', e);
    }
  }, []);

  const rejectNotification = useCallback((id: string, reason: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? {
        ...n, isRead: true, confirmStatus: 'rejected' as ConfirmStatus, rejectReason: reason,
      } : n),
    );
    playNotificationSound();
    // Persist to Firestore
    try {
      const db = getFirestore();
      updateDoc(doc(db, 'notifications', id), {
        isRead: true,
        confirmStatus: 'rejected',
        rejectReason: reason,
      }).catch((err) => {
        console.error(`Failed to persist rejectNotification for ${id}:`, err);
      });
    } catch (e) {
      console.error('Error rejecting notification in Firestore:', e);
    }
  }, []);

  const getForUser = useCallback(
    (userId: string) => notifications.filter((n) => n.userId === userId),
    [notifications],
  );

  const getUrgentRejections = useCallback(
    () => notifications.filter((n) => n.confirmStatus === 'rejected'),
    [notifications],
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const value = useMemo(() => ({
    notifications, unreadCount, loading, pushEnabled, addNotification,
    markAsRead, markAllAsRead, confirmNotification,
    rejectNotification, getForUser, getUrgentRejections,
    refreshNotifications: loadNotifications,
  }), [notifications, unreadCount, loading, pushEnabled, addNotification, markAsRead, markAllAsRead,
    confirmNotification, rejectNotification, getForUser, getUrgentRejections, loadNotifications]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
