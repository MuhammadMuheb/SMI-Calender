import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, ChevronRight, Download, House, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { exportAttendanceCSV } from '@/features/attendance/attendanceUtils';
import {
  fetchCheckInsBetween, fetchUserCheckInsBetween, localMonthRange, type CheckInData,
} from '@/features/attendance/services/checkInsService';
import { useAppData } from '@/app/AppDataContext';
import { getDisplayName } from '@/utils/dataValidation';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const BREAK_MINUTES: Record<string, number> = { 'Check In': 60, 'Back Office': 30, 'Back Office Extra': 30, 'Office': 30 };
const ALL_STAFF = 'all';

function getBreakForRoles(roles: string[]): number {
  let max = 30;
  for (const r of roles) { if (BREAK_MINUTES[r] && BREAK_MINUTES[r] > max) max = BREAK_MINUTES[r]; }
  return max;
}

interface AttendanceRow {
  id: string; user_id: string; user_name: string; role: string; job_role: string[];
  location_name: string; check_in_at: string; check_out_at: string | null;
  is_wfh: boolean; work_type: string; auto_checked_out: boolean;
}
interface DaySummary { date: string; entries: AttendanceRow[]; totalGrossHours: number; totalBreakHours: number; totalNetHours: number; }
interface StaffSummary { user_id: string; user_name: string; job_role: string[]; days: DaySummary[]; totalDaysWorked: number; totalGrossHours: number; totalBreakHours: number; totalNetHours: number; wfhDays: number; onSiteDays: number; }

interface AttendanceSummaryProps { currentUserId: string; currentUserRole: string; currentUserJobRoles: string[]; }

function calcEntryHours(entry: AttendanceRow) {
  if (!entry.check_out_at) return { gross: 0, breakH: 0, net: 0, isOpen: true };
  const grossMs = new Date(entry.check_out_at).getTime() - new Date(entry.check_in_at).getTime();
  const grossH = grossMs / 3600000;
  const breakMin = getBreakForRoles(entry.job_role);
  const breakH = breakMin / 60;
  return { gross: grossH, breakH, net: Math.max(grossH - breakH, 0), isOpen: false };
}

function formatMonthLabel(ym: string) { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
function formatTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function formatH(h: number) { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`; }
function formatDateLabel(dateStr: string) { const d = new Date(dateStr + 'T00:00:00'); return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }); }

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AttendanceSummary({ currentUserId, currentUserRole }: AttendanceSummaryProps) {
  const isAdmin = currentUserRole === 'super_admin' || currentUserRole === 'manager';
  // Spectators have a read-only view of everyone's attendance.
  const canViewAll = isAdmin || currentUserRole === 'spectator';
  const { users } = useAppData();
  const [rawRecords, setRawRecords] = useState<CheckInData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; });
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const staffList = useMemo(
    () => users
      .map((u) => ({ id: u.id, display_name: getDisplayName(u), job_role: u.jobRole ?? [] }))
      .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [users],
  );

  useEffect(() => {
    let cancelled = false;
    const [year, month] = selectedMonth.split('-').map(Number);
    const [start, end] = localMonthRange(year, month);
    const request = canViewAll
      ? fetchCheckInsBetween(start, end)
      : fetchUserCheckInsBetween(currentUserId, start, end);
    request
      .then((data) => {
        if (cancelled) return;
        setRawRecords(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRawRecords([]);
        setLoading(false);
        toast.error('Couldn’t load attendance. Check your connection and try again.', { id: 'attendance-summary' });
      });
    return () => { cancelled = true; };
  }, [selectedMonth, canViewAll, currentUserId]);

  const records: AttendanceRow[] = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    return rawRecords
      .filter((r) => (canViewAll ? !selectedStaffId || r.userId === selectedStaffId : r.userId === currentUserId))
      .filter((r) => typeof r.checkInAt === 'string')
      .map((r) => {
        const user = byId.get(r.userId);
        const nameFromDoc = getDisplayName(r);
        return {
          id: r.id,
          user_id: r.userId,
          user_name: nameFromDoc !== 'Unknown User' ? nameFromDoc : user ? getDisplayName(user) : 'Unknown',
          role: user?.role ?? '',
          job_role: user?.jobRole ?? [],
          location_name: r.locationName || 'Unknown',
          check_in_at: r.checkInAt,
          check_out_at: r.checkOutAt || null,
          is_wfh: r.isWfh || false,
          work_type: r.workType || (r.isWfh ? 'wfh' : 'on_site'),
          auto_checked_out: r.autoCheckedOut || false,
        };
      });
  }, [rawRecords, users, canViewAll, selectedStaffId, currentUserId]);

  const summaries: StaffSummary[] = useMemo(() => {
    const byUser = new Map<string, AttendanceRow[]>();
    for (const r of records) { if (!byUser.has(r.user_id)) byUser.set(r.user_id, []); byUser.get(r.user_id)!.push(r); }
    const result: StaffSummary[] = [];
    byUser.forEach((userRecords, userId) => {
      const first = userRecords[0];
      const byDate = new Map<string, AttendanceRow[]>();
      for (const r of userRecords) { const date = new Date(r.check_in_at).toLocaleDateString('en-CA'); if (!byDate.has(date)) byDate.set(date, []); byDate.get(date)!.push(r); }
      const days: DaySummary[] = []; let totalGross = 0, totalBreak = 0, totalNet = 0, wfhDays = 0, onSiteDays = 0;
      const sortedDates = Array.from(byDate.keys()).sort();
      for (const date of sortedDates) {
        const entries = byDate.get(date)!.sort((a, b) => a.check_in_at.localeCompare(b.check_in_at));
        let dayGross = 0, dayBreak = 0, dayNet = 0, hasWfh = false, hasOnSite = false;
        for (const entry of entries) { const h = calcEntryHours(entry); dayGross += h.gross; dayBreak += h.breakH; dayNet += h.net; if (entry.is_wfh) hasWfh = true; else hasOnSite = true; }
        days.push({ date, entries, totalGrossHours: dayGross, totalBreakHours: dayBreak, totalNetHours: dayNet });
        totalGross += dayGross; totalBreak += dayBreak; totalNet += dayNet; if (hasWfh) wfhDays++; if (hasOnSite) onSiteDays++;
      }
      result.push({ user_id: userId, user_name: first.user_name, job_role: first.job_role, days, totalDaysWorked: sortedDates.length, totalGrossHours: totalGross, totalBreakHours: totalBreak, totalNetHours: totalNet, wfhDays, onSiteDays });
    });
    result.sort((a, b) => a.user_name.localeCompare(b.user_name));
    return result;
  }, [records]);

  const monthOptions = useMemo(() => {
    const options: string[] = []; const now = new Date();
    const count = canViewAll ? 12 : 1;
    for (let i = 0; i < count; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
    return options;
  }, [canViewAll]);

  async function handleExport() {
    setExporting(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      // exportAttendanceCSV takes a 0-based month.
      const csv = await exportAttendanceCSV(year, month - 1);
      if (csv === null || csv.split('\n').length <= 1) {
        toast('No attendance records to export for this month.');
      } else {
        downloadCsv(csv, `attendance-${selectedMonth}.csv`);
        toast.success('Attendance exported');
      }
    } catch {
      toast.error('Couldn’t export attendance. Try again.');
    }
    setExporting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Hours worked per day, after breaks."
        actions={
          <>
            <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setLoading(true); }}>
              <SelectTrigger className="h-10" aria-label="Month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
            {canViewAll && (
              <Select value={selectedStaffId ?? ALL_STAFF} onValueChange={(v) => setSelectedStaffId(v === ALL_STAFF ? null : v)}>
                <SelectTrigger className="h-10 max-w-56" aria-label="Staff member">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STAFF}>All staff</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.display_name}{s.job_role.length > 0 ? ` (${s.job_role.join(', ')})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isAdmin && (
              <Button variant="outline" size="lg" className="h-10" onClick={handleExport} disabled={exporting}>
                {exporting ? <Spinner /> : <Download />}
                {exporting ? 'Exporting…' : 'Export CSV'}
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <LoadingState label="Loading attendance…" />
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={`No attendance for ${formatMonthLabel(selectedMonth)}`}
          description="Check-ins for this month will show up here."
        />
      ) : (
        summaries.map((staff) => <StaffCard key={staff.user_id} staff={staff} />)
      )}
    </div>
  );
}

function Metric({ label, value, hint, className }: { label: string; value: string | number; hint?: string; className?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', className)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StaffCard({ staff }: { staff: StaffSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {staff.user_name}
          {staff.job_role.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
        </CardTitle>
        <CardDescription>Break: {getBreakForRoles(staff.job_role)} min a day</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric
            label="Days worked"
            value={staff.totalDaysWorked}
            hint={staff.wfhDays > 0 ? `${staff.onSiteDays} on site · ${staff.wfhDays} WFH` : undefined}
          />
          <Metric label="Gross hours" value={formatH(staff.totalGrossHours)} />
          <Metric label="Breaks" value={formatH(staff.totalBreakHours)} />
          <Metric label="Net hours" value={formatH(staff.totalNetHours)} className="text-primary" />
        </div>

        <div className="divide-y rounded-lg border">
          {staff.days.map((day) => {
            const firstIn = day.entries[0]?.check_in_at;
            const lastOut = day.entries[day.entries.length - 1]?.check_out_at;
            return (
              <Collapsible key={day.date}>
                <CollapsibleTrigger className="group flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{formatDateLabel(day.date)}</span>
                      {day.entries.some((e) => e.is_wfh) && <House className="size-3.5 text-muted-foreground" aria-label="Worked from home" />}
                      {day.entries.some((e) => !e.is_wfh) && <MapPin className="size-3.5 text-muted-foreground" aria-label="On site" />}
                      {day.entries.some((e) => e.auto_checked_out) && <Badge className="bg-warning/15 text-warning">Auto checked out</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {firstIn && formatTime(firstIn)}–{lastOut ? formatTime(lastOut) : 'ongoing'}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {day.totalNetHours > 0 ? formatH(day.totalNetHours) : '—'}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 px-3 pb-3 sm:pl-10">
                    {day.entries.map((entry) => {
                      const h = calcEntryHours(entry);
                      return (
                        <div key={entry.id} className="flex flex-col gap-1 rounded-lg bg-muted/60 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            {entry.is_wfh
                              ? <House className="size-4 text-muted-foreground" aria-hidden="true" />
                              : <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />}
                            <span>{entry.is_wfh ? 'Work from home' : entry.location_name}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                            <span>
                              {formatTime(entry.check_in_at)}–{entry.check_out_at ? formatTime(entry.check_out_at) : <span className="font-medium text-primary">ongoing</span>}
                            </span>
                            {!h.isOpen && (
                              <>
                                <span>Gross {formatH(h.gross)}</span>
                                <span>Break {formatH(h.breakH)}</span>
                                <span className="font-semibold text-foreground">Net {formatH(h.net)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
