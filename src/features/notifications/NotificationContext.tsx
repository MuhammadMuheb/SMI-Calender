import {
  createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode,
} from 'react';
import {
  collection, query, where, onSnapshot, doc, updateDoc, type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Notification, NotificationType, ConfirmStatus } from '@/models/notification';
import { subscribeToPush, sendPushToUser } from '@/features/notifications/pushManager';
import { useAuth } from '@/features/auth/AuthContext';

/**
 * Live, per-user notifications backed by the Firestore `notifications`
 * collection. The listener follows the signed-in user from AuthContext, so it
 * starts immediately after login (no page reload needed).
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

/** Older notifications were stored with emoji prefixes ("✅ Day Off Approved"). */
function cleanTitle(title: unknown): string {
  return String(title ?? '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');
}

function toNotification(id: string, data: DocumentData): Notification {
  return {
    id,
    userId: data.userId,
    type: data.type as NotificationType,
    title: cleanTitle(data.title),
    body: data.body ?? '',
    isRead: data.isRead ?? false,
    confirmStatus: (data.confirmStatus ?? 'pending') as ConfirmStatus,
    rejectReason: data.rejectReason ?? '',
    // Older notifications stored these under `data`.
    entityType: data.entityType ?? data.data?.entityType,
    entityId: data.entityId ?? data.data?.entityId,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date(0).toISOString(),
  };
}

function byNewest(a: Notification, b: Notification): number {
  const ta = new Date(a.createdAt).getTime() || 0;
  const tb = new Date(b.createdAt).getTime() || 0;
  return tb - ta;
}

function persist(id: string, updates: Record<string, unknown>) {
  updateDoc(doc(db, 'notifications', id), updates).catch((err) => {
    console.error(`Failed to update notification ${id}:`, err);
  });
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [allNotifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [listenerKey, setListenerKey] = useState(0);
  const knownIdsRef = useRef<Set<string> | null>(null);
  // Only ever expose the signed-in user's notifications (the listener is per user).
  const notifications = useMemo(
    () => (userId ? allNotifications.filter((n) => n.userId === userId) : []),
    [allNotifications, userId],
  );

  // Ask for push permission shortly after sign-in.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      subscribeToPush(userId)
        .then((result) => { if (!cancelled) setPushEnabled(result.ok); })
        .catch(() => {});
    }, 2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    knownIdsRef.current = null;

    const q = query(collection(db, 'notifications'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const next = snapshot.docs.map((d) => toNotification(d.id, d.data())).sort(byNewest);

      // Chime only for unread notifications that arrive after the first snapshot.
      const known = knownIdsRef.current;
      if (known && next.some((n) => !n.isRead && !known.has(n.id))) playNotificationSound();
      knownIdsRef.current = new Set(next.map((n) => n.id));

      setNotifications(next);
      setLoading(false);
    }, (error) => {
      console.error('Notification listener error:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId, listenerKey]);

  const addNotification = useCallback((
    targetUserId: string, type: NotificationType,
    title: string, body: string,
    entityType?: string, entityId?: string,
  ) => {
    const notif: Notification = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: targetUserId, type, title, body,
      isRead: false, confirmStatus: 'pending', rejectReason: '',
      entityType, entityId, createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [notif, ...prev]);
    sendPushToUser(targetUserId, title, body, notif.id).catch(() => {});
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    persist(id, { isRead: true });
  }, []);

  const markWhere = useCallback((predicate: (n: Notification) => boolean) => {
    setNotifications((prev) => {
      prev.filter((n) => predicate(n) && !n.isRead).forEach((n) => persist(n.id, { isRead: true }));
      return prev.map((n) => (predicate(n) ? { ...n, isRead: true } : n));
    });
  }, []);

  const markAllAsRead = useCallback((targetUserId: string) => {
    markWhere((n) => n.userId === targetUserId);
  }, [markWhere]);

  const markEntityAsRead = useCallback((entityId: string) => {
    markWhere((n) => n.entityId === entityId);
  }, [markWhere]);

  const confirmNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (
      n.id === id ? { ...n, isRead: true, confirmStatus: 'confirmed' as ConfirmStatus } : n
    )));
    persist(id, { isRead: true, confirmStatus: 'confirmed' });
  }, []);

  const rejectNotification = useCallback((id: string, reason: string) => {
    setNotifications((prev) => prev.map((n) => (
      n.id === id ? { ...n, isRead: true, confirmStatus: 'rejected' as ConfirmStatus, rejectReason: reason } : n
    )));
    persist(id, { isRead: true, confirmStatus: 'rejected', rejectReason: reason });
  }, []);

  const getForUser = useCallback(
    (targetUserId: string) => notifications.filter((n) => n.userId === targetUserId),
    [notifications],
  );

  const getUrgentRejections = useCallback(
    () => notifications.filter((n) => n.confirmStatus === 'rejected'),
    [notifications],
  );

  const refreshNotifications = useCallback(() => setListenerKey((k) => k + 1), []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const value = useMemo(() => ({
    notifications, unreadCount, loading, pushEnabled, addNotification,
    markAsRead, markAllAsRead, markEntityAsRead, confirmNotification,
    rejectNotification, getForUser, getUrgentRejections, refreshNotifications,
  }), [notifications, unreadCount, loading, pushEnabled, addNotification, markAsRead, markAllAsRead,
    markEntityAsRead, confirmNotification, rejectNotification, getForUser, getUrgentRejections,
    refreshNotifications]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
