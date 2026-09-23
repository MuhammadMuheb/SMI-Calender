import { useState } from 'react';
import { ArrowLeft, BarChart3, CalendarCheck, CalendarPlus, Clock, Coffee, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import LeaveAllowanceCard from '@/features/leave/components/LeaveAllowanceCard';
import { LeaveStatusBadge, LeaveTypeDot, formatShortDate, leaveTypeMeta } from '@/features/leave/leaveMeta';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { useAppData } from '@/app/AppDataContext';

import { todayStr, formatDateLocal } from '@/utils/dateUtils';
import { getCurrentCycle, getWeekNumberInCycle } from '@/utils/cycleUtils';
import { safeSort } from '@/utils/safeData';
import RequestFormModal from '@/features/leave/components/RequestFormModal';
import RequestHistory from '@/features/leave/components/RequestHistory';
import SwapSection from '@/features/swaps/SwapSection';
import CoffeeLeaderboard from '@/features/admin/pages/CoffeeLeaderboard';
import WorkingTodayModal from '@/features/dashboard/components/WorkingTodayModal';
import CheckInButton from '@/features/attendance/components/CheckInButton';
import AttendanceSummary from '@/features/attendance/components/AttendanceSummary';

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
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setShowAttendance(false)}>
        <ArrowLeft />
        Back
      </Button>
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

  const openRequestForm = () => setShowRequestForm(true);

  return (
    <div className="space-y-6">
      <CheckInButton userId={user.id} userName={user.displayName} userJobRoles={user.jobRole ?? ['Office']} userRole={user.role} />

      <Button size="lg" className="h-11 w-full sm:w-auto" onClick={openRequestForm}>
        <Plus />
        Request time off
      </Button>

      {/* Who's around */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Working today" value={workingToday.length} icon={CalendarCheck} onClick={() => setShowWorkingToday(true)} />
        <StatCard label="See you tomorrow" value={workingTomorrow.length} hint={tomorrowLabel} icon={Clock} onClick={() => setShowTomorrow(true)} />
      </div>

      {/* Leave balances: two independent systems, each its own card */}
      <div className="grid gap-3 lg:grid-cols-2">
        <LeaveAllowanceCard
          title="Regular days off"
          subtitle={currentCycle && currentWeek ? `Week ${currentWeek} of ${currentCycle.weeks}` : undefined}
          segments={[
            { label: 'taken', value: balance.regularDaysUsed, tone: 'taken' },
            { label: 'booked', value: regularBooked, tone: 'booked' },
            { label: 'remaining', value: regularRemainingAfterBooked, tone: 'remaining' },
          ]}
          footnote={balance.autoSundayConsumed
            ? 'Includes your automatic first-Sunday day off. Resets each cycle.'
            : 'Resets each cycle'}
          footnoteColor={balance.autoSundayConsumed ? 'emphasis' : undefined}
        />
        <LeaveAllowanceCard
          title="Vacation"
          subtitle="Never expires"
          segments={[
            { label: 'taken', value: balance.vacationDaysUsed, tone: 'taken' },
            { label: 'booked', value: vacationBooked, tone: 'booked' },
            { label: 'remaining', value: vacationRemainingAfterBooked, tone: 'remaining' },
          ]}
          footnote="Builds up each month and rolls over."
        />
      </div>

      {/* Recent requests */}
      <Card>
        <CardHeader>
          <CardTitle>Your requests</CardTitle>
          <CardDescription>
            {pendingCount > 0
              ? `${pendingCount} waiting for approval`
              : 'Nothing waiting for approval'}
          </CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
              View all
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="No requests yet"
              description="When you ask for time off, it shows up here with its status."
              action={
                <Button variant="outline" onClick={openRequestForm}>
                  <Plus />
                  Request time off
                </Button>
              }
            />
          ) : (
            <ItemGroup className="gap-0">
              {recentRequests.map((req) => (
                <Item key={req.id} size="sm" className="px-0">
                  <ItemContent>
                    <ItemTitle>{formatShortDate(req.date)}</ItemTitle>
                    <ItemDescription className="flex items-center gap-1.5">
                      <LeaveTypeDot type={req.leaveType} />
                      {leaveTypeMeta(req.leaveType).label}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <LeaveStatusBadge status={req.status} />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>

      <SwapSection />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="lg" className="h-10" onClick={() => setShowAttendance(true)}>
          <BarChart3 />
          My attendance
        </Button>
        <Button variant="outline" size="lg" className="h-10" onClick={() => setShowCoffee(true)}>
          <Coffee />
          Coffee leaderboard
        </Button>
      </div>

      <RequestFormModal open={showRequestForm} onClose={() => setShowRequestForm(false)} />

      <WorkingTodayModal
        open={showWorkingToday} onClose={() => setShowWorkingToday(false)}
        title={`Working today (${workingToday.length})`}
        workingList={workingToday} offList={offToday} offLabel="Off today"
        currentUserId={user.id} currentUserName={user.displayName}
      />

      <WorkingTodayModal
        open={showTomorrow} onClose={() => setShowTomorrow(false)}
        title={`See you tomorrow · ${tomorrowLabel}`}
        workingList={workingTomorrow} offList={offTomorrow} offLabel="Off tomorrow"
        currentUserId={user.id} currentUserName={user.displayName}
      />
    </div>
  );
}
