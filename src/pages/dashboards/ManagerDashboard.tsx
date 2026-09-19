import { useState } from 'react';
import { Card, Badge, Button, Icons, StatBox, LeaveAllowanceCard } from '../../components/ui';
import { theme } from '../../config/theme';
import { alpha } from '../../utils/themeColor';
import { useAuth } from '../../context/AuthContext';
import { useLeave } from '../../context/LeaveContext';
import { useAppData } from '../../context/AppDataContext';
import { useNotifications } from '../../context/NotificationContext';
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS } from '../../models/leave';
import ManagerRequestQueue from '../ManagerRequestQueue';
import RequestDetailModal from '../RequestDetailModal';
import RequestFormModal from '../RequestFormModal';
import RequestHistory from '../RequestHistory';
import CoffeeLeaderboard from '../admin/CoffeeLeaderboard';
import { formatDateLocal } from '../../utils/dateUtils';
import { getCurrentCycle, getWeekNumberInCycle } from '../../utils/cycleUtils';
import type { LeaveRequest } from '../../models/leave';
import WorkingTodayModal from '../../components/WorkingTodayModal';
import CheckInButton from '../../components/CheckInButton';
import AttendanceSummary from '../../components/AttendanceSummary';
import TomorrowDutyModal from '../../components/TomorrowDutyModal';
import CheckInBoard from '../../components/CheckInBoard';
import AttendanceMonitor from '../../components/AttendanceMonitor';
import ShiftStatusBoard from '../../components/ShiftStatusBoard';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { requests, getPendingRequests, getBalance, getUserRequests } = useLeave();
  const { users } = useAppData();
  const { addNotification } = useNotifications();
  const [view, setView] = useState<'dashboard' | 'queue' | 'myHistory' | 'attendance' | 'checkins' | 'shiftStatus'>('dashboard');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showCoffee, setShowCoffee] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showDutyModal, setShowDutyModal] = useState(false);

  if (!user) return null;
  if (showCoffee) return <CoffeeLeaderboard onBack={() => setShowCoffee(false)} />;
  if (view === 'queue') return <ManagerRequestQueue onBack={() => setView('dashboard')} />;
  if (view === 'myHistory') return <RequestHistory onBack={() => setView('dashboard')} />;
  if (view === 'checkins') return <CheckInBoard onBack={() => setView('dashboard')} currentUserRole={user?.role ?? 'staff'} />;
  if (view === 'shiftStatus') return <ShiftStatusBoard onBack={() => setView('dashboard')} />;
  if (view === 'attendance') return (
    <div className="space-y-3">
      <button onClick={() => setView('dashboard')} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
      <AttendanceSummary currentUserId={user.id} currentUserRole={user?.role ?? 'staff'} currentUserJobRoles={user?.jobRole ?? ['Office']} />
    </div>
  );

  const activeStaff = users.filter((u) => u.isActive);
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
      addNotification(
        staff.id, 'daily_absence_summary',
        `Tomorrow's Shift — ${tomorrowLabel}`,
        `You are on duty, ${t.start} – ${t.end}. Please confirm or reject.`,
      );
    }
  };

  const recentPending = pendingRequests
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <AttendanceMonitor userRole={user?.role ?? 'staff'} />
      <CheckInButton userId={user.id} userName={user.displayName} userJobRoles={user.jobRole ?? ['Office']} userRole={user.role} />

      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: theme.colors.primary, color: theme.colors.white }}>
          {user.displayName[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>{user.displayName}</p>
          <div className="flex items-center gap-1.5">
            <Badge color="primary" size="xs">MANAGER</Badge>
            <span className="text-[9px]" style={{ color: theme.colors.grayDark }}>Show Me Italy</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatBox label="Working Today" value={workingTodayList.length} color={theme.colors.white} onClick={() => setShowStaffModal(true)} />
        <StatBox label="See You Tomorrow" value={onDutyTomorrow.length} sub={tomorrowLabel} color={theme.colors.primaryLight} onClick={() => setShowDutyModal(true)} />
      </div>

      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        <LeaveAllowanceCard
          title="Regular Days Off"
          subtitle={currentCycle && currentWeek ? `Week ${currentWeek} of ${currentCycle.weeks}` : undefined}
          segments={[
            { label: 'taken', value: myBalance.regularDaysUsed, color: theme.colors.secondary },
            { label: 'booked', value: regularBooked, color: theme.colors.warning },
            { label: 'remaining', value: regularRemainingAfterBooked, color: theme.colors.primary },
          ]}
          footnote="Resets each cycle"
        />
        <LeaveAllowanceCard
          title="Vacation Balance"
          subtitle="never expires"
          segments={[
            { label: 'taken', value: myBalance.vacationDaysUsed, color: theme.colors.secondary },
            { label: 'booked', value: vacationBooked, color: theme.colors.warning },
            { label: 'remaining', value: vacationRemainingAfterBooked, color: theme.colors.primary },
          ]}
          footnote="Accrues monthly and rolls over — never resets"
        />
      </div>

      <Card>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" icon={Icons.plus} onClick={() => setShowRequestForm(true)}>
            Request Day Off
          </Button>
          <Button variant="outline" size="sm" onClick={() => setView('myHistory')}>
            My Requests {myPendingCount > 0 && `(${myPendingCount})`}
          </Button>
        </div>
        <p className="text-[10px] mt-2" style={{ color: theme.colors.grayDark }}>
          Your requests require super admin approval.
        </p>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold" style={{ color: theme.colors.white }}>Staff Requests</h3>
          {pendingRequests.length > 0 && <Badge color="warning" size="xs">{pendingRequests.length}</Badge>}
        </div>
        <button onClick={() => setView('queue')} className="text-[10px] font-medium cursor-pointer" style={{ color: theme.colors.primary }}>
          View All →
        </button>
      </div>

      {recentPending.length === 0 ? (
        <Card>
          <div className="h-16 flex items-center justify-center rounded-lg" style={{ border: `1px dashed ${theme.colors.border}` }}>
            <p className="text-xs" style={{ color: theme.colors.grayDark }}>No pending requests</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {recentPending.map((req) => (
            <button key={req.id} onClick={() => setSelectedRequest(req)} className="w-full text-left cursor-pointer">
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: alpha(theme.colors.primary, '20'), color: theme.colors.primaryLight }}>
                      {req.userRef.displayName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: theme.colors.white }}>{req.userRef.displayName}</p>
                      <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
                        {new Date(req.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}{LEAVE_TYPE_LABELS[req.leaveType]}
                      </p>
                    </div>
                  </div>
                  <Badge color="warning" size="xs">{LEAVE_STATUS_LABELS[req.status]}</Badge>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Button variant="outline" fullWidth onClick={() => setView('shiftStatus')}>
        📋 Shift Responses
      </Button>

      <Button variant="outline" fullWidth onClick={() => setView('checkins')}>
        📍 Check-In Board
      </Button>

      <Button variant="outline" fullWidth onClick={() => setView('attendance')}>
        📊 Attendance Summary
      </Button>

      <Button variant="outline" fullWidth onClick={() => setShowCoffee(true)}>
        ☕ Coffee Leaderboard
      </Button>

      <RequestDetailModal request={selectedRequest} open={!!selectedRequest} onClose={() => setSelectedRequest(null)} />
      <RequestFormModal open={showRequestForm} onClose={() => setShowRequestForm(false)} />

      <WorkingTodayModal
        open={showStaffModal} onClose={() => setShowStaffModal(false)}
        title={`Working Today (${workingTodayList.length})`}
        workingList={workingTodayList} offList={offTodayList} offLabel="Off Today"
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
