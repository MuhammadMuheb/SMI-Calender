import { useState, useMemo, useEffect, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarCheck, ChevronLeft, ChevronRight, CircleAlert, Flag, MapPin, Plus, Star, TriangleAlert,
} from 'lucide-react';
import { ROLES } from '@/config/roles';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { useAppData } from '@/app/AppDataContext';
import { useCalendarData } from '@/features/calendar/hooks/useCalendarData';
import { checkStaffingForDate } from '@/services/staffingService';
import CalendarTile, { type CalendarTileLeave } from '@/features/calendar/components/CalendarTile';
import DayDetailModal from '@/features/calendar/components/DayDetailModal';
import RequestFormModal from '@/features/leave/components/RequestFormModal';
import { LEAVE_TYPE_META, LeaveTypeBadge, leaveTypeMeta } from '@/features/leave/leaveMeta';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import type { DaySummary } from '@/models/calendar';
import type { LeaveRequest, LeaveType } from '@/models/leave';
import type { Schedule } from '@/models/schedule';
import type { TourAssignment } from '@/models/tourAssignment';
import type { StaffUser } from '@/models/user';
import {
  buildMonthGrid, formatMonthLabel, todayStr, isSunday,
  prevMonth as getPrevMonth, nextMonth as getNextMonth, DAY_HEADERS,
} from '@/utils/dateUtils';

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Stable order for leave markers inside a cell. */
const LEAVE_ORDER = Object.keys(LEAVE_TYPE_META) as LeaveType[];

export default function CalendarPage() {
  const { user } = useAuth();
  const { requests } = useLeave();
  const { jobRoles, roleAssignments, staffingRules, holidays, specialDays, tourAssignments, users, schedules } = useAppData();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const { summaryMap } = useCalendarData(year, month, requests);
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const monthLabel = formatMonthLabel(year, month);
  const isRichView = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.MANAGER;
  const isViewingCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  // The day whose details show in the day panel — defaults to today.
  const [previewDate, setPreviewDate] = useState<string>(todayStr());
  // The day the full interactive modal (swap / assign / cancel) is open for.
  // Tapping a tile sets both at once, so one tap still opens the modal like before.
  const [manageDate, setManageDate] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);

  // CRITICAL: Calendar only shows APPROVED requests, never pending
  // Business logic: Unapproved requests should not affect calendar status
  // until explicitly approved by admin/manager
  const userOffDates = useMemo(() => {
    if (!user) return new Set<string>();
    // Filter ONLY approved requests - pending requests do NOT show on calendar
    return new Set(requests.filter((r) => r.userId === user.id && r.status === 'approved').map((r) => r.date));
  }, [requests, user]);

  // CRITICAL: Calendar indicators only reflect APPROVED leave, not pending.
  // Peers only ever see "someone is off" — the leave type (esp. Sick Day) is
  // private to the person themselves and to managers/admins.
  const leavesByDate = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const map = new Map<string, CalendarTileLeave[]>();
    for (const r of requests) {
      // APPROVED ONLY - pending requests do not show on calendar
      if (r.status !== 'approved' || !r.date.startsWith(monthPrefix)) continue;
      const isYou = r.userId === user?.id;
      const entry: CalendarTileLeave = {
        id: r.id,
        name: r.userRef?.displayName ?? 'Unknown',
        type: isRichView || isYou ? r.leaveType : null,
        isYou,
      };
      const list = map.get(r.date);
      if (list) list.push(entry);
      else map.set(r.date, [entry]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
        const ta = a.type ? LEAVE_ORDER.indexOf(a.type) : LEAVE_ORDER.length;
        const tb = b.type ? LEAVE_ORDER.indexOf(b.type) : LEAVE_ORDER.length;
        return ta - tb || a.name.localeCompare(b.name);
      });
    }
    return map;
  }, [requests, year, month, user?.id, isRichView]);

  // CRITICAL: Staffing calculations only use APPROVED leave requests
  // Pending requests do NOT affect staffing levels until approved
  // This ensures accurate real-time staffing visibility
  const staffingMap = useMemo(() => {
    const map = new Map<string, 'good' | 'exact' | 'low'>();
    if (staffingRules.length === 0) return map;

    const roleNames: Record<string, string> = {};
    for (const r of jobRoles) roleNames[r.id] = r.name;

    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    // Only use APPROVED requests for staffing - pending are not yet confirmed
    const monthApproved = requests.filter(r => r.status === 'approved' && r.date.startsWith(monthPrefix));

    for (const tile of grid) {
      if (!tile.isCurrentMonth) continue;
      const dateApproved = monthApproved.filter(r => r.date === tile.dateStr);
      const statuses = checkStaffingForDate(tile.dateStr, staffingRules, roleAssignments, dateApproved, roleNames);
      if (statuses.length === 0) continue;

      const hasLow = statuses.some(s => s.surplus < 0);
      const hasExact = statuses.some(s => s.surplus === 0);

      if (hasLow) map.set(tile.dateStr, 'low');
      else if (hasExact) map.set(tile.dateStr, 'exact');
      else map.set(tile.dateStr, 'good');
    }
    return map;
  }, [requests, year, month, grid, staffingRules, roleAssignments, jobRoles]);

  const holidayNames = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  const specialDayNames = useMemo(() => new Map(specialDays.map((s) => [s.date, s.name])), [specialDays]);

  const handlePrev = () => { const p = getPrevMonth(year, month); setYear(p.year); setMonth(p.month); };
  const handleNext = () => { const n = getNextMonth(year, month); setYear(n.year); setMonth(n.month); };
  const handleToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setPreviewDate(todayStr()); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Tap a day to see who's off."
        actions={(
          <Button size="lg" onClick={() => setShowRequestForm(true)}>
            <Plus data-icon="inline-start" />
            Request time off
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
            <h3 className="text-base font-semibold tracking-tight sm:text-lg" aria-live="polite">{monthLabel}</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="lg" onClick={handleToday} disabled={isViewingCurrentMonth && previewDate === todayStr()}>
                Today
              </Button>
              <ButtonGroup aria-label="Change month">
                <Button variant="outline" size="icon-lg" onClick={handlePrev} aria-label="Previous month">
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="icon-lg" onClick={handleNext} aria-label="Next month">
                  <ChevronRight />
                </Button>
              </ButtonGroup>
            </div>
          </div>

          <div className="border-t">
            <div aria-hidden="true" className="grid grid-cols-7 border-b bg-muted/40">
              {DAY_HEADERS.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    'py-2 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:text-left',
                    i >= 5 && 'text-muted-foreground/70',
                  )}
                >
                  <span className="sm:hidden">{d}</span>
                  <span className="hidden sm:inline">{WEEKDAY_NAMES[i].slice(0, 3)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((tile) => {
                const summary = summaryMap.get(tile.dateStr) ?? null;
                const leaves = tile.isCurrentMonth ? (leavesByDate.get(tile.dateStr) ?? []) : [];
                return (
                  <CalendarTile
                    key={tile.dateStr}
                    day={tile.day}
                    dateStr={tile.dateStr}
                    isToday={tile.isToday}
                    isCurrentMonth={tile.isCurrentMonth}
                    isWeekend={tile.isWeekend}
                    summary={summary}
                    isUserOff={userOffDates.has(tile.dateStr)}
                    hasLeave={leaves.length > 0}
                    leaves={leaves}
                    hasScheduledGuides={tile.isCurrentMonth && (summary?.scheduledGuidesCount ?? 0) > 0}
                    staffingLevel={tile.isCurrentMonth ? (staffingMap.get(tile.dateStr) || null) : null}
                    isSelected={tile.dateStr === previewDate}
                    holidayName={holidayNames.get(tile.dateStr)}
                    specialDayName={specialDayNames.get(tile.dateStr)}
                    isFirstSunday={tile.isCurrentMonth && tile.day <= 7 && isSunday(tile.dateStr)}
                    onClick={() => {
                      if (!tile.isCurrentMonth) return;
                      setPreviewDate(tile.dateStr);
                      setManageDate(tile.dateStr);
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="px-3 py-3 sm:px-4">
            <CalendarLegend showPrivate={!isRichView} />
          </div>
        </Card>

        <div className="space-y-6">
          <DayPreviewPanel
            date={previewDate}
            requests={requests}
            holidays={holidays}
            specialDays={specialDays}
            tourAssignments={tourAssignments}
            users={users}
            schedules={schedules}
            onManage={() => setManageDate(previewDate)}
            viewerId={user?.id}
            viewerCanSeeTypes={isRichView}
          />

          {isRichView && <MonthSummary summaryMap={summaryMap} />}
        </div>
      </div>

      <DayDetailModal date={manageDate} open={!!manageDate} onClose={() => setManageDate(null)} />
      <RequestFormModal open={showRequestForm} onClose={() => setShowRequestForm(false)} />
    </div>
  );
}

/* ── Legend ─────────────────────────────────────────────────────────── */

const LEGEND_LEAVE_TYPES: LeaveType[] = ['regular_day_off', 'paid_vacation', 'sick_day', 'auto_assigned'];

const LEGEND_MARKERS: { key: string; Icon: LucideIcon; className: string; label: string }[] = [
  { key: 'special', Icon: Star, className: 'fill-current text-leave-special', label: 'Special day' },
  { key: 'holiday', Icon: Flag, className: 'text-info', label: 'Holiday' },
  { key: 'sunday', Icon: CalendarCheck, className: 'text-muted-foreground', label: 'Monthly Sunday' },
  { key: 'guides', Icon: MapPin, className: 'text-primary', label: 'Tour guides scheduled' },
  { key: 'low', Icon: TriangleAlert, className: 'text-warning', label: 'Short-staffed' },
  { key: 'exact', Icon: CircleAlert, className: 'text-muted-foreground', label: 'At minimum staffing' },
];

function CalendarLegend({ showPrivate }: { showPrivate: boolean }) {
  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      <ul aria-label="Leave types" className="flex flex-wrap gap-x-4 gap-y-1.5">
        {LEGEND_LEAVE_TYPES.map((type) => {
          const meta = leaveTypeMeta(type);
          return (
            <li key={type} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('size-2 rounded-full', meta.dot)} />
              {meta.label}
            </li>
          );
        })}
        {showPrivate && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full border border-foreground/45" />
            Colleague off
          </li>
        )}
      </ul>
      <ul aria-label="Day markers" className="flex flex-wrap gap-x-4 gap-y-1.5">
        {LEGEND_MARKERS.map(({ key, Icon, className, label }) => (
          <li key={key} className="flex items-center gap-1.5">
            <Icon aria-hidden="true" className={cn('size-3.5', className)} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Day panel ──────────────────────────────────────────────────────── */

/** Live in-office / remote count for one date, from real check-in records. */
function useDayAttendanceCounts(date: string) {
  const [counts, setCounts] = useState<{ date: string; office: number; remote: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // TODO: Migrate to Firestore check-ins query
      await Promise.resolve();
      if (cancelled) return;
      setCounts({ date, office: 0, remote: 0 });
    }
    load();
    return () => { cancelled = true; };
  }, [date]);

  // Counts for a previous date are stale while the new date loads.
  return counts && counts.date === date ? counts : null;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h4 className="mb-2 text-xs font-medium text-muted-foreground">{children}</h4>;
}

function DayPreviewPanel({
  date, requests, holidays, specialDays, tourAssignments, users, onManage, viewerId, viewerCanSeeTypes, schedules = [],
}: {
  date: string;
  requests: LeaveRequest[];
  holidays: { date: string; name: string }[];
  specialDays: { date: string; name: string }[];
  tourAssignments: TourAssignment[];
  users: StaffUser[];
  schedules: Schedule[];
  onManage: () => void;
  viewerId?: string;
  viewerCanSeeTypes: boolean;
}) {
  const dayRequests = requests.filter((r) => r.date === date && r.status !== 'cancelled');
  const approved = dayRequests.filter((r) => r.status === 'approved');
  const pending = dayRequests.filter((r) => r.status === 'pending');
  const holiday = holidays.find((h) => h.date === date);
  const special = specialDays.find((s) => s.date === date);
  const dayTours = tourAssignments.filter((t) => t.date === date);

  // Scheduled guides for this date
  const scheduledGuides = [...new Set(schedules.filter((s) => s.date === date).map((s) => s.guide))].sort();

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isEmpty = approved.length === 0 && pending.length === 0 && !holiday && !special && scheduledGuides.length === 0;
  const attendance = useDayAttendanceCounts(date);

  const summaryParts = [
    approved.length > 0 ? `${approved.length} off` : null,
    pending.length > 0 ? `${pending.length} pending` : null,
    scheduledGuides.length > 0 ? `${scheduledGuides.length} ${scheduledGuides.length === 1 ? 'guide' : 'guides'}` : null,
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dateLabel}</CardTitle>
        <CardDescription>{summaryParts.length > 0 ? summaryParts.join(' · ') : 'Everyone is working'}</CardDescription>
        <CardAction>
          <Button variant="outline" onClick={onManage}>View day</Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        {(holiday || special) && (
          <div className="flex flex-wrap gap-1.5">
            {holiday && (
              <Badge variant="secondary" className="border-transparent bg-info/12 text-info">
                <Flag data-icon="inline-start" />
                {holiday.name}
              </Badge>
            )}
            {special && (
              <Badge variant="secondary" className="border-transparent bg-leave-special/12 text-leave-special">
                <Star data-icon="inline-start" />
                {special.name}
              </Badge>
            )}
          </div>
        )}

        {attendance && (attendance.office > 0 || attendance.remote > 0 || approved.length > 0) && (
          <dl className="grid grid-cols-3 divide-x rounded-lg bg-muted/50 py-2.5 text-center">
            {[
              { label: 'In office', value: attendance.office },
              { label: 'Remote', value: attendance.remote },
              { label: 'On leave', value: approved.length },
            ].map((s) => (
              <div key={s.label} className="flex flex-col-reverse gap-0.5">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {isEmpty ? (
          <EmptyState icon={CalendarCheck} title="Everyone is working" description="No one is off this day." className="py-6" />
        ) : (approved.length > 0 || pending.length > 0) && (
          <section>
            <SectionLabel>Off this day</SectionLabel>
            <ItemGroup className="gap-1">
              {[...approved, ...pending].map((r) => {
                const canSeeType = viewerCanSeeTypes || r.userId === viewerId;
                const isPending = r.status === 'pending';
                const name = r.userRef?.displayName ?? 'Unknown';
                return (
                  <Item key={r.id} size="xs" variant="muted" role="listitem">
                    <ItemMedia>
                      <UserAvatar name={name} size="sm" />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle>
                        {name}
                        {r.userId === viewerId && <span className="font-normal text-muted-foreground">(you)</span>}
                      </ItemTitle>
                      <ItemDescription className={cn(isPending && 'text-warning')}>
                        {isPending ? 'Awaiting approval' : 'Full day'}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {canSeeType
                        ? <LeaveTypeBadge type={r.leaveType} withIcon={false} className={cn(isPending && 'opacity-70')} />
                        : <Badge variant="secondary">Off</Badge>}
                    </ItemActions>
                  </Item>
                );
              })}
            </ItemGroup>
          </section>
        )}

        {scheduledGuides.length > 0 && (
          <section>
            <SectionLabel>Tour guides scheduled ({scheduledGuides.length})</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {scheduledGuides.map((guide) => (
                <Badge key={guide} variant="outline" className="h-6 gap-1.5">
                  <MapPin data-icon="inline-start" className="text-primary" />
                  {guide}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {dayTours.length > 0 && (
          <section>
            <SectionLabel>On tour</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {dayTours.map((t) => {
                const staffMember = users.find((u) => u.id === t.userId);
                return (
                  <Badge key={t.id} variant="outline" className="h-6">
                    {staffMember?.displayName ?? t.userId}
                  </Badge>
                );
              })}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Month overview (managers and admins) ───────────────────────────── */

function MonthSummary({ summaryMap }: { summaryMap: Map<string, DaySummary> }) {
  const values = Array.from(summaryMap.values());
  const holidays = values.filter((s) => s.isHoliday).length;
  const specialDays = values.filter((s) => s.isSpecialDay).length;
  const warningDays = values.filter((s) => s.hasStaffingWarning).length;
  const totalPending = values.reduce((sum, s) => sum + s.pendingRequests, 0);
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">Month overview</h3>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Holidays" value={holidays} tone={holidays > 0 ? 'info' : 'default'} className="p-3" />
        <StatCard label="Special days" value={specialDays} className="p-3" />
        <StatCard label="Short-staffed days" value={warningDays} tone={warningDays > 0 ? 'warning' : 'default'} className="p-3" />
        <StatCard label="Pending requests" value={totalPending} tone={totalPending > 0 ? 'primary' : 'default'} className="p-3" />
      </div>
    </section>
  );
}
