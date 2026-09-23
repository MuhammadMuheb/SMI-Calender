import { TranslatedText } from '@/i18n/LanguageContext';
import { useState, useEffect, useMemo } from 'react';
import { CalendarOff, CalendarCheck, ChevronRight, Inbox, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useAppData } from '@/app/AppDataContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { ROLE_LABELS, type Role } from '@/config/roles';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { cn } from '@/lib/utils';
import { getCurrentCycle, getWeekNumberInCycle } from '@/utils/cycleUtils';
import { todayStr, formatDateLocal } from '@/utils/dateUtils';
import StaffLeaveDetailModal from '@/features/leave/components/StaffLeaveDetailModal';
import type { StaffUser } from '@/models/user';
import { fetchRecentCheckIns } from '@/features/attendance/services/checkInsService';

const ATTENDANCE_WINDOW_DAYS = 30;

/** Distinct check-in days per user over the trailing window, for a rough attendance rate. */
function useCheckInDayCounts(userIds: string[]) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const idsKey = userIds.join(',');

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) return;
    let cancelled = false;

    const loadCheckIns = async () => {
      try {
        const checkIns = await fetchRecentCheckIns(ATTENDANCE_WINDOW_DAYS);

        // Count distinct check-in days per user
        const result: Record<string, number> = {};
        for (const id of ids) result[id] = 0;

        const userCheckInDays = new Map<string, Set<string>>();
        for (const checkIn of checkIns) {
          if (!userCheckInDays.has(checkIn.userId)) {
            userCheckInDays.set(checkIn.userId, new Set());
          }
          // Extract date from checkInAt (YYYY-MM-DD from ISO string)
          const dateStr = checkIn.checkInAt.split('T')[0];
          userCheckInDays.get(checkIn.userId)!.add(dateStr);
        }

        for (const [userId, dates] of userCheckInDays) {
          result[userId] = dates.size;
        }

        if (!cancelled) setCounts(result);
      } catch (error) {
        console.error('Error loading check-ins:', error);
        const result: Record<string, number> = {};
        for (const id of ids) result[id] = 0;
        if (!cancelled) setCounts(result);
      }
    };

    loadCheckIns();
    return () => { cancelled = true; };
  }, [idsKey]);

  return counts;
}

type StatusFilter = 'all' | 'active' | 'on_leave';

interface StaffPageProps {
  /** Shows a back button in the header (used when opened from a dashboard). */
  onBack?: () => void;
}

export default function StaffPage({ onBack }: StaffPageProps = {}) {
  const { users, roleAssignments, jobRoles } = useAppData();
  const { requests, getCycleBalance, getUserRequests, getBalance } = useLeave();
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const selectedBalance = selectedStaff ? getBalance(selectedStaff.id) : null;

  const activeUsers = useMemo(() => users.filter((u) => u.isActive), [users]);
  const roleMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of jobRoles) map[r.id] = r.name;
    return map;
  }, [jobRoles]);

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
    return (activeUsers ?? []).map((u) => {
      if (!u || !u.id) return null;
      const bal = getCycleBalance(u.id) ?? { regularDaysAllowed: 0, regularDaysUsed: 0, vacationDaysAllowed: 0, vacationDaysUsed: 0, vacationDaysRemaining: 0 };
      const roles = (roleAssignments ?? []).filter((a) => a?.userId === u.id).map((a) => roleMap[a?.jobRoleId]).filter(Boolean);
      const pendingCount = (getUserRequests(u.id) ?? []).filter((r) => r?.status === 'pending').length;
      const onLeaveToday = approvedToday.has(u.id);

      const checkInDays = checkInDayCounts[u.id] ?? 0;
      const leaveDaysInWindow = (requests ?? []).filter((r) => {
        if (r?.userId !== u.id || r?.status !== 'approved') return false;
        const since = new Date(); since.setDate(since.getDate() - ATTENDANCE_WINDOW_DAYS);
        return r?.date >= formatDateLocal(since) && r?.date <= today;
      }).length;
      const expectedDays = Math.max(1, ATTENDANCE_WINDOW_DAYS - leaveDaysInWindow);
      const attendancePct = Math.min(100, Math.round((checkInDays / expectedDays) * 100));

      return { user: u, roles, bal, pendingCount, onLeaveToday, attendancePct };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  }, [activeUsers, roleAssignments, roleMap, getCycleBalance, getUserRequests, approvedToday, checkInDayCounts, requests, today]);

  const filteredRows = rows
    .filter((r) => (r.user.displayName ?? '').toLowerCase().includes(search.trim().toLowerCase()))
    .filter((r) => statusFilter === 'all' || (statusFilter === 'on_leave' ? r.onLeaveToday : !r.onLeaveToday));

  const workingTodayCount = activeUsers.length - approvedToday.size;
  const hasFilters = search.trim() !== '' || statusFilter !== 'all';

  const description = [
    `${activeUsers.length} active ${activeUsers.length === 1 ? 'member' : 'members'}`,
    currentCycle && currentWeek ? `cycle week ${currentWeek} of ${currentCycle.weeks}` : null,
  ].filter(Boolean).join(' · ');

  const view = filteredRows.map(({ user: u, roles, bal, pendingCount, onLeaveToday, attendancePct }) => {
    const displayName = u.displayName ?? u.username ?? 'Unknown';
    const role = (u.role ?? 'staff') as Role;
    const used = bal?.regularDaysUsed ?? 0;
    const allowed = bal?.regularDaysAllowed ?? 0;
    const regularPct = allowed > 0 ? Math.min(100, (used / allowed) * 100) : 0;
    return { u, displayName, role, roles, used, allowed, regularPct, pendingCount, onLeaveToday, attendancePct };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Team overview" description={description} onBack={onBack} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total staff" value={activeUsers.length} icon={Users} />
        <StatCard label="Working today" value={workingTodayCount} icon={CalendarCheck} tone="primary" />
        <StatCard label="Pending requests" value={pendingTotal} icon={Inbox} tone={pendingTotal > 0 ? 'warning' : 'default'} />
        <StatCard label="On leave this week" value={onLeaveThisWeekIds.size} icon={CalendarOff} hint="Next 7 days" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            aria-label="Search team"
            className="h-10 pl-8"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList className="h-10! w-full sm:w-auto">
            <TabsTrigger value="all">All · {rows.length}</TabsTrigger>
            <TabsTrigger value="active">Working · {rows.length - approvedToday.size}</TabsTrigger>
            <TabsTrigger value="on_leave">On leave · {approvedToday.size}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No one matches"
          description={hasFilters ? 'Try a different name or filter.' : 'There are no active team members yet.'}
          action={hasFilters ? (
            <Button variant="outline" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
              Clear filters
            </Button>
          ) : undefined}
        />
      ) : isDesktop ? (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4"><TranslatedText text="Name" /></TableHead>
                <TableHead><TranslatedText text="Status" /></TableHead>
                <TableHead>Days off used</TableHead>
                <TableHead className="text-right">Attendance</TableHead>
                <TableHead className="text-right"><TranslatedText text="Pending" /></TableHead>
                <TableHead className="w-10 pr-4"><span className="sr-only">Open</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.map((r) => (
                <TableRow
                  key={r.u.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${r.displayName}`}
                  onClick={() => setSelectedStaff(r.u)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedStaff(r.u); }
                  }}
                  className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={r.displayName} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.displayName}</span>
                          <Badge variant="outline">{ROLE_LABELS[r.role] ?? r.role}</Badge>
                        </div>
                        {r.roles.length > 0 && (
                          <p className="truncate text-xs text-muted-foreground">{r.roles.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><PresenceLabel onLeave={r.onLeaveToday} /></TableCell>
                  <TableCell>
                    <div className="flex w-40 items-center gap-2">
                      <Progress value={r.regularPct} aria-label="Days off used" className="flex-1" />
                      <span className="text-xs text-muted-foreground tabular-nums">{r.used}/{r.allowed}</span>
                    </div>
                  </TableCell>
                  <TableCell className={cn('text-right font-medium tabular-nums', r.attendancePct < 90 && 'text-warning')}>
                    {r.attendancePct}%
                  </TableCell>
                  <TableCell className="text-right">
                    {r.pendingCount > 0
                      ? <Badge variant="secondary" className="bg-warning/12 text-warning">{r.pendingCount}</Badge>
                      : <span className="text-muted-foreground">–</span>}
                  </TableCell>
                  <TableCell className="pr-4">
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <ItemGroup className="gap-2">
          {view.map((r) => (
            <Item key={r.u.id} asChild variant="outline" className="items-start bg-card hover:bg-accent/60">
              <button type="button" onClick={() => setSelectedStaff(r.u)} className="text-left">
                <ItemMedia>
                  <UserAvatar name={r.displayName} />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="flex-wrap">
                    {r.displayName}
                    <Badge variant="outline">{ROLE_LABELS[r.role] ?? r.role}</Badge>
                  </ItemTitle>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <PresenceLabel onLeave={r.onLeaveToday} />
                    {r.roles.length > 0 && <span className="truncate">{r.roles.join(', ')}</span>}
                  </div>
                  <div className="mt-1 flex max-w-56 items-center gap-2">
                    <Progress value={r.regularPct} aria-label="Days off used" className="flex-1" />
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {r.used}/{r.allowed} days off
                    </span>
                  </div>
                </ItemContent>
                <ItemActions className="flex-col items-end gap-1 self-center">
                  <span className={cn('text-sm font-semibold tabular-nums', r.attendancePct < 90 && 'text-warning')}>
                    {r.attendancePct}%
                  </span>
                  <span className="text-xs text-muted-foreground">attendance</span>
                  {r.pendingCount > 0 && (
                    <Badge variant="secondary" className="bg-warning/12 text-warning">{r.pendingCount} pending</Badge>
                  )}
                </ItemActions>
              </button>
            </Item>
          ))}
        </ItemGroup>
      )}

      <StaffLeaveDetailModal
        open={selectedStaff !== null}
        onClose={() => setSelectedStaff(null)}
        staff={selectedStaff}
        balance={selectedBalance}
      />
    </div>
  );
}

function PresenceLabel({ onLeave }: { onLeave: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', onLeave ? 'text-warning' : 'text-success')}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', onLeave ? 'bg-warning' : 'bg-success')} />
      {onLeave ? 'On leave today' : 'Working today'}
    </span>
  );
}
