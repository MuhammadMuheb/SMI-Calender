import { useState } from 'react';
import { Button, Modal, Badge } from '../components/ui';
import { theme } from '../config/theme';
import { alpha } from '../utils/themeColor';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useLeave } from '../context/LeaveContext';
import { useAppData } from '../context/AppDataContext';
import { generateTomorrowSummary } from '../services/notificationService';
import { ROLES } from '../config/roles';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { user } = useAuth();
  const {
    getForUser, markAsRead, markAllAsRead, addNotification,
    confirmNotification, rejectNotification, getUrgentRejections,
    refreshNotifications,
  } = useNotifications();
  const { requests } = useLeave();
  const { users, staffingRules, roleAssignments, jobRoles, notificationSettings } = useAppData();
  const [showSummary, setShowSummary] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (!user) return null;

  const myNotifications = getForUser(user.id);
  const unread = myNotifications.filter((n) => !n.isRead);
  const isAdminOrManager = user.role === ROLES.SUPER_ADMIN || user.role === ROLES.MANAGER;

  // Urgent rejections visible to managers/admin (from all staff)
  const urgentRejections = isAdminOrManager ? getUrgentRejections() : [];

  const handleGenerateSummary = () => {
    const summary = generateTomorrowSummary(
      requests, users, staffingRules, roleAssignments, jobRoles,
    );
    addNotification(
      user.id, 'daily_absence_summary',
      `Tomorrow: ${summary.staffOff.length} off, ${summary.onDuty} on duty`,
      summary.message,
      undefined, undefined, user.id,
    );
    if (summary.shortages.length > 0) {
      addNotification(
        user.id, 'staffing_warning',
        'Staffing Warning — Tomorrow',
        `${summary.shortages.map((s) => `${s.roleName}: ${s.scheduled}/${s.required}`).join(', ')}`,
        undefined, undefined, user.id,
      );
    }
    setShowSummary(true);
    setTimeout(() => setShowSummary(false), 2000);
  };

  const handleConfirm = (id: string) => {
    confirmNotification(id);
    // If it's a coffee offer, send acceptance back to sender
    const notif = myNotifications.find((n) => n.id === id);
    if (notif?.type === 'coffee_offer' && notif.entityId) {
      addNotification(
        notif.entityId, // sender's userId
        'coffee_response',
        `☕ ${user.displayName} accepted your coffee!`,
        `${user.displayName} says yes to coffee! Go grab one together.`,
        'coffee', user.id, user.id,
      );
    }
  };

  const handleReject = () => {
    if (!rejectingId || !rejectReason.trim()) return;
    rejectNotification(rejectingId, rejectReason.trim());
    const notif = myNotifications.find((n) => n.id === rejectingId);
    if (notif?.type === 'coffee_offer' && notif.entityId) {
      // Coffee rejection — send note back to sender only
      addNotification(
        notif.entityId,
        'coffee_response',
        `☕ ${user.displayName} passed on coffee`,
        `${user.displayName}: "${rejectReason.trim()}"`,
        'coffee', user.id, user.id,
      );
    } else {
      // Shift rejection — send urgent to all managers and super admins
      const managersAndAdmins = users.filter((u) =>
        (u.role === ROLES.MANAGER || u.role === ROLES.SUPER_ADMIN) && u.isActive,
      );
      managersAndAdmins.forEach((mgr) => {
        addNotification(
          mgr.id, 'staffing_warning',
          `⚠️ Shift Rejected — ${user.displayName}`,
          `Reason: ${rejectReason.trim()}${notif ? ` | Original: ${notif.title}` : ''}`,
          undefined, undefined, user.id,
        );
      });
    }
    setRejectingId(null);
    setRejectReason('');
  };

  // Request notification permission on panel open
  if (open && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  return (
    <Modal open={open} onClose={onClose} title="Notifications">
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px]" style={{ color: theme.colors.grayDark }}>
          {unread.length} unread
        </span>
        <div className="flex gap-2">
          <button onClick={() => refreshNotifications()}
            className="text-[10px] cursor-pointer" style={{ color: theme.colors.grayDark }}>
            ↻ Refresh
          </button>
          {unread.length > 0 && (
            <button onClick={() => markAllAsRead(user.id)}
              className="text-[10px] cursor-pointer" style={{ color: theme.colors.primary }}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Urgent rejections alert (admin/manager) */}
      {urgentRejections.length > 0 && (
        <div className="mb-3 p-2.5 rounded-lg"
          style={{ backgroundColor: alpha(theme.colors.danger, '15'), border: `1px solid ${alpha(theme.colors.danger, '30')}` }}>
          <p className="text-[10px] uppercase tracking-wider mb-1.5 font-semibold"
            style={{ color: theme.colors.danger }}>
            ⚠️ {urgentRejections.length} Shift Rejection{urgentRejections.length > 1 ? 's' : ''}
          </p>
          {urgentRejections.slice(0, 3).map((n) => (
            <div key={n.id} className="mb-1">
              <p className="text-[10px] font-medium" style={{ color: theme.colors.white }}>{n.title}</p>
              <p className="text-[10px]" style={{ color: theme.colors.gray }}>
                {n.rejectReason || n.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Generate summary button (admin/manager only) */}
      {isAdminOrManager && (
        <div className="mb-3">
          <Button variant="outline" size="sm" fullWidth onClick={handleGenerateSummary}>
            {showSummary ? '✓ Summary Generated' : `Generate Tomorrow's Summary`}
          </Button>
          <p className="text-[10px] mt-1 text-center" style={{ color: theme.colors.grayDark }}>
            Reminder time: {notificationSettings.dailyReminderTime}
            {!notificationSettings.dailyReminderEnabled && ' (disabled)'}
          </p>
        </div>
      )}

      {/* Notification list */}
      {myNotifications.length === 0 ? (
        <div className="h-20 flex items-center justify-center rounded-lg"
          style={{ border: `1px dashed ${theme.colors.border}` }}>
          <p className="text-xs" style={{ color: theme.colors.grayDark }}>No notifications</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {myNotifications.map((notif) => {
            const isShiftNotif = notif.type === 'daily_absence_summary' && notif.body.includes('confirm or reject');
            const isCoffeeNotif = notif.type === 'coffee_offer';
            const canConfirmReject = (isShiftNotif || isCoffeeNotif) && notif.confirmStatus === 'pending';

            return (
              <div key={notif.id}>
                <button
                  onClick={() => markAsRead(notif.id)}
                  className="w-full text-left cursor-pointer"
                >
                  <div
                    className="px-3 py-2 rounded-lg transition-colors"
                    style={{
                      backgroundColor: notif.isRead ? theme.colors.bgCard : alpha(theme.colors.primary, '08'),
                      border: `1px solid ${
                        notif.confirmStatus === 'rejected' ? alpha(theme.colors.danger, '50') :
                        notif.confirmStatus === 'confirmed' ? alpha(theme.colors.success, '50') :
                        notif.isRead ? theme.colors.border : alpha(theme.colors.primary, '30')
                      }`,
                    }}
                  >
                    <div className="flex items-start justify-between mb-0.5">
                      <p className="text-xs font-medium" style={{ color: notif.isRead ? theme.colors.gray : theme.colors.white }}>
                        {notif.title}
                      </p>
                      <div className="flex items-center gap-1">
                        {notif.confirmStatus === 'confirmed' && (
                          <Badge color="success" size="xs">Confirmed</Badge>
                        )}
                        {notif.confirmStatus === 'rejected' && (
                          <Badge color="danger" size="xs">Rejected</Badge>
                        )}
                        {!notif.isRead && notif.confirmStatus === 'pending' && (
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: theme.colors.primary }} />
                        )}
                      </div>
                    </div>
                    <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>{notif.body}</p>
                    {notif.confirmStatus === 'rejected' && notif.rejectReason && (
                      <p className="text-[10px] mt-1" style={{ color: theme.colors.danger }}>
                        Reason: {notif.rejectReason}
                      </p>
                    )}
                    <p className="text-[9px] mt-1" style={{ color: theme.colors.grayDarker }}>
                      {new Date(notif.createdAt).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>

                    {/* Accept / Reject buttons — inside the card */}
                    {canConfirmReject && (
                      <div className="flex gap-2 mt-2 pt-2" style={{ borderTop: `1px solid ${theme.colors.border}` }}
                        onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => { e.stopPropagation(); handleConfirm(notif.id); }}
                          className="flex-1 py-2 rounded-lg text-[11px] font-bold cursor-pointer"
                          style={{ backgroundColor: theme.colors.primary, color: theme.colors.white }}>
                          {isCoffeeNotif ? '☕ Accept' : '✓ Confirm'}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setRejectingId(notif.id); setRejectReason(''); }}
                          className="flex-1 py-2 rounded-lg text-[11px] font-bold cursor-pointer"
                          style={{ backgroundColor: theme.colors.danger, color: theme.colors.white }}>
                          {isCoffeeNotif ? 'Not now' : '✕ Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject reason inline form */}
      {rejectingId && (
        <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.danger}30` }}>
          <p className="text-xs font-medium mb-2" style={{ color: theme.colors.danger }}>
            {rejectingId && myNotifications.find((n) => n.id === rejectingId)?.type === 'coffee_offer'
              ? '☕ Pass on Coffee — Leave a Note'
              : 'Reject Shift — Provide Reason'}
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={rejectingId && myNotifications.find((n) => n.id === rejectingId)?.type === 'coffee_offer' ? 'Maybe next time because...' : "Why can't you work this shift?"}
            rows={3}
            className="w-full rounded-lg text-xs outline-none px-3 py-2 mb-2 resize-none"
            style={{
              backgroundColor: theme.colors.bg,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.white,
            }}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setRejectingId(null); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={handleReject} disabled={!rejectReason.trim()}>
              Send Rejection
            </Button>
          </div>
          <p className="text-[9px] mt-1" style={{ color: theme.colors.grayDark }}>
            {rejectingId && myNotifications.find((n) => n.id === rejectingId)?.type === 'coffee_offer'
              ? 'Your note will be sent to them.'
              : 'This will be sent as urgent to all managers and admin.'}
          </p>
        </div>
      )}

      <p className="text-[10px] mt-3 text-center" style={{ color: theme.colors.grayDarker }}>
        {('Notification' in window && Notification.permission === 'granted')
          ? '🔔 Push notifications enabled · Auto-refreshes every 15s'
          : 'Tap the bell to enable push notifications · Auto-refreshes every 15s'}
      </p>
    </Modal>
  );
}
