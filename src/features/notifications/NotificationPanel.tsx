import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Bell, CalendarClock, CircleCheck, CircleX, Coffee, Inbox, RefreshCw, Scale, ShieldAlert,
  TriangleAlert, type LucideIcon,
} from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import { useNotifications } from '@/features/notifications/NotificationContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { insertNotification } from '@/services/firestore/core';
import { sendPushToUser } from '@/features/notifications/pushManager';
import { useAppData } from '@/app/AppDataContext';
import { generateTomorrowSummary } from '@/features/notifications/notificationService';
import { ROLES } from '@/config/roles';
import type { Notification, NotificationType } from '@/models/notification';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

const TYPE_ICONS: Partial<Record<NotificationType, { icon: LucideIcon; className?: string }>> = {
  new_request_pending: { icon: Inbox },
  leave_approved: { icon: CircleCheck, className: 'text-success' },
  leave_rejected: { icon: CircleX, className: 'text-destructive' },
  leave_overridden: { icon: ShieldAlert },
  daily_absence_summary: { icon: CalendarClock },
  staffing_warning: { icon: TriangleAlert, className: 'text-warning' },
  balance_adjusted: { icon: Scale },
  coffee_offer: { icon: Coffee },
  coffee_response: { icon: Coffee },
};

function iconFor(type: NotificationType) {
  return TYPE_ICONS[type] ?? { icon: Bell };
}

/** "Just now", "5 min ago", "3 hours ago", "Yesterday", "4 days ago", "Mar 5". */
function relativeTime(iso: string): string {
  const date = new Date(iso);
  const time = date.getTime();
  if (!time) return '';
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - time) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (dayDiff === 0) {
    const hours = Math.floor(diffMin / 60);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return `${dayDiff} days ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export default function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { user } = useAuth();
  const {
    getForUser, markAsRead, markAllAsRead,
    confirmNotification, rejectNotification, getUrgentRejections,
    refreshNotifications, pushEnabled,
  } = useNotifications();
  const { requests } = useLeave();
  const { users, staffingRules, roleAssignments, jobRoles, notificationSettings } = useAppData();
  const isDesktop = useIsDesktop(768);
  const [tab, setTab] = useState<'unread' | 'all'>('all');
  const [generating, setGenerating] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [sendingReject, setSendingReject] = useState(false);

  // Ask for notification permission when the panel opens.
  useEffect(() => {
    if (open && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [open]);

  if (!user) return null;

  const myNotifications = getForUser(user.id);
  const unread = myNotifications.filter((n) => !n.isRead);
  const isAdminOrManager = user.role === ROLES.SUPER_ADMIN || user.role === ROLES.MANAGER;
  const visible = tab === 'unread' ? unread : myNotifications;

  // Urgent rejections visible to managers/admin (from all staff)
  const urgentRejections = isAdminOrManager ? getUrgentRejections() : [];

  const handleGenerateSummary = async () => {
    setGenerating(true);
    const summary = generateTomorrowSummary(
      requests, users, staffingRules, roleAssignments, jobRoles,
    );
    const title1 = `Tomorrow: ${summary.staffOff.length} off, ${summary.onDuty} on duty`;
    let failed = false;
    try {
      await insertNotification({
        userId: user.id,
        type: 'daily_absence_summary',
        title: title1,
        body: summary.message,
        isRead: false,
        confirmStatus: 'pending',
        rejectReason: '',
        createdAt: new Date().toISOString(),
      });
      await sendPushToUser(user.id, title1, summary.message, 'summary');
    } catch (e) {
      console.error('Failed to create summary notification:', e);
      failed = true;
    }

    if (summary.shortages.length > 0) {
      const title2 = 'Staffing warning for tomorrow';
      const body2 = summary.shortages.map((s) => `${s.roleName}: ${s.scheduled}/${s.required}`).join(', ');
      try {
        await insertNotification({
          userId: user.id,
          type: 'staffing_warning',
          title: title2,
          body: body2,
          isRead: false,
          confirmStatus: 'pending',
          rejectReason: '',
          createdAt: new Date().toISOString(),
        });
        await sendPushToUser(user.id, title2, body2, 'staffing-warning');
      } catch (e) {
        console.error('Failed to create staffing warning notification:', e);
        failed = true;
      }
    }
    setGenerating(false);
    if (failed) toast.error("Couldn't create tomorrow's summary. Try again.");
    else toast.success("Tomorrow's summary created");
  };

  const handleConfirm = async (id: string) => {
    confirmNotification(id);
    // If it's a coffee offer, send acceptance back to sender
    const notif = myNotifications.find((n) => n.id === id);
    if (notif?.type === 'coffee_offer' && notif.entityId) {
      const title = `${user.displayName} accepted your coffee`;
      const body = `${user.displayName} says yes to coffee! Go grab one together.`;
      try {
        await insertNotification({
          userId: notif.entityId,
          type: 'coffee_response',
          title,
          body,
          isRead: false,
          confirmStatus: 'confirmed',
          rejectReason: '',
          entityType: 'coffee',
          entityId: user.id,
          createdAt: new Date().toISOString(),
        });
        await sendPushToUser(notif.entityId, title, body, 'coffee-accepted');
        toast.success('Coffee accepted');
      } catch (e) {
        console.error('Failed to send coffee acceptance:', e);
        toast.error("Couldn't let them know you accepted. Try again later.");
      }
    } else {
      toast.success('Shift confirmed');
    }
  };

  const cancelReject = () => {
    setRejectingId(null);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    const reason = rejectReason.trim();
    setSendingReject(true);
    rejectNotification(rejectingId, reason);
    const notif = myNotifications.find((n) => n.id === rejectingId);
    if (notif?.type === 'coffee_offer' && notif.entityId) {
      // Coffee rejection — send note back to sender only
      const title = `${user.displayName} passed on coffee`;
      const body = `${user.displayName}: "${reason}"`;
      try {
        await insertNotification({
          userId: notif.entityId,
          type: 'coffee_response',
          title,
          body,
          isRead: false,
          confirmStatus: 'rejected',
          rejectReason: reason,
          entityType: 'coffee',
          entityId: user.id,
          createdAt: new Date().toISOString(),
        });
        await sendPushToUser(notif.entityId, title, body, 'coffee-rejected');
        toast.success('Note sent');
      } catch (e) {
        console.error('Failed to send coffee rejection:', e);
        toast.error("Couldn't send your note. Try again later.");
      }
    } else {
      // Shift rejection — send urgent to all managers and super admins
      const managersAndAdmins = users.filter((u) =>
        (u.role === ROLES.MANAGER || u.role === ROLES.SUPER_ADMIN) && u.isActive,
      );
      const title = `Shift rejected by ${user.displayName}`;
      const body = `Reason: ${reason}${notif ? ` | Original: ${notif.title}` : ''}`;

      let failures = 0;
      for (const mgr of managersAndAdmins) {
        try {
          await insertNotification({
            userId: mgr.id,
            type: 'staffing_warning',
            title,
            body,
            isRead: false,
            confirmStatus: 'pending',
            rejectReason: reason,
            entityId: user.id,
            createdAt: new Date().toISOString(),
          });
          await sendPushToUser(mgr.id, title, body, 'shift-rejected');
        } catch (e) {
          console.error(`Failed to notify manager ${mgr.id} of shift rejection:`, e);
          failures += 1;
        }
      }
      if (failures > 0) toast.error(`Couldn't notify ${failures} of ${managersAndAdmins.length} managers. Tell them directly.`);
      else toast.success('Rejection sent to managers');
    }
    setSendingReject(false);
    cancelReject();
  };

  const renderRow = (notif: Notification) => {
    const isShiftNotif = notif.type === 'daily_absence_summary' && notif.body.includes('confirm or reject');
    const isCoffeeNotif = notif.type === 'coffee_offer';
    const canConfirmReject = (isShiftNotif || isCoffeeNotif) && notif.confirmStatus === 'pending';
    const isRejecting = rejectingId === notif.id;
    const { icon: Icon, className: iconClass } = iconFor(notif.type);

    return (
      <li
        key={notif.id}
        className={cn(
          'rounded-lg border transition-colors',
          notif.isRead ? 'border-transparent' : 'border-primary/15 bg-primary/5',
          notif.confirmStatus === 'confirmed' && 'border-success/30',
          notif.confirmStatus === 'rejected' && 'border-destructive/30',
        )}
      >
        <button
          type="button"
          onClick={() => { if (!notif.isRead) markAsRead(notif.id); }}
          className="flex w-full gap-3 rounded-lg p-3 text-left outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon className={cn('size-4', iconClass ?? 'text-muted-foreground')} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start gap-2">
              <span className={cn('flex-1 text-sm leading-snug', notif.isRead ? 'text-foreground/80' : 'font-medium text-foreground')}>
                {notif.title}
              </span>
              {notif.confirmStatus === 'confirmed' && (
                <Badge variant="outline" className="border-success/30 text-success">Confirmed</Badge>
              )}
              {notif.confirmStatus === 'rejected' && (
                <Badge variant="destructive">Rejected</Badge>
              )}
              {!notif.isRead && (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
              )}
            </span>
            {notif.body && (
              <span className="mt-0.5 block text-sm whitespace-pre-line text-muted-foreground">{notif.body}</span>
            )}
            {notif.confirmStatus === 'rejected' && notif.rejectReason && (
              <span className="mt-1 block text-sm text-destructive">Reason: {notif.rejectReason}</span>
            )}
            <time
              dateTime={notif.createdAt}
              title={new Date(notif.createdAt).toLocaleString('en-US')}
              className="mt-1 block text-xs text-muted-foreground"
            >
              {relativeTime(notif.createdAt)}
            </time>
          </span>
        </button>

        {canConfirmReject && !isRejecting && (
          <div className="flex gap-2 px-3 pb-3 pl-14">
            <Button size="lg" className="flex-1" onClick={() => handleConfirm(notif.id)}>
              {isCoffeeNotif ? 'Accept' : 'Confirm'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={() => { setRejectingId(notif.id); setRejectReason(''); }}
            >
              {isCoffeeNotif ? 'Not now' : 'Reject'}
            </Button>
          </div>
        )}

        {isRejecting && (
          <div className="space-y-2 px-3 pb-3 pl-14">
            <label htmlFor={`reject-${notif.id}`} className="text-sm font-medium">
              {isCoffeeNotif ? 'Leave a note' : 'Why can’t you work this shift?'}
            </label>
            <Textarea
              id={`reject-${notif.id}`}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={isCoffeeNotif ? 'Maybe next time because…' : 'Give a short reason'}
              rows={3}
              autoFocus
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {isCoffeeNotif
                ? 'Your note will be sent to them.'
                : 'This is sent as urgent to all managers and admins.'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="lg" className="flex-1" onClick={cancelReject} disabled={sendingReject}>
                Cancel
              </Button>
              <Button
                size="lg"
                variant={isCoffeeNotif ? 'default' : 'destructive'}
                className="flex-1"
                onClick={handleReject}
                disabled={!rejectReason.trim() || sendingReject}
              >
                {sendingReject && <Spinner />}
                {isCoffeeNotif ? 'Send note' : 'Send rejection'}
              </Button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) { cancelReject(); onClose(); } }}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className={cn(
          'gap-0 p-0',
          isDesktop ? 'w-full sm:max-w-md' : 'max-h-[85vh] rounded-t-2xl pb-safe',
        )}
      >
        <SheetHeader className="border-b pr-12">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle>Notifications</SheetTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => refreshNotifications()}
                aria-label="Refresh notifications"
              >
                <RefreshCw />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsRead(user.id)}
                disabled={unread.length === 0}
              >
                Mark all as read
              </Button>
            </div>
          </div>
          <SheetDescription>
            {unread.length > 0 ? `${unread.length} unread` : 'No unread notifications'}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {urgentRejections.length > 0 && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>
                {urgentRejections.length} shift {urgentRejections.length === 1 ? 'rejection' : 'rejections'}
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-1 space-y-1.5">
                  {urgentRejections.slice(0, 3).map((n) => (
                    <li key={n.id}>
                      <span className="block font-medium text-foreground">{n.title}</span>
                      <span className="block">{n.rejectReason || n.body}</span>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {isAdminOrManager && (
            <div className="space-y-1.5">
              <Button variant="outline" size="lg" className="w-full" onClick={handleGenerateSummary} disabled={generating}>
                {generating ? <Spinner /> : <CalendarClock />}
                Generate tomorrow’s summary
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Daily reminder at {notificationSettings.dailyReminderTime}
                {!notificationSettings.dailyReminderEnabled && ' (turned off)'}
              </p>
            </div>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'unread' | 'all')}>
            <TabsList className="w-full">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">
                Unread
                {unread.length > 0 && (
                  <Badge className="h-4 min-w-4 px-1 text-[10px] tabular-nums">{unread.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {visible.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="You're all caught up"
              description={tab === 'unread' && myNotifications.length > 0
                ? 'New notifications will show up here.'
                : 'Leave updates, shift summaries and reminders will show up here.'}
            />
          ) : (
            <ul className="space-y-1">{visible.map(renderRow)}</ul>
          )}

          {!pushEnabled && !('Notification' in window && Notification.permission === 'granted') && (
            <p className="text-center text-xs text-muted-foreground">
              Turn on push notifications in Settings to get alerts when the app is closed.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
