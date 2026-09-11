import { useState } from 'react';
import { theme } from '../../config/theme';
import { alpha } from '../../utils/themeColor';
import { Icons } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useThemeMode } from '../../hooks/useThemeMode';
import NotificationPanel from '../../pages/NotificationPanel';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onLogout: () => void;
}

export default function TopBar({ title, subtitle, onLogout }: TopBarProps) {
  const { user } = useAuth();
  const { getForUser } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const { mode, toggle } = useThemeMode();

  const unreadCount = user
    ? getForUser(user.id).filter((n) => !n.isRead).length
    : 0;

  return (
    <>
      <header
        className="sticky top-0 z-30 px-4 pb-3 flex items-center justify-between"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))',
          backgroundColor: theme.colors.bg,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div>
          <h1 className="text-sm font-bold" style={{ color: theme.colors.white }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
              {subtitle}
            </p>
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
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
            style={{ color: theme.colors.secondary, backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}
          >
            <span aria-hidden="true">{Icons.logout}</span>
          </button>
        </div>
      </header>

      <NotificationPanel open={showNotifs} onClose={() => setShowNotifs(false)} />
    </>
  );
}
