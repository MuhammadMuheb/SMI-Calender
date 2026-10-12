import { useMemo, useState } from 'react';
import { CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState } from '@/components/shared/EmptyState';
import { useLeave } from '@/features/leave/LeaveContext';
import { LeaveStatusBadge, LeaveTypeBadge, leaveTypeMeta } from '@/features/leave/leaveMeta';
import { displayStaffNote } from '@/features/leave/requestNotes';
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/models/leave';
import { getFirstSundayOfMonth } from '@/models/validation';
import { getCycleForMonth, getCycleLabel } from '@/utils/cycleUtils';

interface StaffLeaveLogProps {
  userId: string;
  /** Any YYYY-MM-DD in the month to open on. Defaults to this month. */
  initialMonth?: string;
}

type View = 'off' | 'all';

interface LogEntry {
  id: string;
  date: string;
  leaveType: LeaveType;
  status: LeaveStatus;
  detail: string;
  automatic: boolean;
}

/** [singular, plural] nouns for the month summary ("4 days off, 1 first Sunday"). */
const SUMMARY_NOUN: Record<LeaveType, [string, string]> = {
  regular_day_off: ['day off', 'days off'],
  paid_vacation: ['vacation day', 'vacation days'],
  sick_day: ['sick day', 'sick days'],
  auto_assigned: ['auto-assigned day', 'auto-assigned days'],
  auto_sunday: ['first Sunday', 'first Sundays'],
  special_day: ['special day', 'special days'],
};

function longDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

function detailFor(r: LeaveRequest): string {
  const parts: string[] = [];
  const note = displayStaffNote(r.staffNote);
  if (note) parts.push(note);
  if (r.decidedBy?.displayName && (r.status === 'approved' || r.status === 'rejected')) {
    parts.push(`${r.status === 'approved' ? 'Approved' : 'Declined'} by ${r.decidedBy.displayName}`);
  } else if (r.approverNote) {
    parts.push(r.approverNote);
  }
  return parts.join(' · ');
}

/** Month-by-month log of the days a person has off (and, optionally, every request). */
export default function StaffLeaveLog({ userId, initialMonth }: StaffLeaveLogProps) {
  const { requests } = useLeave();
  const [view, setView] = useState<View>('off');
  const [month, setMonth] = useState(() => {
    const d = initialMonth ? new Date(initialMonth + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const cycle = getCycleForMonth(month.year, month.month);
  const shift = (delta: number) => {
    const d = new Date(month.year, month.month + delta, 1);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  const entries = useMemo<LogEntry[]>(() => {
    const inMonth = requests.filter((r) => r.userId === userId && r.date >= cycle.start && r.date <= cycle.end);
    const shown = view === 'off'
      ? inMonth.filter((r) => r.status === 'approved')
      : inMonth.filter((r) => r.status !== 'cancelled');
    const list: LogEntry[] = shown.map((r) => ({
      id: r.id, date: r.date, leaveType: r.leaveType, status: r.status, detail: detailFor(r), automatic: false,
    }));

    // The first Sunday is always off and counts towards the month, even
    // when no request was recorded for it.
    const firstSunday = getFirstSundayOfMonth(cycle.year, cycle.month);
    if (!inMonth.some((r) => r.date === firstSunday && r.status !== 'cancelled' && r.status !== 'rejected')) {
      list.push({
        id: `first-sunday-${firstSunday}`, date: firstSunday, leaveType: 'auto_sunday', status: 'approved',
        detail: 'Always off · counts as 1 of the month’s days', automatic: true,
      });
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [requests, userId, view, cycle.start, cycle.end, cycle.year, cycle.month]);

  const daysOff = entries.filter((e) => e.status === 'approved');
  const countsByType = daysOff.reduce<Partial<Record<LeaveType, number>>>((acc, e) => {
    acc[e.leaveType] = (acc[e.leaveType] ?? 0) + 1;
    return acc;
  }, {});
  const summary = (Object.entries(countsByType) as [LeaveType, number][])
    .map(([type, n]) => {
      const noun = SUMMARY_NOUN[type] ?? [leaveTypeMeta(type).label.toLowerCase(), leaveTypeMeta(type).label.toLowerCase()];
      return `${n} ${n === 1 ? noun[0] : noun[1]}`;
    })
    .join(', ');

  return (
    <section className="space-y-3" aria-labelledby="leave-log-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="leave-log-heading" className="font-medium">Days off log</h3>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={view}
          onValueChange={(v) => { if (v) setView(v as View); }}
          aria-label="What to show"
        >
          <ToggleGroupItem value="off">Days off</ToggleGroupItem>
          <ToggleGroupItem value="all">All requests</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg border px-1 py-1">
        <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium">{getCycleLabel(cycle)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {daysOff.length} {daysOff.length === 1 ? 'day' : 'days'} off{summary ? ` · ${summary}` : ''}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight />
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={CalendarOff} title="Nothing this month" description="No days off or requests in this month." className="py-6" />
      ) : (
        <ul className="divide-y rounded-lg border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium tabular-nums">{longDate(e.date)}</p>
                {e.detail && <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <LeaveTypeBadge type={e.leaveType} />
                {e.automatic
                  ? <Badge variant="outline">Automatic</Badge>
                  : view === 'all' && <LeaveStatusBadge status={e.status} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
