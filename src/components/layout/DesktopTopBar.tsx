import { useState } from 'react';
import { theme } from '../../config/theme';
import { alpha } from '../../utils/themeColor';
import { Icons } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useThemeMode } from '../../hooks/useThemeMode';
import NotificationPanel from '../../pages/NotificationPanel';

interface DesktopTopBarProps {
  title: string;
  subtitle?: string;
}

export default function DesktopTopBar({ title, subtitle }: DesktopTopBarProps) {
  const { user } = useAuth();
  const { getForUser, notifications } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const { mode, toggle } = useThemeMode();

  const userNotifications = user ? getForUser(user.id) : [];
  const unreadCount = userNotifications.filter((n) => !n.isRead).length;

  // Debug logging
  console.log('[TOPBAR] ===== RENDER =====');
  console.log('[TOPBAR] Current user:', { id: user?.id, role: user?.role, displayName: user?.displayName });
  console.log('[TOPBAR] Total notifications in context:', notifications.length);
  console.log('[TOPBAR] Notifications for this user:', userNotifications.length);
  console.log('[TOPBAR] Unread count:', unreadCount);

  if (notifications.length > 0) {
    console.log('[TOPBAR] All notifications:', notifications.map(n => ({ id: n.id, userId: n.userId, title: n.title, isRead: n.isRead })));
  }

  if (unreadCount === 0 && notifications.length > 0) {
    console.log('[TOPBAR] ⚠️ Notifications exist but NONE for this user!');
    console.log('[TOPBAR] User ID:', user?.id);
    console.log('[TOPBAR] Notification user IDs:', notifications.map(n => n.userId));
  }

  return (
    <>
      <header
        className="sticky top-0 z-30 px-8 py-4 flex items-center justify-between"
        style={{ backgroundColor: theme.colors.bg, borderBottom: `1px solid ${theme.colors.border}` }}
      >
        <div>
          <h1 className="text-lg font-bold" style={{ color: theme.colors.white }}>{title}</h1>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: theme.colors.grayDark }}>{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
            style={{ color: theme.colors.white, backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}
          >
            <span aria-hidden="true">{mode === 'dark' ? Icons.sun : Icons.moon}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNotifs(true)}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            className="w-10 h-10 rounded-full flex items-center justify-center relative cursor-pointer"
            style={{ color: theme.colors.white, backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}
          >
            <span aria-hidden="true">{Icons.bell}</span>
            {unreadCount > 0 && (
              <div
                aria-hidden="true"
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-semibold tabular-nums"
                style={{
                  backgroundColor: theme.colors.secondaryLight,
                  color: theme.colors.white,
                  boxShadow: `0 0 0 2px ${theme.colors.bgElevated}, 0 1px 3px ${alpha(theme.colors.secondary, '60')}`,
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </button>
        </div>
      </header>

      <NotificationPanel open={showNotifs} onClose={() => setShowNotifs(false)} />
    </>
  );
}
