import { TranslatedText } from '@/i18n/LanguageContext';
import { useState } from 'react';
import { ArrowLeft, BarChart3, CalendarCheck, ClipboardCheck, Clock, Inbox, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { StatCard } from '@/components/shared/StatCard';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useLeave } from '@/features/leave/LeaveContext';
import { useAppData } from '@/app/AppDataContext';
import { insertNotification } from '@/services/firestore/core';
import { sendPushToUser } from '@/features/notifications/pushManager';
import { useAuth } from '@/features/auth/AuthContext';
import { todayStr, formatDateLocal } from '@/utils/dateUtils';
import ManagerRequestQueue from '@/features/leave/pages/ManagerRequestQueue';
import AdminPanel from '@/features/admin/pages/AdminPanel';
import WorkingTodayModal, { JobRoleBadge } from '@/features/dashboard/components/WorkingTodayModal';
import CheckInButton from '@/features/attendance/components/CheckInButton';
import AttendanceSummary from '@/features/attendance/components/AttendanceSummary';
import TomorrowDutyModal from '@/features/dashboard/components/TomorrowDutyModal';
import CheckInBoard from '@/features/attendance/components/CheckInBoard';
import AttendanceMonitor from '@/features/attendance/components/AttendanceMonitor';
import ShiftStatusBoard from '@/features/attendance/components/ShiftStatusBoard';

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const { requests, getPendingRequests } = useLeave();
  const { users, jobRoles, roleAssignments } = useAppData();
  const [view, setView] = useState<'dashboard' | 'queue' | 'admin' | 'attendance' | 'checkins' | 'shiftStatus'>('dashboard');

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [showWorkingTodayModal, setShowWorkingTodayModal] = useState(false);

  const back = () => setView('dashboard');
  if (view === 'queue') return <ManagerRequestQueue onBack={back} />;
  if (view === 'admin') return <AdminPanel onBack={back} />;
  if (view === 'checkins') return <CheckInBoard onBack={back} currentUserRole={user?.role ?? 'super_admin'} />;
  if (view === 'shiftStatus') return <ShiftStatusBoard onBack={back} />;
  if (view === 'attendance') return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={back}>
        <ArrowLeft /><TranslatedText text="Back" /></Button>
      <AttendanceSummary currentUserId={user?.id ?? ''} currentUserRole={user?.role ?? 'super_admin'} currentUserJobRoles={user?.jobRole ?? ['Office']} />
    </div>
  );

  const activeStaff = users.filter((u) => u.isActive && u.role === 'staff');
  const totalStaff = activeStaff.length;
  const pendingCount = getPendingRequests().length;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateLocal(tomorrow);
  const tomorrowLabel = tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const approvedTomorrow = requests.filter((r) => r.date === tomorrowStr && r.status === 'approved');
  const offTomorrowIds = new Set(approvedTomorrow.map((r) => r.userId));
  const onDutyTomorrow = activeStaff.filter((u) => !offTomorrowIds.has(u.id));

  const today = todayStr();

  const getUserRoles = (userId: string) => {
    const assigns = roleAssignments.filter((a) => a.userId === userId);
    return assigns.map((a) => {
      const role = jobRoles.find((r) => r.id === a.jobRoleId);
      return role ? { name: role.name, color: role.color, shiftStart: role.shiftStartTime, shiftEnd: role.shiftEndTime, isPrimary: a.isPrimary } : null;
    }).filter(Boolean) as { name: string; color: string; shiftStart: string; shiftEnd: string; isPrimary: boolean }[];
  };

  const handleSendNotifications = (selectedIds: string[], shiftTimes: Record<string, { start: string; end: string }>) => {
    if (!user) return;
    for (const staffId of selectedIds) {
      const staff = activeStaff.find((u) => u.id === staffId);
      if (!staff) continue;
      const t = shiftTimes[staffId] ?? { start: '08:00', end: '17:00' };
      const roles = getUserRoles(staff.id);
      const roleLabel = roles.map((r) => r.name).join(', ') || 'Staff';
      const title = `Tomorrow's Shift — ${tomorrowLabel}`;
      const body = `You are on duty as ${roleLabel}, ${t.start} – ${t.end}. Please confirm or reject.`;

      // Save to Firestore and send push notification
      insertNotification({
        userId: staff.id,
        type: 'daily_absence_summary',
        title,
        body,
        isRead: false,
        confirmStatus: 'pending',
        rejectReason: '',
        createdAt: new Date().toISOString(),
      }).catch((err) => console.error('Failed to send shift notification:', err));

      sendPushToUser(staff.id, title, body, 'shift-assignment').catch(() => {});
    }
  };

  const offTodayIds = new Set(requests.filter((r) => r.date === today && r.status === 'approved').map((r) => r.userId));
  const workingTodayList = activeStaff.filter((u) => !offTodayIds.has(u.id));
  const offTodayList = activeStaff.filter((u) => offTodayIds.has(u.id));

  const shortcuts = [
    { label: 'Shift responses', icon: ClipboardCheck, onClick: () => setView('shiftStatus') },
    { label: 'Check-in board', icon: MapPin, onClick: () => setView('checkins') },
    { label: 'Attendance', icon: BarChart3, onClick: () => setView('attendance') },
  ];

  return (
    <div className="space-y-6">
      <AttendanceMonitor userRole={user?.role ?? 'staff'} />
      <CheckInButton userId={user?.id ?? ''} userName={user?.displayName ?? ''} userJobRoles={user?.jobRole ?? ['Office']} userRole={user?.role ?? 'super_admin'} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Working today" value={workingTodayList.length} icon={CalendarCheck} onClick={() => setShowWorkingTodayModal(true)} />
        <StatCard label="See you tomorrow" value={onDutyTomorrow.length} hint={tomorrowLabel} icon={Clock} onClick={() => setShowDutyModal(true)} />
        <StatCard
          label="Pending requests"
          value={pendingCount}
          icon={Inbox}
          tone={pendingCount > 0 ? 'warning' : 'default'}
          onClick={() => setView('queue')}
        />
        <StatCard label="Total staff" value={totalStaff} icon={Users} onClick={() => setShowStaffModal(true)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Needs your attention</CardTitle>
          <CardDescription>
            {pendingCount === 0
              ? 'No requests are waiting. You’re all caught up.'
              : `${pendingCount} time-off ${pendingCount === 1 ? 'request is' : 'requests are'} waiting for a decision.`}
          </CardDescription>
          <CardAction>
            <Button variant={pendingCount > 0 ? 'default' : 'outline'} onClick={() => setView('queue')}>
              <Inbox />
              Review requests
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Team tools</h2>
        <div className="flex flex-wrap gap-2">
          {shortcuts.map((s) => (
            <Button key={s.label} variant="outline" size="lg" className="h-10" onClick={s.onClick}>
              <s.icon />
              {s.label}
            </Button>
          ))}
        </div>
      </section>

      <ResponsiveDialog
        open={showStaffModal}
        onOpenChange={setShowStaffModal}
        title="All staff"
        description={`${totalStaff} active ${totalStaff === 1 ? 'person' : 'people'}`}
      >
        <ItemGroup className="gap-1">
          {activeStaff.map((staff) => {
            const roles = getUserRoles(staff.id);
            return (
              <Item key={staff.id} size="sm" className="px-2">
                <ItemMedia>
                  <UserAvatar name={staff.displayName} />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{staff.displayName}</ItemTitle>
                  {roles.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {roles.map((r, ri) => (
                        <JobRoleBadge key={ri} name={r.name} color={r.color} isPrimary={r.isPrimary} />
                      ))}
                    </div>
                  )}
                </ItemContent>
              </Item>
            );
          })}
        </ItemGroup>
      </ResponsiveDialog>

      <TomorrowDutyModal
        open={showDutyModal} onClose={() => setShowDutyModal(false)}
        tomorrowLabel={tomorrowLabel} activeStaff={activeStaff}
        offTomorrowIds={offTomorrowIds} approvedTomorrow={approvedTomorrow}
        currentUserJobRoles={user?.jobRole ?? ['Office']} currentUserRole={user?.role ?? 'super_admin'}
        onSendNotifications={handleSendNotifications}
      />

      <WorkingTodayModal
        open={showWorkingTodayModal} onClose={() => setShowWorkingTodayModal(false)}
        title={`Working today (${workingTodayList.length})`}
        workingList={workingTodayList} offList={offTodayList} offLabel="Off today"
        currentUserId={user?.id ?? ''} currentUserName={user?.displayName ?? ''}
        getUserRoles={getUserRoles}
      />
    </div>
  );
}
