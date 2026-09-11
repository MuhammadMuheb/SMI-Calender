import { useState, useEffect, useMemo } from 'react';
import { Card, Badge } from '../components/ui';
import { theme } from '../config/theme';
import { alpha } from '../utils/themeColor';
import { useAppData } from '../context/AppDataContext';
import { useLeave } from '../context/LeaveContext';
import { ROLE_LABELS, ROLE_BADGE_COLOR } from '../config/roles';
import { getCurrentCycle, getWeekNumberInCycle } from '../utils/cycleUtils';
import { todayStr, formatDateLocal } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';

const ATTENDANCE_WINDOW_DAYS = 30;

/** Distinct check-in days per user over the trailing window, for a rough attendance rate. */
function useCheckInDayCounts(userIds: string[]) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (userIds.length === 0) return;
    let cancelled = false;
    const since = new Date();
    since.setDate(since.getDate() - ATTENDANCE_WINDOW_DAYS);

    supabase
      .from('check_ins')
      .select('user_id, check_in_at')
      .in('user_id', userIds)
      .gte('check_in_at', since.toISOString())
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const daysByUser: Record<string, Set<string>> = {};
        for (const row of data as { user_id: string; check_in_at: string }[]) {
          const day = row.check_in_at.slice(0, 10);
          (daysByUser[row.user_id] ??= new Set()).add(day);
        }
        const result: Record<string, number> = {};
        for (const id of userIds) result[id] = daysByUser[id]?.size ?? 0;
        setCounts(result);
      });

    return () => { cancelled = true; };
  }, [userIds.join(',')]);

  return counts;
}

type StatusFilter = 'all' | 'active' | 'on_leave';

export default function StaffPage() {
  const { users, roleAssignments, jobRoles } = useAppData();
  const { requests, getBalance, getUserRequests } = useLeave();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const activeUsers = useMemo(() => users.filter((u) => u.isActive), [users]);
  const roleMap: Record<string, string> = {};
  for (const r of jobRoles) roleMap[r.id] = r.name;

  const checkInDayCounts = useCheckInDayCounts(useMemo(() => activeUsers.map((u) => u.id), [activeUsers]));

  const currentCycle = getCurrentCycle();
  const currentWeek = currentCycle ? getWeekNumberInCycle(currentCycle) : null;

  const today = todayStr();
  const weekEnd = (() => { const d = new Date(); d.setDate(d.getDate() + 6); return formatDateLocal(d); })();

  const approvedToday = useMemo(
    () => new Set(requests.filter((r) => r.date === today && r.status === 'approved').map((r) => r.userId)),
    [requests, today],
  );
  const approvedThisWeek = useMemo(
    () => requests.filter((r) => r.status === 'approved' && r.date >= today && r.date <= weekEnd),
    [requests, today, weekEnd],
  );
  const onLeaveThisWeekIds = new Set(approvedThisWeek.map((r) => r.userId));

  const pendingTotal = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);

  const rows = useMemo(() => {
    return activeUsers.map((u) => {
      const bal = getBalance(u.id);
      const roles = roleAssignments.filter((a) => a.userId === u.id).map((a) => roleMap[a.jobRoleId]).filter(Boolean);
      const pendingCount = getUserRequests(u.id).filter((r) => r.status === 'pending').length;
      const onLeaveToday = approvedToday.has(u.id);

      const checkInDays = checkInDayCounts[u.id] ?? 0;
      const leaveDaysInWindow = requests.filter((r) => {
        if (r.userId !== u.id || r.status !== 'approved') return false;
        const since = new Date(); since.setDate(since.getDate() - ATTENDANCE_WINDOW_DAYS);
        return r.date >= formatDateLocal(since) && r.date <= today;
      }).length;
      const expectedDays = Math.max(1, ATTENDANCE_WINDOW_DAYS - leaveDaysInWindow);
      const attendancePct = Math.min(100, Math.round((checkInDays / expectedDays) * 100));

      return { user: u, roles, bal, pendingCount, onLeaveToday, attendancePct };
    });
  }, [activeUsers, roleAssignments, roleMap, getBalance, getUserRequests, approvedToday, checkInDayCounts, requests, today]);

  const filteredRows = rows
    .filter((r) => r.user.displayName.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((r) => statusFilter === 'all' || (statusFilter === 'on_leave' ? r.onLeaveToday : !r.onLeaveToday));

  const workingTodayCount = activeUsers.length - approvedToday.size;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Team Overview</h2>
        <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>
          {activeUsers.length} active members
          {currentCycle && currentWeek && ` · cycle week ${currentWeek} of ${currentCycle.weeks}`}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatTile label="Total Staff" value={activeUsers.length} color={theme.colors.white} />
        <StatTile label="Working Today" value={workingTodayCount} color={theme.colors.primary} />
        <StatTile label="Pending Requests" value={pendingTotal} color={theme.colors.warning} />
        <StatTile label="On Leave This Week" value={onLeaveThisWeekIds.size} color={theme.colors.secondary} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team..."
          className="flex-1 rounded-lg text-xs px-3 py-2"
          style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}`, color: theme.colors.white }}
        />
        <div className="flex rounded-lg p-1" style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}>
          {([
            { id: 'all', label: `All · ${rows.length}` },
            { id: 'active', label: `Active · ${rows.length - approvedToday.size}` },
            { id: 'on_leave', label: `On Leave · ${approvedToday.size}` },
          ] as { id: StatusFilter; label: string }[]).map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className="flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-[10px] font-medium whitespace-nowrap cursor-pointer transition-all"
              style={{
                backgroundColor: statusFilter === f.id ? theme.colors.primary : 'transparent',
                color: statusFilter === f.id ? theme.colors.white : theme.colors.grayDark,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filteredRows.length === 0 && (
          <Card><p className="text-xs text-center py-4" style={{ color: theme.colors.grayDark }}>No matching team members</p></Card>
        )}
        {filteredRows.map(({ user: u, roles, bal, pendingCount, onLeaveToday, attendancePct }) => {
          const regularPct = bal.regularDaysAllowed > 0 ? Math.min(100, (bal.regularDaysUsed / bal.regularDaysAllowed) * 100) : 0;
          return (
            <Card key={u.id}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: alpha(theme.colors.primary, '20'), color: theme.colors.primaryLight }}>
                  {u.displayName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>{u.displayName}</p>
                    <Badge color={ROLE_BADGE_COLOR[u.role]} size="xs">{ROLE_LABELS[u.role]}</Badge>
                    <span className="flex items-center gap-1 text-[9px]" style={{ color: onLeaveToday ? theme.colors.warning : theme.colors.primary }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: onLeaveToday ? theme.colors.warning : theme.colors.primary }} />
                      {onLeaveToday ? 'On Leave' : 'Active'}
                    </span>
                  </div>
                  {roles.length > 0 && (
                    <p className="text-[9px] mt-0.5" style={{ color: theme.colors.grayDark }}>{roles.join(', ')}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-1.5 max-w-[180px]">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: theme.colors.secondary }}>
                      <div className="h-full rounded-full ml-auto" style={{ width: `${100 - regularPct}%`, backgroundColor: theme.colors.primary }} />
                    </div>
                    <span className="text-[8px] flex-shrink-0" style={{ color: theme.colors.grayDark }}>
                      {bal.regularDaysUsed}/{bal.regularDaysAllowed} days off
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 flex-shrink-0 items-center">
                  <div className="text-center">
                    <p className="text-sm font-bold" style={{ color: theme.colors.warning }}>{bal.vacationDaysRemaining}</p>
                    <p className="text-[8px]" style={{ color: theme.colors.grayDark }}>vacation</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold" style={{ color: attendancePct < 90 ? theme.colors.warning : theme.colors.primary }}>{attendancePct}%</p>
                    <p className="text-[8px]" style={{ color: theme.colors.grayDark }}>attendance</p>
                  </div>
                  {pendingCount > 0 && <Badge color="warning" size="xs">{pendingCount} pending</Badge>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}>
      <p className="text-[9px] uppercase tracking-wider" style={{ color: theme.colors.grayDark }}>{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  );
}
