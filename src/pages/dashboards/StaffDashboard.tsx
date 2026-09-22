import { useState } from 'react';
import { Card, Button, Badge, Icons, StatBox, LeaveAllowanceCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLeave } from '../../context/LeaveContext';
import { useAppData } from '../../context/AppDataContext';
import { theme } from '../../config/theme';
import { ROLE_LABELS } from '../../config/roles';
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_COLORS, LEAVE_STATUS_LABELS } from '../../models/leave';

import { todayStr, formatDateLocal } from '../../utils/dateUtils';
import { getCurrentCycle, getWeekNumberInCycle } from '../../utils/cycleUtils';
import { safeSort } from '../../utils/safeData';
import RequestFormModal from '../RequestFormModal';
import RequestHistory from '../RequestHistory';
import SwapSection from '../SwapSection';
import CoffeeLeaderboard from '../admin/CoffeeLeaderboard';
import WorkingTodayModal from '../../components/WorkingTodayModal';
import CheckInButton from '../../components/CheckInButton';
import AttendanceSummary from '../../components/AttendanceSummary';

export default function StaffDashboard() {
  const { user } = useAuth();
  const { getBalance, getUserRequests, requests } = useLeave();
  const { users } = useAppData();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCoffee, setShowCoffee] = useState(false);
  const [showWorkingToday, setShowWorkingToday] = useState(false);
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);

  if (!user) return null;
  if (showCoffee) return <CoffeeLeaderboard onBack={() => setShowCoffee(false)} />;
  if (showHistory) return <RequestHistory onBack={() => setShowHistory(false)} />;
  if (showAttendance) return (
    <div className="space-y-3">
      <button onClick={() => setShowAttendance(false)} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
      <AttendanceSummary currentUserId={user.id} currentUserRole={user.role} currentUserJobRoles={user.jobRole ?? ['Office']} />
    </div>
  );

  const balance = getBalance(user.id);
  const currentCycle = getCurrentCycle();
  const currentWeek = currentCycle ? getWeekNumberInCycle(currentCycle) : null;
  const myRequests = getUserRequests(user.id);

  const regularBooked = currentCycle
    ? myRequests.filter((r) => r.leaveType === 'regular_day_off' && r.status === 'pending'
        && r.date >= currentCycle.start && r.date <= currentCycle.end).length
    : 0;
  const vacationBooked = myRequests.filter((r) => r.leaveType === 'paid_vacation' && r.status === 'pending').length;
  const regularRemainingAfterBooked = Math.max(0, balance.regularDaysAllowed - balance.regularDaysUsed - regularBooked);
  const vacationRemainingAfterBooked = Math.max(0, balance.vacationDaysTotal - balance.vacationDaysUsed - vacationBooked);
  const pendingCount = myRequests.filter((r) => r.status === 'pending').length;
  const recentRequests = safeSort(
    myRequests
      .filter((r) => r.leaveType !== 'auto_sunday'),
    'createdAt',
    true
  ).slice(0, 3);

  // Working today
  const activeStaff = users.filter((u) => u.isActive && u.role === 'staff');
  const today = todayStr();
  const offTodayIds = new Set(requests.filter((r) => r.date === today && r.status === 'approved').map((r) => r.userId));
  const workingToday = activeStaff.filter((u) => !offTodayIds.has(u.id));
  const offToday = activeStaff.filter((u) => offTodayIds.has(u.id));

  // Tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateLocal(tomorrow);
  const tomorrowLabel = tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const offTomorrowIds = new Set(requests.filter((r) => r.date === tomorrowStr && r.status === 'approved').map((r) => r.userId));
  const workingTomorrow = activeStaff.filter((u) => !offTomorrowIds.has(u.id));
  const offTomorrow = activeStaff.filter((u) => offTomorrowIds.has(u.id));

  return (
    <div className="space-y-4">
      {/* Check-In Button */}
      <CheckInButton userId={user.id} userName={user.displayName} userJobRoles={user.jobRole ?? ['Office']} userRole={user.role} />

      {/* Profile strip */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold"
            style={{ backgroundColor: theme.colors.primary, color: theme.colors.white }}>
            {user.displayName[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: theme.colors.white }}>{user.displayName}</p>
            <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>{ROLE_LABELS[user.role]} · Show Me Italy</p>
            <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>
              {pendingCount > 0 ? `${pendingCount} pending request${pendingCount > 1 ? 's' : ''}` : 'No pending requests'}
            </p>
          </div>
        </div>
      </Card>

      {/* Operational stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox label="Working Today" value={workingToday.length} color={theme.colors.primary} onClick={() => setShowWorkingToday(true)} />
        <StatBox label="See You Tomorrow" value={workingTomorrow.length} sub={tomorrowLabel} color={theme.colors.primaryLight} onClick={() => setShowTomorrow(true)} />
      </div>

      {/* Leave balances — two independent systems, each its own card */}
      <div className="space-y-3">
        <LeaveAllowanceCard
          title="Regular Days Off"
          subtitle={currentCycle && currentWeek ? `Week ${currentWeek} of ${currentCycle.weeks}` : undefined}
          segments={[
            { label: 'taken', value: balance.regularDaysUsed, color: theme.colors.secondary },
            { label: 'booked', value: regularBooked, color: theme.colors.warning },
            { label: 'remaining', value: regularRemainingAfterBooked, color: theme.colors.primary },
          ]}
          footnote={balance.autoSundayConsumed ? '● 1st Sunday auto-off used this cycle · resets each cycle' : 'Resets each cycle'}
          footnoteColor={balance.autoSundayConsumed ? theme.colors.secondary : undefined}
        />
        <LeaveAllowanceCard
          title="Vacation Balance"
          subtitle="never expires"
          segments={[
            { label: 'taken', value: balance.vacationDaysUsed, color: theme.colors.secondary },
            { label: 'booked', value: vacationBooked, color: theme.colors.warning },
            { label: 'remaining', value: vacationRemainingAfterBooked, color: theme.colors.primary },
          ]}
          footnote="Accrues monthly and rolls over — never resets"
        />
      </div>

      <SwapSection />

      <Button variant="primary" fullWidth icon={Icons.plus} onClick={() => setShowRequestForm(true)}>
        Request Time Off
      </Button>

      <Button variant="outline" fullWidth onClick={() => setShowAttendance(true)}>
        📊 My Attendance
      </Button>

      <Button variant="outline" fullWidth onClick={() => setShowCoffee(true)}>
        ☕ Coffee Leaderboard
      </Button>

      {/* Recent requests */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold" style={{ color: theme.colors.white }}>Recent Requests</h3>
        <button onClick={() => setShowHistory(true)} className="text-[10px] font-medium cursor-pointer" style={{ color: theme.colors.primary }}>
          View All →
        </button>
      </div>

      {recentRequests.length === 0 ? (
        <Card>
          <div className="h-16 flex items-center justify-center rounded-lg" style={{ border: `1px dashed ${theme.colors.border}` }}>
            <p className="text-xs" style={{ color: theme.colors.grayDark }}>No requests yet</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {recentRequests.map((req) => (
            <Card key={req.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium" style={{ color: theme.colors.white }}>
                    {new Date(req.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>{LEAVE_TYPE_LABELS[req.leaveType]}</p>
                </div>
                <Badge color={LEAVE_STATUS_COLORS[req.status] as 'warning' | 'success' | 'danger' | 'gray'} size="xs">
                  {LEAVE_STATUS_LABELS[req.status]}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <RequestFormModal open={showRequestForm} onClose={() => setShowRequestForm(false)} />

      <WorkingTodayModal
        open={showWorkingToday} onClose={() => setShowWorkingToday(false)}
        title={`Working Today (${workingToday.length})`}
        workingList={workingToday} offList={offToday} offLabel="Off Today"
        currentUserId={user.id} currentUserName={user.displayName}
      />

      <WorkingTodayModal
        open={showTomorrow} onClose={() => setShowTomorrow(false)}
        title={`See You Tomorrow — ${tomorrowLabel}`}
        workingList={workingTomorrow} offList={offTomorrow} offLabel="Off Tomorrow"
        currentUserId={user.id} currentUserName={user.displayName}
      />
    </div>
  );
}
