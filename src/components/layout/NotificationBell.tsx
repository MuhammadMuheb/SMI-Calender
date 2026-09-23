import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';
import { useNotifications } from '@/features/notifications/NotificationContext';
import NotificationPanel from '@/features/notifications/NotificationPanel';

export function NotificationBell() {
  const { user } = useAuth();
  const { getForUser } = useNotifications();
  const [open, setOpen] = useState(false);
  const unread = user ? getForUser(user.id).filter((n) => !n.isRead).length : 0;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Bell />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums ring-2 ring-background"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>
      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
