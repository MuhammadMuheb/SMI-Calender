import { useState, useMemo } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, CircleCheck, RefreshCw, Sparkles, TriangleAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { useAppData } from '@/app/AppDataContext';
import { runAutoAssignment, type AutoAssignPreview } from '@/features/admin/services/autoAssignService';
import { checkStaffingForDate } from '@/services/staffingService';
import { insertAuditLog } from '@/features/auth/authService';
import { formatShortDate } from '@/features/leave/leaveMeta';
import type { LeaveRequest } from '@/models/leave';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface Props { onBack?: () => void }
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_HEADERS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

type DayHealth = 'green' | 'yellow' | 'red';

const HEALTH_CELL: Record<DayHealth, string> = {
  green: 'border-success/30 bg-success/8 hover:bg-success/15',
  yellow: 'border-warning/40 bg-warning/10 hover:bg-warning/18',
  red: 'border-destructive/40 bg-destructive/10 hover:bg-destructive/15',
};

const HEALTH_CHIP: Record<DayHealth, string> = {
  green: 'bg-success/15 text-success',
  yellow: 'bg-warning/15 text-warning',
  red: 'bg-destructive/15 text-destructive',
};

const HEALTH_LABEL: Record<DayHealth, string> = {
  green: 'Above minimum',
  yellow: 'At minimum',
  red: 'Short-staffed',
};

export default function AutoAssignment({ onBack }: Props) {
  const { user } = useAuth();
  const { requests, directAssign } = useLeave();
  const { users, jobRoles, roleAssignments, staffingRules, holidays, specialDays } = useAppData();

  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [preview, setPreview] = useState<AutoAssignPreview | null>(null);
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const monthLabel = `${MONTH_NAMES[selMonth]} ${selYear}`;
  const monthStart = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(selYear, selMonth + 1, 0).getDate();
  const monthEnd = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const roleNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of jobRoles) m[r.id] = r.name;
    return m;
  }, [jobRoles]);

  const existingApproved = useMemo(() => {
    return requests.filter(r => r.date >= monthStart && r.date <= monthEnd && r.status === 'approved');
  }, [requests, monthStart, monthEnd]);

  const handlePrev = () => {
    if (selMonth === 0) { setSelMonth(11); setSelYear(selYear - 1); } else setSelMonth(selMonth - 1);
    setPreview(null); setApplied(false);
  };
  const handleNext = () => {
    if (selMonth === 11) { setSelMonth(0); setSelYear(selYear + 1); } else setSelMonth(selMonth + 1);
    setPreview(null); setApplied(false);
  };

  const handlePreview = () => {
    const result = runAutoAssignment(users, requests, staffingRules, roleAssignments, holidays, specialDays, roleNames, monthStart, monthEnd);
    setPreview(result); setApplied(false);
  };

  const handleApply = async () => {
    if (!preview || !user) return;
    setApplying(true);
    let ok = 0;
    const errors: string[] = [];
    try {
      for (const a of preview.assignments) {
        const u = users.find(x => x.id === a.userId);
        const role = (u?.role ?? 'staff') as 'staff' | 'manager' | 'super_admin';
        try {
          const err = await directAssign(a.userId, a.userName, role, a.date, 'regular_day_off', user.displayName);
          if (err) errors.push(`${a.userName}, ${formatShortDate(a.date)}: ${err}`);
          else ok++;
        } catch {
          errors.push(`${a.userName}, ${formatShortDate(a.date)}`);
        }
      }
      if (ok > 0) {
        await insertAuditLog({ actorId: user.id, actorName: user.displayName, action: 'auto_assignment_run',
          entityType: 'auto_assignment', entityId: 'batch',
          description: `Auto-assigned ${ok} days for ${MONTH_NAMES[selMonth]} ${selYear}` });
      }
    } finally {
      setApplying(false);
      setConfirmOpen(false);
    }

    if (errors.length === 0) {
      setApplied(true);
      toast.success(`Applied ${ok} ${ok === 1 ? 'day' : 'days'} off for ${monthLabel}`);
    } else if (ok > 0) {
      setApplied(true);
      toast.error(`Applied ${ok} of ${preview.totalAssigned} days off`, {
        description: `${errors.length} couldn’t be saved. ${errors[0]}${errors.length > 1 ? ` and ${errors.length - 1} more` : ''}. Regenerate to try the rest.`,
      });
    } else {
      toast.error('Couldn’t apply the days off', {
        description: `${errors[0] ?? 'Something went wrong'}. Check your connection and try again.`,
      });
    }
  };

  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(selYear, selMonth, 1);
    const startDow = (firstDayOfMonth.getDay() + 6) % 7;
    const cells: { day: number; dateStr: string; inMonth: boolean }[] = [];
    for (let i = 0; i < startDow; i++) cells.push({ day: 0, dateStr: '', inMonth: false });
    for (let d = 1; d <= lastDay; d++) {
      const ds = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateStr: ds, inMonth: true });
    }
    return cells;
  }, [selYear, selMonth, lastDay]);

  // Once applied, the proposal is part of `requests`; don't count it twice.
  const proposal = applied ? null : preview;

  const { offMap, healthMap } = useMemo(() => {
    const oMap: Record<string, { name: string; isNew: boolean }[]> = {};
    const hMap: Record<string, { health: DayHealth; details: string[] }> = {};

    const simulated: LeaveRequest[] = [...existingApproved];
    if (proposal) {
      for (const a of proposal.assignments) {
        simulated.push({
          id: `prev_${a.userId}_${a.date}`, userId: a.userId,
          userRef: { id: a.userId, displayName: a.userName, role: 'staff' },
          date: a.date, leaveType: 'regular_day_off', status: 'approved',
          staffNote: '', approverNote: '', decidedBy: null, decidedAt: null,
          isOverridden: false, overriddenBy: null, overriddenAt: null,
          createdAt: '', updatedAt: '',
        });
      }
    }

    for (const r of existingApproved) {
      if (!oMap[r.date]) oMap[r.date] = [];
      const name = users.find(u => u.id === r.userId)?.displayName ?? r.userId;
      oMap[r.date].push({ name, isNew: false });
    }
    if (proposal) {
      for (const a of proposal.assignments) {
        if (!oMap[a.date]) oMap[a.date] = [];
        oMap[a.date].push({ name: a.userName, isNew: true });
      }
    }

    for (const cell of calendarGrid) {
      if (!cell.inMonth) continue;
      const dayRequests = simulated.filter(r => r.date === cell.dateStr);
      const statuses = checkStaffingForDate(cell.dateStr, staffingRules, roleAssignments, dayRequests, roleNames);

      const details: string[] = [];
      let worst: DayHealth = 'green';

      for (const s of statuses) {
        if (s.surplus < 0) {
          worst = 'red';
        } else if (s.surplus === 0) {
          if (worst !== 'red') worst = 'yellow';
        }
        details.push(`${s.jobRoleName}: ${s.scheduled}/${s.required}`);
      }

      hMap[cell.dateStr] = { health: worst, details };
    }

    return { offMap: oMap, healthMap: hMap };
  }, [existingApproved, proposal, calendarGrid, staffingRules, roleAssignments, roleNames, users]);

  /** Proposed dates per person, for the summary table. */
  const datesByUser = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const a of preview?.assignments ?? []) (m[a.userId] ??= []).push(a.date);
    return m;
  }, [preview]);

  const stillShort = preview?.staffSummary.filter((s) => s.daysRemaining > 0).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auto-schedule"
        description="Propose regular days off for the whole team without breaking staffing rules, review them, then apply."
        onBack={onBack}
      />

      {/* Month picker + actions */}
      <Card size="sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handlePrev} disabled={applying} aria-label="Previous month">
              <ChevronLeft />
            </Button>
            <p className="min-w-36 text-center text-base font-semibold tabular-nums">{monthLabel}</p>
            <Button variant="ghost" size="icon" onClick={handleNext} disabled={applying} aria-label="Next month">
              <ChevronRight />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="lg" onClick={handlePreview} disabled={applying}>
              {preview ? <RefreshCw data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
              {preview ? 'Regenerate' : `Generate ${MONTH_NAMES[selMonth]}`}
            </Button>
            {preview && !applied && (
              <Button size="lg" onClick={() => setConfirmOpen(true)} disabled={preview.totalAssigned === 0 || applying}>
                {applying ? <Spinner data-icon="inline-start" /> : <CalendarCheck data-icon="inline-start" />}
                {applying ? 'Applying…' : `Apply ${preview.totalAssigned} ${preview.totalAssigned === 1 ? 'day' : 'days'} off`}
              </Button>
            )}
            {applied && (
              <Badge variant="secondary" className="h-7 border-transparent bg-success/12 px-2.5 text-success">
                <CircleCheck data-icon="inline-start" />
                Applied
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Proposed days off" value={preview.totalAssigned} icon={CalendarCheck} tone="primary" />
          <StatCard label="Still need days" value={stillShort} icon={Users} tone={stillShort > 0 ? 'warning' : 'default'}
            hint={stillShort > 0 ? 'People below their quota' : 'Everyone reaches their quota'} />
          <StatCard label="Warnings" value={preview.warnings.length} icon={TriangleAlert}
            tone={preview.warnings.length > 0 ? 'warning' : 'default'} />
        </div>
      )}

      {/* Calendar preview */}
      <Card>
        <CardHeader>
          <CardTitle>Staffing for {monthLabel}</CardTitle>
          <CardDescription>
            {proposal ? 'Proposed days off are marked with +. ' : 'Days already off are shown. '}
            Select a day to see the role breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-7 gap-1">
            {DAY_HEADERS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarGrid.map((cell, i) => {
              if (!cell.inMonth) return <div key={i} />;
              const offs = offMap[cell.dateStr] || [];
              const health = healthMap[cell.dateStr];
              const tone: DayHealth = health?.health ?? 'green';
              const isFirstSunday = new Date(cell.dateStr + 'T00:00:00').getDay() === 0 && cell.day <= 7;
              const newCount = offs.filter((o) => o.isNew).length;

              return (
                <Popover key={i}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${formatShortDate(cell.dateStr)}: ${offs.length} off, ${HEALTH_LABEL[tone].toLowerCase()}`}
                      className={cn(
                        'flex min-h-14 cursor-pointer flex-col rounded-md border p-1 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-20',
                        HEALTH_CELL[tone],
                      )}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className={cn('text-xs font-semibold tabular-nums', isFirstSunday && 'text-primary')}>{cell.day}</span>
                        {offs.length > 0 && (
                          <span className={cn('rounded px-1 text-[10px] leading-4 font-semibold tabular-nums', HEALTH_CHIP[tone])}>
                            {offs.length}<span className="hidden sm:inline"> off</span>
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 hidden min-w-0 flex-1 overflow-hidden sm:block">
                        {offs.slice(0, 3).map((o, j) => (
                          <p key={j} className={cn('truncate text-[11px] leading-tight', o.isNew ? 'font-medium text-primary' : 'text-muted-foreground')}>
                            {o.isNew ? '+ ' : ''}{o.name}
                          </p>
                        ))}
                        {offs.length > 3 && <p className="text-[11px] leading-tight text-muted-foreground">+{offs.length - 3} more</p>}
                      </div>
                      {newCount > 0 && (
                        <span className="mt-auto size-1.5 rounded-full bg-primary sm:hidden" aria-hidden="true" />
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div>
                      <p className="font-medium">{formatShortDate(cell.dateStr)}</p>
                      <p className={cn('text-xs', tone === 'green' ? 'text-success' : tone === 'yellow' ? 'text-warning' : 'text-destructive')}>
                        {HEALTH_LABEL[tone]}{isFirstSunday ? ' · First Sunday, everyone off' : ''}
                      </p>
                    </div>
                    {health && health.details.length > 0 ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-muted-foreground">Working / required</p>
                        {health.details.map((d, j) => <p key={j} className="text-sm tabular-nums">{d}</p>)}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No staffing rules for this day.</p>
                    )}
                    {offs.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-muted-foreground">Off ({offs.length})</p>
                        {offs.map((o, j) => (
                          <p key={j} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate">{o.name}</span>
                            {o.isNew && <Badge variant="secondary" className="border-transparent bg-primary/10 text-primary">Proposed</Badge>}
                          </p>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            {(['green', 'yellow', 'red'] as DayHealth[]).map((h) => (
              <span key={h} className="flex items-center gap-1.5">
                <span className={cn('size-3 rounded-sm border', HEALTH_CELL[h])} aria-hidden="true" />
                {HEALTH_LABEL[h]}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-primary">+ Name</span>
              Proposed day off
            </span>
          </div>
        </CardContent>
      </Card>

      {preview && preview.warnings.length > 0 && (
        <Alert>
          <TriangleAlert className="text-warning" />
          <AlertTitle>Some days couldn’t be placed</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {preview && (
        <Card className="gap-0 pb-0">
          <CardHeader className="border-b">
            <CardTitle>Per person</CardTitle>
            <CardDescription>Days off each person gets from this proposal, and how many they still need.</CardDescription>
          </CardHeader>
          {preview.staffSummary.length === 0 ? (
            <CardContent className="py-4">
              <EmptyState icon={Users} title="No active staff" description="Add or reactivate staff to generate a schedule." />
            </CardContent>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Person</TableHead>
                      <TableHead>Proposed dates</TableHead>
                      <TableHead className="w-28 text-right">Proposed</TableHead>
                      <TableHead className="w-32 pr-4 text-right">Still needed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.staffSummary.map((s) => (
                      <TableRow key={s.userId}>
                        <TableCell className="pl-4 font-medium">{s.userName}</TableCell>
                        <TableCell className="whitespace-normal">
                          <DateChips dates={datesByUser[s.userId]} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.daysAssigned}</TableCell>
                        <TableCell className="pr-4 text-right"><RemainingBadge summary={s} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y md:hidden">
                {preview.staffSummary.map((s) => (
                  <div key={s.userId} className="space-y-1.5 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{s.userName}</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {s.daysAssigned > 0 && (
                          <Badge variant="secondary" className="border-transparent bg-primary/10 text-primary">+{s.daysAssigned}</Badge>
                        )}
                        <RemainingBadge summary={s} />
                      </div>
                    </div>
                    <DateChips dates={datesByUser[s.userId]} />
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!applying) setConfirmOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Apply {preview?.totalAssigned ?? 0} {preview?.totalAssigned === 1 ? 'day' : 'days'} off for {monthLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Each proposed date is booked as an approved regular day off and the person is notified.
              Any other request they have on that date is replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={applying}
              onClick={(e) => { e.preventDefault(); void handleApply(); }}
            >
              {applying && <Spinner data-icon="inline-start" />}
              {applying ? 'Applying…' : 'Apply'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DateChips({ dates }: { dates: string[] | undefined }) {
  if (!dates || dates.length === 0) return <span className="text-xs text-muted-foreground">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {dates.map((d) => (
        <Badge key={d} variant="outline" className="font-normal">{formatShortDate(d)}</Badge>
      ))}
    </div>
  );
}

function RemainingBadge({ summary }: { summary: AutoAssignPreview['staffSummary'][number] }) {
  if (summary.daysRemaining > 0) {
    return (
      <Badge variant="secondary" className="border-transparent bg-warning/12 text-warning">
        {summary.daysRemaining} left
      </Badge>
    );
  }
  return <Badge variant="secondary" className="border-transparent bg-success/12 text-success">Full</Badge>;
}
