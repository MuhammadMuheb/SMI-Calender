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
  markEntityAsRead: (entityId: string) => void;
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
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const session = localStorage.getItem('smi_session');
      if (session) {
        const parsed = JSON.parse(session);
        const id = parsed.id ?? null;
        userIdRef.current = id;
        setUserId(id);
        console.log('[NOTIFICATIONS] Set userId from session:', id);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Subscribe to push (once, after mount)
  useEffect(() => {
    const id = userId;
    if (!id) return;
    const timer = setTimeout(() => {
      subscribeToPush(id).then((result) => {
        if (mountedRef.current) setPushEnabled(result.ok);
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [userId]);

  // CRITICAL: Set up notification listener when userId is available
  // This effect MUST trigger whenever userId changes to ensure the listener is active
  useEffect(() => {
    console.log('[NOTIFICATIONS] Effect triggered - userId:', userId, 'mounted:', mountedRef.current);

    if (!userId || !mountedRef.current) {
      console.warn('[NOTIFICATIONS] ⚠️ Listener setup skipped - userId:', userId, 'mounted:', mountedRef.current);
      return;
    }

    console.log('[NOTIFICATIONS] === LISTENER SETUP START === for userId:', userId);
    setLoading(true);

    try {
      const db = getFirestore();
      console.log('[NOTIFICATIONS] Creating Firestore query for userId:', userId);
      const q = query(collection(db, 'notifications'), where('userId', '==', userId));

      console.log('[NOTIFICATIONS] Setting up onSnapshot listener...');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!mountedRef.current) {
          console.warn('[LISTENER] Component unmounted, ignoring snapshot');
          return;
        }

        console.log('[LISTENER] ✓ Snapshot received for user', userId);
        console.log('[LISTENER] Total docs in snapshot:', snapshot.docs.length);
        console.log('[LISTENER] Snapshot query:', { collection: 'notifications', userId });

        if (snapshot.docs.length === 0) {
          console.warn('[LISTENER] ⚠️ NO NOTIFICATIONS FOUND for userId:', userId);
          console.log('[LISTENER] This could mean: notifications not saved OR userId mismatch');
        }

        const notifs = snapshot.docs.map((doc) => {
          const data = doc.data();
          console.log('[LISTENER] Processing notification:', {
            id: doc.id,
            type: data.type,
            title: data.title,
            storedUserId: data.userId,
            queryUserId: userId
          });

          // Ensure valid createdAt timestamp
          let createdAt = data.createdAt;
          if (!createdAt || typeof createdAt !== 'string') {
            createdAt = new Date().toISOString();
          }

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
            createdAt,
          } as Notification;
        });

        // Sort by createdAt descending (newest first) with proper timestamp validation
        notifs.sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          // Handle invalid dates by treating them as oldest
          if (isNaN(timeA)) return 1;
          if (isNaN(timeB)) return -1;
          return timeB - timeA;
        });
        console.log('[LISTENER] Setting state with', notifs.length, 'notifications');
        setNotifications(notifs);
        setLoading(false);
      }, (error) => {
        console.error('[LISTENER] ❌ Listener error:', error);
        setLoading(false);
      });

      console.log('[NOTIFICATIONS] ✅ Listener established for userId:', userId);

      return () => {
        console.log('[NOTIFICATIONS] Cleaning up listener for userId:', userId);
        unsubscribe();
      };
    } catch (err) {
      console.error('[NOTIFICATIONS] ❌ Failed to set up listener:', err);
      setLoading(false);
    }
  }, [userId]);

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
    setNotifications((prev) => {
      const updated = prev.map((n) => n.id === id ? { ...n, isRead: true } : n);
      // Re-sort by timestamp to maintain strict descending order
      return updated.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA;
      });
    });
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
    setNotifications((prev) => {
      const updated = prev.map((n) => n.userId === userId ? { ...n, isRead: true } : n);
      // Re-sort by timestamp to maintain strict descending order
      return updated.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA;
      });
    });
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

  const markEntityAsRead = useCallback((entityId: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => n.entityId === entityId ? { ...n, isRead: true } : n);
      return updated.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA;
      });
    });
    try {
      const db = getFirestore();
      notifications
        .filter((n) => n.entityId === entityId && !n.isRead)
        .forEach((n) => {
          updateDoc(doc(db, 'notifications', n.id), { isRead: true }).catch((err) => {
            console.error(`Failed to persist markEntityAsRead for ${n.id}:`, err);
          });
        });
    } catch (e) {
      console.error('Error marking entity notifications as read in Firestore:', e);
    }
  }, [notifications]);

  const confirmNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => n.id === id ? { ...n, isRead: true, confirmStatus: 'confirmed' as ConfirmStatus } : n);
      // Re-sort by timestamp to maintain strict descending order
      return updated.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA;
      });
    });
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
    setNotifications((prev) => {
      const updated = prev.map((n) => n.id === id ? {
        ...n, isRead: true, confirmStatus: 'rejected' as ConfirmStatus, rejectReason: reason,
      } : n);
      // Re-sort by timestamp to maintain strict descending order
      return updated.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA;
      });
    });
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
    (userId: string) => {
      const filtered = notifications.filter((n) => n.userId === userId);
      // Ensure strict descending timestamp order with proper validation
      return filtered.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        // Handle invalid dates by treating them as oldest
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA;
      });
    },
    [notifications],
  );

  const getUrgentRejections = useCallback(
    () => {
      const filtered = notifications.filter((n) => n.confirmStatus === 'rejected');
      // Ensure strict descending timestamp order with proper validation
      return filtered.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        // Handle invalid dates by treating them as oldest
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA;
      });
    },
    [notifications],
  );

  const refreshNotifications = useCallback(() => {
    console.log('[NOTIFICATIONS] Manual refresh triggered for userId:', userId);
    // Force a re-fetch by re-establishing the listener
    if (userId && mountedRef.current) {
      setLoading(true);
      try {
        const db = getFirestore();
        const q = query(collection(db, 'notifications'), where('userId', '==', userId));
        const unsub = onSnapshot(q, (snapshot) => {
          const notifs = snapshot.docs.map((doc) => {
            const data = doc.data();

            // Ensure valid createdAt timestamp
            let createdAt = data.createdAt;
            if (!createdAt || typeof createdAt !== 'string') {
              createdAt = new Date().toISOString();
            }

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
              createdAt,
            } as Notification;
          });

          // Sort by createdAt descending (newest first) with proper timestamp validation
          notifs.sort((a, b) => {
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            // Handle invalid dates by treating them as oldest
            if (isNaN(timeA)) return 1;
            if (isNaN(timeB)) return -1;
            return timeB - timeA;
          });

          setNotifications(notifs);
          setLoading(false);
          unsub();
        });
      } catch (err) {
        console.error('[NOTIFICATIONS] Manual refresh failed:', err);
        setLoading(false);
      }
    }
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const value = useMemo(() => ({
    notifications, unreadCount, loading, pushEnabled, addNotification,
    markAsRead, markAllAsRead, markEntityAsRead, confirmNotification,
    rejectNotification, getForUser, getUrgentRejections,
    refreshNotifications,
  }), [notifications, unreadCount, loading, pushEnabled, addNotification, markAsRead, markAllAsRead, markEntityAsRead,
    confirmNotification, rejectNotification, getForUser, getUrgentRejections, refreshNotifications]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
