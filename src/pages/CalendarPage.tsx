import { useState, useMemo, useEffect } from 'react';
import { CalendarTile, Card, Button, Icons } from '../components/ui';
import { theme } from '../config/theme';
import { alpha } from '../utils/themeColor';
import { ROLES } from '../config/roles';
import { useAuth } from '../context/AuthContext';
import { useLeave } from '../context/LeaveContext';
import { useAppData } from '../context/AppDataContext';
import { useCalendarData } from '../hooks/useCalendarData';
import { checkStaffingForDate } from '../services/staffingService';
import { supabase } from '../lib/supabase';
import DayDetailModal from './DayDetailModal';
import RequestFormModal from './RequestFormModal';
import type { LeaveRequest, LeaveType } from '../models/leave';
import type { TourAssignment } from '../models/tourAssignment';
import type { StaffUser } from '../models/user';
import { LEAVE_TYPE_LABELS } from '../models/leave';
import {
  buildMonthGrid, formatMonthLabel, todayStr,
  prevMonth as getPrevMonth, nextMonth as getNextMonth, DAY_HEADERS,
} from '../utils/dateUtils';

export default function CalendarPage() {
  const { user } = useAuth();
  const { requests } = useLeave();
  const { jobRoles, roleAssignments, staffingRules, holidays, specialDays, tourAssignments, users, schedules } = useAppData();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const { summaryMap } = useCalendarData(year, month, requests);
  const grid = buildMonthGrid(year, month);
  const monthLabel = formatMonthLabel(year, month);
  const isRichView = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.MANAGER;

  // The day whose details show inline below the grid — defaults to today.
  const [previewDate, setPreviewDate] = useState<string>(todayStr());
  // The day the full interactive modal (swap / assign / cancel) is open for.
  // Tapping a tile sets both at once, so one tap still opens the modal like before.
  const [manageDate, setManageDate] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const userOffDates = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(requests.filter((r) => r.userId === user.id && r.status === 'approved').map((r) => r.date));
  }, [requests, user]);

  const hasLeaveDates = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const dates = new Set<string>();
    for (const r of requests) {
      if (r.status === 'approved' && r.date.startsWith(monthPrefix)) dates.add(r.date);
    }
    return dates;
  }, [requests, year, month]);

  // Compute staffing level per day
  const staffingMap = useMemo(() => {
    const map = new Map<string, 'good' | 'exact' | 'low'>();
    if (staffingRules.length === 0) return map;

    const roleNames: Record<string, string> = {};
    for (const r of jobRoles) roleNames[r.id] = r.name;

    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
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

  const handlePrev = () => { const p = getPrevMonth(year, month); setYear(p.year); setMonth(p.month); };
  const handleNext = () => { const n = getNextMonth(year, month); setYear(n.year); setMonth(n.month); };
  const handleToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setPreviewDate(todayStr()); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>{monthLabel}</h2>
          <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>Tap a day for details</p>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={handleToday} className="px-2 h-8 rounded-lg flex items-center justify-center cursor-pointer text-[10px] font-medium"
            style={{ color: theme.colors.primary, backgroundColor: theme.colors.bgElevated }}>Today</button>
          <button type="button" onClick={handlePrev} aria-label="Previous month" className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ color: theme.colors.gray, backgroundColor: theme.colors.bgElevated }}><span aria-hidden="true">{Icons.chevronLeft}</span></button>
          <button type="button" onClick={handleNext} aria-label="Next month" className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ color: theme.colors.gray, backgroundColor: theme.colors.bgElevated }}><span aria-hidden="true">{Icons.chevronRight}</span></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <LegendItem color={theme.colors.success} shape="circle" label="Tour guides scheduled" />
        <LegendItem color={theme.colors.success} shape="bar" label="Well staffed" />
        <LegendItem color={theme.colors.warning} shape="bar" label="Exact minimum" />
        <LegendItem color={theme.colors.danger} shape="bar" label="Low staff" />
        <LegendItem color="#EF4444" shape="text" label="Staff off" />
        {isRichView && <>
          <LegendItem color={theme.colors.secondary} shape="circle" label="Holiday" />
          <LegendItem color={theme.colors.warning} shape="square" label="Special" />
        </>}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold py-0.5" style={{ color: theme.colors.grayDark }}>{d}</div>
        ))}
        {grid.map((tile) => (
          <CalendarTile
            key={tile.dateStr}
            day={tile.day}
            dateStr={tile.dateStr}
            isToday={tile.isToday}
            isCurrentMonth={tile.isCurrentMonth}
            isWeekend={tile.isWeekend}
            summary={summaryMap.get(tile.dateStr) ?? null}
            isUserOff={userOffDates.has(tile.dateStr)}
            hasLeave={tile.isCurrentMonth && hasLeaveDates.has(tile.dateStr)}
            hasScheduledGuides={tile.isCurrentMonth && (summaryMap.get(tile.dateStr)?.scheduledGuidesCount ?? 0) > 0}
            staffingLevel={tile.isCurrentMonth ? (staffingMap.get(tile.dateStr) || null) : null}
            onClick={() => {
              if (!tile.isCurrentMonth) return;
              setPreviewDate(tile.dateStr);
              setManageDate(tile.dateStr);
            }}
          />
        ))}
      </div>

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

      <Button variant="primary" fullWidth icon={Icons.plus} onClick={() => setShowRequestForm(true)}>
        Request Time Off
      </Button>

      {isRichView && <MonthSummaryCard summaryMap={summaryMap} />}

      <DayDetailModal date={manageDate} open={!!manageDate} onClose={() => setManageDate(null)} />
      <RequestFormModal open={showRequestForm} onClose={() => setShowRequestForm(false)} />
    </div>
  );
}

function LegendItem({ color, shape, label }: { color: string; shape: 'circle' | 'square' | 'bar' | 'text'; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {shape === 'circle' && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
      {shape === 'square' && <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />}
      {shape === 'bar' && <div className="w-3 h-[3px] rounded-full" style={{ backgroundColor: color }} />}
      {shape === 'text' && <span className="text-[9px] font-bold" style={{ color }}>N</span>}
      <span className="text-[10px]" style={{ color: theme.colors.grayDark }}>{label}</span>
    </div>
  );
}

/** Colors reuse the exact same legend tokens this page already defines above — no new hues. */
function pillStyleFor(type: LeaveType) {
  if (type === 'sick_day') return { color: theme.colors.secondary, border: theme.colors.secondary };
  if (type === 'special_day') return { color: theme.colors.warning, border: theme.colors.warning };
  if (type === 'paid_vacation') return { color: theme.colors.white, border: theme.colors.border };
  return { color: theme.colors.primary, border: theme.colors.primary }; // regular_day_off, auto_assigned, auto_sunday
}

/** The neutral "someone is off" pill shown to peers who aren't allowed to see the actual leave type. */
const NEUTRAL_PILL = { color: theme.colors.primary, border: theme.colors.primary };

/** Live in-office / remote count for one date, from real check-in records. */
function useDayAttendanceCounts(date: string) {
  const [counts, setCounts] = useState<{ office: number; remote: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCounts(null);
      const startOfDay = `${date}T00:00:00+00:00`;
      const endOfDay = `${date}T23:59:59+00:00`;
      const { data } = await supabase
        .from('check_ins').select('is_wfh')
        .gte('check_in_at', startOfDay).lte('check_in_at', endOfDay);
      if (cancelled) return;
      const remote = (data ?? []).filter((r) => r.is_wfh).length;
      const office = (data ?? []).length - remote;
      setCounts({ office, remote });
    }
    load();
    return () => { cancelled = true; };
  }, [date]);

  return counts;
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
  schedules: import('../models/schedule').Schedule[];
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

  // Get scheduled guides for this date
  const daySchedules = schedules.filter((s: any) => s.date === date);
  const scheduledGuides = [...new Set(daySchedules.map((s: any) => s.guide))].sort();

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isEmpty = approved.length === 0 && pending.length === 0 && !holiday && !special && scheduledGuides.length === 0;
  const attendance = useDayAttendanceCounts(date);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: theme.colors.white }}>{dateLabel}</h3>
        <button type="button" onClick={onManage} aria-label={`Manage ${dateLabel}`} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
          style={{ color: theme.colors.primary, backgroundColor: theme.colors.bgCard }}>
          <span aria-hidden="true">{Icons.clock}</span>
        </button>
      </div>

      {attendance && (attendance.office > 0 || attendance.remote > 0 || approved.length > 0) && (
        <div className="flex items-center gap-3 mb-3 pb-3 flex-wrap" style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
          <SummaryPill color={theme.colors.primary} label="In Office" value={attendance.office} />
          <SummaryPill color={theme.colors.white} label="Remote" value={attendance.remote} />
          <SummaryPill color={theme.colors.secondary} label="On Leave" value={approved.length} />
        </div>
      )}

      {holiday && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg"
          style={{ backgroundColor: alpha(theme.colors.secondary, '12'), border: `1px solid ${alpha(theme.colors.secondary, '30')}` }}>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.secondary }} />
          <span className="text-[10px] font-medium" style={{ color: theme.colors.secondary }}>{holiday.name}</span>
        </div>
      )}
      {special && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg"
          style={{ backgroundColor: alpha(theme.colors.warning, '12'), border: `1px solid ${alpha(theme.colors.warning, '30')}` }}>
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: theme.colors.warning }} />
          <span className="text-[10px] font-medium" style={{ color: theme.colors.warning }}>{special.name}</span>
        </div>
      )}

      {scheduledGuides.length > 0 && (
        <div className="mb-3 pb-3" style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
          <p className="text-[9px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: theme.colors.grayDark }}>📍 Tour Guides Scheduled ({scheduledGuides.length})</p>
          <div className="space-y-1.5">
            {scheduledGuides.map((guide: string) => (
              <div key={guide} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ backgroundColor: alpha(theme.colors.primary, '10'), border: `1px solid ${alpha(theme.colors.primary, '20')}` }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: alpha(theme.colors.primary, '30'), color: theme.colors.primaryLight }}>
                  {guide[0]?.toUpperCase()}
                </div>
                <p className="text-xs font-medium" style={{ color: theme.colors.white }}>{guide}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {dayTours.length > 0 && (
        <div className="mb-3 pb-3" style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
          <p className="text-[9px] font-semibold mb-1.5" style={{ color: theme.colors.grayDark }}>SCHEDULED ON TOUR</p>
          <div className="flex flex-wrap gap-1.5">
            {dayTours.map((t) => {
              const staffMember = users.find((u) => u.id === t.userId);
              return (
                <span key={t.id} className="text-[10px] font-medium px-2 py-1 rounded-full"
                  style={{ color: theme.colors.primary, border: `1px solid ${theme.colors.primary}` }}>
                  {staffMember?.displayName ?? t.userId}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="h-14 flex items-center justify-center rounded-lg" style={{ border: `1px dashed ${theme.colors.border}` }}>
          <p className="text-xs" style={{ color: theme.colors.grayDark }}>Everyone is working this day</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {[...approved, ...pending].map((r) => {
            const canSeeType = viewerCanSeeTypes || r.userId === viewerId;
            const pill = canSeeType ? pillStyleFor(r.leaveType) : NEUTRAL_PILL;
            const label = canSeeType ? LEAVE_TYPE_LABELS[r.leaveType] : 'Off';
            const isPending = r.status === 'pending';
            return (
              <div key={r.id} className="flex items-center justify-between py-2 px-2.5 rounded-lg"
                style={{ backgroundColor: theme.colors.bgCard, borderLeft: `3px solid ${pill.border}`, opacity: isPending ? 0.7 : 1 }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: theme.colors.bgElevated, color: theme.colors.white, border: `1px solid ${theme.colors.border}` }}>
                    {r.userRef.displayName[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: theme.colors.white }}>{r.userRef.displayName}</p>
                    <p className="text-[9px]" style={{ color: theme.colors.grayDark }}>{isPending ? 'Awaiting approval' : 'Full day'}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-[9px] font-semibold px-2 py-1 rounded-full inline-block"
                    style={{ color: pill.color, border: `1px solid ${pill.border}` }}>
                    {label}
                  </span>
                  <p className="text-[8px] mt-1" style={{ color: theme.colors.grayDark }}>1 day off</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" onClick={onManage} className="w-full mt-3 py-2 rounded-lg text-[11px] font-medium cursor-pointer"
        style={{ border: `1px solid ${theme.colors.border}`, color: theme.colors.primary }}>
        Manage this day →
      </button>
    </Card>
  );
}

function SummaryPill({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden="true" className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[10px]" style={{ color: theme.colors.grayDark }}>
        {label} <span className="font-bold" style={{ color: theme.colors.white }}>{value}</span>
      </span>
    </div>
  );
}

function MonthSummaryCard({ summaryMap }: { summaryMap: Map<string, import('../models/calendar').DaySummary> }) {
  const values = Array.from(summaryMap.values());
  const holidays = values.filter((s) => s.isHoliday).length;
  const specialDays = values.filter((s) => s.isSpecialDay).length;
  const warningDays = values.filter((s) => s.hasStaffingWarning).length;
  const totalPending = values.reduce((sum, s) => sum + s.pendingRequests, 0);
  return (
    <Card title="Month Overview">
      <div className="grid grid-cols-2 gap-2">
        <SummaryStat label="Holidays" value={holidays} color={theme.colors.secondary} />
        <SummaryStat label="Special Days" value={specialDays} color={theme.colors.warning} />
        <SummaryStat label="Low Staff Days" value={warningDays} color={theme.colors.danger} />
        <SummaryStat label="Pending Requests" value={totalPending} color={theme.colors.primaryLight} />
      </div>
    </Card>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-lg font-bold" style={{ color }}>{value}</span>
      <span className="text-[10px]" style={{ color: theme.colors.grayDark }}>{label}</span>
    </div>
  );
}
