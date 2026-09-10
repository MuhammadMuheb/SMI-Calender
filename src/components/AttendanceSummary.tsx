import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { exportAttendanceCSV } from '../utils/attendanceUtils';

const BREAK_MINUTES: Record<string, number> = { 'Check In': 60, 'Back Office': 30, 'Back Office Extra': 30, 'Office': 30 };

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

export default function AttendanceSummary({ currentUserId, currentUserRole, currentUserJobRoles: _currentUserJobRoles }: AttendanceSummaryProps) {
  const isAdmin = currentUserRole === 'super_admin' || currentUserRole === 'manager';
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; });
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<{ id: string; display_name: string; job_role: string[] }[]>([]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const result = await exportAttendanceCSV(year, month);
      if (result === null) alert('No attendance records for this month.');
    } catch (e) {
      console.error('Export error:', e);
      alert('Export failed. Please try again.');
    }
    setExporting(false);
  }

  useEffect(() => {
    if (!isAdmin) return;
    async function fetchStaff() { const { data } = await supabase.from('users').select('id, display_name, job_role').order('display_name'); if (data) setStaffList(data); }
    fetchStaff();
  }, [isAdmin]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    let query = supabase.from('check_ins').select('id, user_id, check_in_at, check_out_at, is_wfh, work_type, auto_checked_out, users(display_name, role, job_role), locations(name)')
      .gte('check_in_at', startDate.toISOString()).lte('check_in_at', endDate.toISOString()).order('check_in_at', { ascending: true });
    if (!isAdmin) { query = query.eq('user_id', currentUserId); } else if (selectedStaffId) { query = query.eq('user_id', selectedStaffId); }
    const { data } = await query;
    if (data) {
      const mapped: AttendanceRow[] = data.map((r: any) => ({
        id: r.id, user_id: r.user_id, user_name: r.users?.display_name || 'Unknown', role: r.users?.role || 'staff',
        job_role: r.users?.job_role || ['Office'], location_name: r.locations?.name || 'Unknown',
        check_in_at: r.check_in_at, check_out_at: r.check_out_at, is_wfh: r.is_wfh, work_type: r.work_type || 'on_site', auto_checked_out: r.auto_checked_out || false,
      }));
      setRecords(mapped);
    }
    setLoading(false);
  }, [selectedMonth, selectedStaffId, isAdmin, currentUserId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  function calcEntryHours(entry: AttendanceRow) {
    if (!entry.check_out_at) return { gross: 0, breakH: 0, net: 0, isOpen: true };
    const grossMs = new Date(entry.check_out_at).getTime() - new Date(entry.check_in_at).getTime();
    const grossH = grossMs / 3600000;
    const breakMin = getBreakForRoles(entry.job_role);
    const breakH = breakMin / 60;
    return { gross: grossH, breakH, net: Math.max(grossH - breakH, 0), isOpen: false };
  }

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
        const entries = byDate.get(date)!; let dayGross = 0, dayBreak = 0, dayNet = 0, hasWfh = false, hasOnSite = false;
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
    const count = isAdmin ? 12 : 1;
    for (let i = 0; i < count; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
    return options;
  }, [isAdmin]);

  function formatMonthLabel(ym: string) { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
  function formatTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function formatH(h: number) { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`; }
  function formatDateLabel(dateStr: string) { const d = new Date(dateStr + 'T00:00:00'); return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function toggleDate(key: string) { setExpandedDates((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }

  function getRoleBadges(roles: string[]) {
    const colors: Record<string, string> = { 'Check In': 'bg-sky-100 text-sky-700', 'Back Office': 'bg-amber-100 text-amber-700', 'Back Office Extra': 'bg-orange-100 text-orange-700', 'Office': 'bg-indigo-100 text-indigo-700' };
    return (roles || []).map((r) => <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[r] || 'bg-gray-100 text-gray-700'}`}>{r}</span>);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">📊 Attendance Summary</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
            {monthOptions.map((m) => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
          {isAdmin && (
            <select value={selectedStaffId || ''} onChange={(e) => setSelectedStaffId(e.target.value || null)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">All Staff</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.display_name} ({(s.job_role || []).join(', ')})</option>)}
            </select>
          )}
          {isAdmin && (
            <button onClick={handleExport} disabled={exporting} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium">
              {exporting ? 'Exporting...' : '⬇️ Export CSV'}
            </button>
          )}
        </div>
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading attendance data...</div> : summaries.length === 0 ? <div className="text-center py-8"><p className="text-gray-400 text-lg">No attendance records for {formatMonthLabel(selectedMonth)}</p></div> : (
        summaries.map((staff) => (
          <div key={staff.user_id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-2 flex-wrap"><h4 className="text-base font-bold text-gray-900 dark:text-white">{staff.user_name}</h4>{getRoleBadges(staff.job_role)}</div>
                <span className="text-xs text-gray-400">Break: {getBreakForRoles(staff.job_role)} min/day</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-900/20"><p className="text-xl font-bold text-blue-700 dark:text-blue-300">{staff.totalDaysWorked}</p><p className="text-xs text-gray-500">Days Worked</p>{staff.wfhDays > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{staff.onSiteDays} on-site · {staff.wfhDays} WFH</p>}</div>
                <div className="rounded-xl p-3 bg-gray-50 dark:bg-gray-700/30"><p className="text-xl font-bold text-gray-700 dark:text-gray-300">{formatH(staff.totalGrossHours)}</p><p className="text-xs text-gray-500">Gross Hours</p></div>
                <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-900/20"><p className="text-xl font-bold text-amber-700 dark:text-amber-300">{formatH(staff.totalBreakHours)}</p><p className="text-xs text-gray-500">Total Breaks</p></div>
                <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-900/20"><p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatH(staff.totalNetHours)}</p><p className="text-xs text-gray-500">Net Hours</p></div>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {staff.days.map((day) => {
                const dateKey = `${staff.user_id}-${day.date}`;
                const isExpanded = expandedDates.has(dateKey);
                return (
                  <div key={day.date}>
                    <button onClick={() => toggleDate(dateKey)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-5">{isExpanded ? '▾' : '▸'}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDateLabel(day.date)}</span>
                        <div className="flex items-center gap-1.5">
                          {day.entries.some((e) => e.is_wfh) && <span className="text-xs">🏠</span>}
                          {day.entries.some((e) => !e.is_wfh) && <span className="text-xs">📍</span>}
                          {day.entries.some((e) => e.auto_checked_out) && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full">auto</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400">{day.entries[0] && formatTime(day.entries[0].check_in_at)} – {day.entries[day.entries.length - 1]?.check_out_at ? formatTime(day.entries[day.entries.length - 1].check_out_at!) : 'ongoing'}</span>
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 w-16 text-right">{day.totalNetHours > 0 ? formatH(day.totalNetHours) : '—'}</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-4 pl-14 space-y-2">
                        {day.entries.map((entry) => {
                          const h = calcEntryHours(entry);
                          return (
                            <div key={entry.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700/30 rounded-lg px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {entry.is_wfh ? <span className="text-purple-500">🏠</span> : <span className="text-blue-500">📍</span>}
                                <span className="text-gray-600 dark:text-gray-300">{entry.is_wfh ? 'Work from Home' : entry.location_name}</span>
                              </div>
                              <div className="flex items-center gap-4 text-xs">
                                <span className="text-gray-500">{formatTime(entry.check_in_at)} → {entry.check_out_at ? formatTime(entry.check_out_at) : <span className="text-emerald-500 font-medium">ongoing</span>}</span>
                                {!h.isOpen && (<><span className="text-gray-400">Gross: {formatH(h.gross)}</span><span className="text-amber-500">-{formatH(h.breakH)} break</span><span className="text-emerald-600 dark:text-emerald-400 font-semibold">= {formatH(h.net)}</span></>)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
