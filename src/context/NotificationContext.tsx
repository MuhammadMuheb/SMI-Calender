import {
  createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode,
} from 'react';
import type { Notification, NotificationType, ConfirmStatus } from '../models/notification';
import {
  fetchNotifications, insertNotification, updateNotificationDb,
  markAllNotificationsRead as markAllReadDb,
} from '../services/supabaseService';
import { subscribeToPush, sendPushToUser } from '../utils/pushManager';

/**
 * STATUS: CONNECTED TO SUPABASE + WEB PUSH
 * Notifications stored in DB. Real push via Vercel API.
 * Polls every 30s as fallback. Graceful error handling.
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
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const prevCountRef = useRef(0);
  const mountedRef = useRef(true);
  const userIdRef = useRef<string | null>(null);

  // Set user ID from session (avoid useAuth circular dep)
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
    }, 2000); // delay 2s to not block app load
    return () => clearTimeout(timer);
  }, []);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      if (!mountedRef.current) return;
      if (data.length > prevCountRef.current && prevCountRef.current > 0) {
        playNotificationSound();
      }
      prevCountRef.current = data.length;
      setNotifications(data as Notification[]);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
    if (mountedRef.current) setLoading(false);
  }, []);

  // Initial load
  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Poll every 30s
  useEffect(() => {
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const addNotification = useCallback(async (
    userId: string, type: NotificationType,
    title: string, body: string,
    entityType?: string, entityId?: string,
    createdBy?: string,
  ) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const notif: Notification = {
      id, userId, type, title, body,
      isRead: false, confirmStatus: 'pending', rejectReason: '',
      entityType, entityId, createdAt: new Date().toISOString(),
    };

    try {
      await insertNotification({ id, userId, type, title, body, createdBy, entityType, entityId });
    } catch (err) {
      console.error('Failed to insert notification:', err);
    }

    setNotifications((prev) => [notif, ...prev]);
    playNotificationSound();

    // Send real push (fire and forget)
    sendPushToUser(userId, title, body, id).catch(() => {});
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    try { await updateNotificationDb(id, { isRead: true }); } catch { /* ignore */ }
  }, []);

  const markAllAsRead = useCallback(async (userId: string) => {
    setNotifications((prev) => prev.map((n) => n.userId === userId ? { ...n, isRead: true } : n));
    try { await markAllReadDb(userId); } catch { /* ignore */ }
  }, []);

  const confirmNotification = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, isRead: true, confirmStatus: 'confirmed' as ConfirmStatus } : n),
    );
    try { await updateNotificationDb(id, { isRead: true, confirmStatus: 'confirmed' }); } catch { /* ignore */ }
  }, []);

  const rejectNotification = useCallback(async (id: string, reason: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? {
        ...n, isRead: true, confirmStatus: 'rejected' as ConfirmStatus, rejectReason: reason,
      } : n),
    );
    try { await updateNotificationDb(id, { isRead: true, confirmStatus: 'rejected', rejectReason: reason }); } catch { /* ignore */ }
    playNotificationSound();
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
