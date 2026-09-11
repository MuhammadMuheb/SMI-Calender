import { useState } from 'react';
import { theme } from '../../config/theme';
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
  const { getForUser } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const { mode, toggle } = useThemeMode();

  const unreadCount = user ? getForUser(user.id).filter((n) => !n.isRead).length : 0;

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
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{ backgroundColor: theme.colors.danger, color: theme.colors.white }}
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
