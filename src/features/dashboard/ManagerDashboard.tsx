import { TranslatedText } from '@/i18n/LanguageContext';
import { useState } from 'react';
import {
  ArrowLeft, BarChart3, CalendarCheck, ChevronRight, ClipboardCheck, Clock, Coffee, History, Inbox, MapPin, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { StatCard } from '@/components/shared/StatCard';
import { UserAvatar } from '@/components/shared/UserAvatar';
import LeaveAllowanceCard from '@/features/leave/components/LeaveAllowanceCard';
import { LeaveStatusBadge, formatShortDate, leaveTypeMeta } from '@/features/leave/leaveMeta';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { useAppData } from '@/app/AppDataContext';
import { insertNotification } from '@/services/firestore/core';
import { sendPushToUser } from '@/features/notifications/pushManager';
import { safeSort } from '@/utils/safeData';
import ManagerRequestQueue from '@/features/leave/pages/ManagerRequestQueue';
import RequestDetailModal from '@/features/leave/components/RequestDetailModal';
import RequestFormModal from '@/features/leave/components/RequestFormModal';
import RequestHistory from '@/features/leave/components/RequestHistory';
import CoffeeLeaderboard from '@/features/admin/pages/CoffeeLeaderboard';
import { formatDateLocal } from '@/utils/dateUtils';
import { getCurrentCycle, getWeekNumberInCycle } from '@/utils/cycleUtils';
import type { LeaveRequest } from '@/models/leave';
import WorkingTodayModal from '@/features/dashboard/components/WorkingTodayModal';
import CheckInButton from '@/features/attendance/components/CheckInButton';
import AttendanceSummary from '@/features/attendance/components/AttendanceSummary';
import TomorrowDutyModal from '@/features/dashboard/components/TomorrowDutyModal';
import CheckInBoard from '@/features/attendance/components/CheckInBoard';
import AttendanceMonitor from '@/features/attendance/components/AttendanceMonitor';
import ShiftStatusBoard from '@/features/attendance/components/ShiftStatusBoard';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { requests, getPendingRequests, getBalance, getUserRequests } = useLeave();
  const { users } = useAppData();
  const [view, setView] = useState<'dashboard' | 'queue' | 'myHistory' | 'attendance' | 'checkins' | 'shiftStatus'>('dashboard');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showCoffee, setShowCoffee] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showDutyModal, setShowDutyModal] = useState(false);

  if (!user) return null;
  const back = () => setView('dashboard');
  if (showCoffee) return <CoffeeLeaderboard onBack={() => setShowCoffee(false)} />;
  if (view === 'queue') return <ManagerRequestQueue onBack={back} />;
  if (view === 'myHistory') return <RequestHistory onBack={back} />;
  if (view === 'checkins') return <CheckInBoard onBack={back} currentUserRole={user?.role ?? 'staff'} />;
  if (view === 'shiftStatus') return <ShiftStatusBoard onBack={back} />;
  if (view === 'attendance') return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={back}>
        <ArrowLeft /><TranslatedText text="Back" /></Button>
      <AttendanceSummary currentUserId={user.id} currentUserRole={user?.role ?? 'staff'} currentUserJobRoles={user?.jobRole ?? ['Office']} />
    </div>
  );

  const activeStaff = users.filter((u) => u.isActive && u.role === 'staff');
  const pendingRequests = getPendingRequests().filter(
    (r) => (r.userRef?.role ?? 'staff') === 'staff' && r.userId !== user.id,
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateLocal(tomorrow);
  const tomorrowLabel = tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const approvedTomorrow = requests.filter((r) => r.date === tomorrowStr && r.status === 'approved');
  const offTomorrowIds = new Set(approvedTomorrow.map((r) => r.userId));
  const onDutyTomorrow = activeStaff.filter((u) => !offTomorrowIds.has(u.id));

  const todayDate = formatDateLocal(new Date());
  const offTodayIds = new Set(requests.filter((r) => r.date === todayDate && r.status === 'approved').map((r) => r.userId));
  const workingTodayList = activeStaff.filter((u) => !offTodayIds.has(u.id));
  const offTodayList = activeStaff.filter((u) => offTodayIds.has(u.id));

  const myBalance = getBalance(user.id);
  const myRequests = getUserRequests(user.id);
  const myPendingCount = myRequests.filter((r) => r.status === 'pending').length;
  const currentCycle = getCurrentCycle();
  const currentWeek = currentCycle ? getWeekNumberInCycle(currentCycle) : null;
  const regularBooked = currentCycle
    ? myRequests.filter((r) => r.leaveType === 'regular_day_off' && r.status === 'pending'
        && r.date >= currentCycle.start && r.date <= currentCycle.end).length
    : 0;
  const vacationBooked = myRequests.filter((r) => r.leaveType === 'paid_vacation' && r.status === 'pending').length;
  const regularRemainingAfterBooked = Math.max(0, myBalance.regularDaysAllowed - myBalance.regularDaysUsed - regularBooked);
  const vacationRemainingAfterBooked = Math.max(0, myBalance.vacationDaysTotal - myBalance.vacationDaysUsed - vacationBooked);

  const handleSendNotifications = (selectedIds: string[], shiftTimes: Record<string, { start: string; end: string }>) => {
    if (!user) return;
    for (const staffId of selectedIds) {
      const staff = activeStaff.find((u) => u.id === staffId);
      if (!staff) continue;
      const t = shiftTimes[staffId] ?? { start: '08:00', end: '17:00' };
      const title = `Tomorrow's Shift — ${tomorrowLabel}`;
      const body = `You are on duty, ${t.start} – ${t.end}. Please confirm or reject.`;

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

  const recentPending = safeSort(
    pendingRequests,
    'createdAt',
    true
  ).slice(0, 5);

  const pendingTotal = pendingRequests.length;

  const shortcuts = [
    { label: 'Shift responses', icon: ClipboardCheck, onClick: () => setView('shiftStatus') },
    { label: 'Check-in board', icon: MapPin, onClick: () => setView('checkins') },
    { label: 'Attendance', icon: BarChart3, onClick: () => setView('attendance') },
    { label: 'Coffee leaderboard', icon: Coffee, onClick: () => setShowCoffee(true) },
  ];

  return (
    <div className="space-y-6">
      <AttendanceMonitor userRole={user?.role ?? 'staff'} />
      <CheckInButton userId={user.id} userName={user.displayName} userJobRoles={user.jobRole ?? ['Office']} userRole={user.role} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Working today" value={workingTodayList.length} icon={CalendarCheck} onClick={() => setShowStaffModal(true)} />
        <StatCard label="See you tomorrow" value={onDutyTomorrow.length} hint={tomorrowLabel} icon={Clock} onClick={() => setShowDutyModal(true)} />
        <StatCard
          label="Staff requests"
          value={pendingTotal}
          hint="Waiting for you"
          icon={Inbox}
          tone={pendingTotal > 0 ? 'warning' : 'default'}
          onClick={() => setView('queue')}
        />
        <StatCard
          label="Your requests"
          value={myPendingCount}
          hint="Pending approval"
          icon={History}
          onClick={() => setView('myHistory')}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Needs your attention</CardTitle>
          <CardDescription>
            {pendingTotal === 0
              ? 'No staff requests are waiting. You’re all caught up.'
              : `${pendingTotal} staff ${pendingTotal === 1 ? 'request is' : 'requests are'} waiting for a decision.`}
          </CardDescription>
          <CardAction>
            <Button variant={pendingTotal > 0 ? 'default' : 'outline'} onClick={() => setView('queue')}>
              <Inbox />
              Review requests
            </Button>
          </CardAction>
        </CardHeader>
        {recentPending.length > 0 && (
          <CardContent>
            <ItemGroup className="gap-1">
              {recentPending.map((req) => (
                <Item key={req.id} asChild size="sm" className="px-2 hover:bg-muted">
                  <button type="button" onClick={() => setSelectedRequest(req)} className="text-left">
                    <ItemMedia>
                      <UserAvatar name={req.userRef.displayName} />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle>{req.userRef.displayName}</ItemTitle>
                      <ItemDescription>
                        {formatShortDate(req.date)} · {leaveTypeMeta(req.leaveType).label}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <LeaveStatusBadge status={req.status} />
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    </ItemActions>
                  </button>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        )}
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Your time off</h2>
            <p className="text-sm text-muted-foreground">Your requests are approved by a super admin.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="lg" className="h-10" onClick={() => setView('myHistory')}>
              <History />
              Your requests{myPendingCount > 0 && ` (${myPendingCount})`}
            </Button>
            <Button size="lg" className="h-10" onClick={() => setShowRequestForm(true)}>
              <Plus /><TranslatedText text="Request time off" /></Button>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <LeaveAllowanceCard
            title="Regular days off"
            subtitle={currentCycle && currentWeek ? `Week ${currentWeek} of ${currentCycle.weeks}` : undefined}
            segments={[
              { label: 'taken', value: myBalance.regularDaysUsed, tone: 'taken' },
              { label: 'booked', value: regularBooked, tone: 'booked' },
              { label: 'remaining', value: regularRemainingAfterBooked, tone: 'remaining' },
            ]}
            footnote="Resets each cycle"
          />
          <LeaveAllowanceCard
            title="Vacation"
            subtitle="Never expires"
            segments={[
              { label: 'taken', value: myBalance.vacationDaysUsed, tone: 'taken' },
              { label: 'booked', value: vacationBooked, tone: 'booked' },
              { label: 'remaining', value: vacationRemainingAfterBooked, tone: 'remaining' },
            ]}
            footnote="Builds up each month and rolls over."
          />
        </div>
      </section>

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

      <RequestDetailModal request={selectedRequest} open={!!selectedRequest} onClose={() => setSelectedRequest(null)} />
      <RequestFormModal open={showRequestForm} onClose={() => setShowRequestForm(false)} />

      <WorkingTodayModal
        open={showStaffModal} onClose={() => setShowStaffModal(false)}
        title={`Working today (${workingTodayList.length})`}
        workingList={workingTodayList} offList={offTodayList} offLabel="Off today"
        currentUserId={user.id} currentUserName={user.displayName}
      />

      <TomorrowDutyModal
        open={showDutyModal} onClose={() => setShowDutyModal(false)}
        tomorrowLabel={tomorrowLabel} activeStaff={activeStaff}
        offTomorrowIds={offTomorrowIds} approvedTomorrow={approvedTomorrow}
        currentUserJobRoles={user.jobRole ?? ['Office']} currentUserRole={user.role}
        onSendNotifications={handleSendNotifications}
      />
    </div>
  );
}
