import { useState, useMemo } from 'react';
import { Card, Badge, Button } from '../../components/ui';
import { theme } from '../../config/theme';
import { useAuth } from '../../context/AuthContext';
import { useLeave } from '../../context/LeaveContext';
import { useAppData } from '../../context/AppDataContext';
import { runAutoAssignment, type AutoAssignPreview } from '../../services/autoAssignService';
import { checkStaffingForDate } from '../../services/staffingService';
import { insertAuditLog } from '../../services/supabaseService';
import type { LeaveRequest } from '../../models/leave';

interface Props { onBack: () => void }
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_HEADERS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

type DayHealth = 'green' | 'yellow' | 'red';

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
    for (const a of preview.assignments) {
      const u = users.find(x => x.id === a.userId);
      const role = (u?.role ?? 'staff') as 'staff' | 'manager' | 'super_admin';
      await directAssign(a.userId, a.userName, role, a.date, 'regular_day_off', user.displayName);
    }
    insertAuditLog({ actorId: user.id, actorName: user.displayName, action: 'auto_assignment_run',
      entityType: 'auto_assignment', entityId: 'batch',
      description: `Auto-assigned ${preview.totalAssigned} days for ${MONTH_NAMES[selMonth]} ${selYear}` });
    setApplied(true); setApplying(false);
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

  const { offMap, healthMap } = useMemo(() => {
    const oMap: Record<string, { name: string; isNew: boolean }[]> = {};
    const hMap: Record<string, { health: DayHealth; details: string[] }> = {};

    const simulated: LeaveRequest[] = [...existingApproved];
    if (preview) {
      for (const a of preview.assignments) {
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
    if (preview) {
      for (const a of preview.assignments) {
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
          details.push(`${s.jobRoleName}: ${s.scheduled}/${s.required}`);
        } else if (s.surplus === 0) {
          if (worst !== 'red') worst = 'yellow';
          details.push(`${s.jobRoleName}: ${s.scheduled}/${s.required}`);
        } else {
          details.push(`${s.jobRoleName}: ${s.scheduled}/${s.required}`);
        }
      }

      hMap[cell.dateStr] = { health: worst, details };
    }

    return { offMap: oMap, healthMap: hMap };
  }, [existingApproved, preview, calendarGrid, staffingRules, roleAssignments, roleNames, users]);

  const healthColors: Record<DayHealth, { bg: string; border: string }> = {
    green: { bg: '#10B98115', border: '#10B98140' },
    yellow: { bg: '#F59E0B15', border: '#F59E0B40' },
    red: { bg: '#EF444420', border: '#EF444450' },
  };

  const [tooltipDate, setTooltipDate] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>Back</button>
        <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Auto-Schedule</h2>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <button onClick={handlePrev} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ color: theme.colors.gray, backgroundColor: theme.colors.bg }}>Prev</button>
          <p className="text-sm font-bold" style={{ color: theme.colors.white }}>{MONTH_NAMES[selMonth]} {selYear}</p>
          <button onClick={handleNext} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ color: theme.colors.gray, backgroundColor: theme.colors.bg }}>Next</button>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_HEADERS.map(d => (
            <div key={d} className="text-center text-[9px] font-semibold" style={{ color: theme.colors.grayDark }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarGrid.map((cell, i) => {
            if (!cell.inMonth) return <div key={i} />;
            const offs = offMap[cell.dateStr] || [];
            const health = healthMap[cell.dateStr];
            const hc = health ? healthColors[health.health] : healthColors.green;
            const isFirstSunday = new Date(cell.dateStr + 'T00:00:00').getDay() === 0 && cell.day <= 7;
            const showTooltip = tooltipDate === cell.dateStr;

            return (
              <div key={i} className="rounded-md p-0.5 min-h-[52px] flex flex-col cursor-pointer relative"
                onClick={() => setTooltipDate(showTooltip ? null : cell.dateStr)}
                style={{ backgroundColor: hc.bg, border: `1.5px solid ${hc.border}` }}>
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10px] font-bold" style={{
                    color: isFirstSunday ? theme.colors.secondary : theme.colors.white
                  }}>{cell.day}</span>
                  {offs.length > 0 && (
                    <span className="text-[7px] font-bold px-1 rounded" style={{
                      backgroundColor: health?.health === 'red' ? '#EF444430' : health?.health === 'yellow' ? '#F59E0B30' : '#10B98130',
                      color: health?.health === 'red' ? '#EF4444' : health?.health === 'yellow' ? '#F59E0B' : '#10B981',
                    }}>{offs.length} off</span>
                  )}
                </div>
                <div className="flex-1 overflow-hidden mt-0.5">
                  {offs.slice(0, 3).map((o, j) => (
                    <p key={j} className="text-[6px] leading-tight truncate" style={{
                      color: o.isNew ? theme.colors.primaryLight : theme.colors.grayDark
                    }}>{o.isNew ? '+ ' : ''}{o.name}</p>
                  ))}
                  {offs.length > 3 && <p className="text-[6px]" style={{ color: theme.colors.grayDark }}>+{offs.length - 3} more</p>}
                </div>

                {showTooltip && health && (
                  <div className="absolute z-50 left-0 top-full mt-1 p-2 rounded-lg shadow-lg min-w-[140px]"
                    style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}>
                    <p className="text-[9px] font-bold mb-1" style={{ color: theme.colors.white }}>
                      {new Date(cell.dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    {health.details.map((d, j) => (
                      <p key={j} className="text-[8px]" style={{ color: theme.colors.gray }}>{d}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-2 pt-2 flex-wrap" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#10B98130', border: '1px solid #10B98150' }} />
            <span className="text-[8px]" style={{ color: theme.colors.grayDark }}>Above min</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#F59E0B30', border: '1px solid #F59E0B50' }} />
            <span className="text-[8px]" style={{ color: theme.colors.grayDark }}>Exact min</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#EF444430', border: '1px solid #EF444450' }} />
            <span className="text-[8px]" style={{ color: theme.colors.grayDark }}>Short staff</span>
          </div>
        </div>
        <p className="text-[8px] mt-1" style={{ color: theme.colors.grayDark }}>Tap any day to see role breakdown</p>
      </Card>

      {preview && (
        <Card title="Per Person">
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {preview.staffSummary.map((s) => (
              <div key={s.userId} className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: theme.colors.gray }}>{s.userName}</span>
                <div className="flex items-center gap-1">
                  {s.daysAssigned > 0 && <Badge color="primary" size="xs">+{s.daysAssigned}</Badge>}
                  {s.daysRemaining > 0 && <Badge color="warning" size="xs">{s.daysRemaining} left</Badge>}
                  {s.daysAssigned === 0 && s.daysRemaining === 0 && <Badge color="gray" size="xs">Full</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {preview?.warnings && preview.warnings.length > 0 && (
        <Card>
          <p className="text-[10px] font-semibold mb-1" style={{ color: theme.colors.warning }}>Warnings</p>
          {preview.warnings.map((w, i) => (
            <p key={i} className="text-[10px] mb-0.5" style={{ color: theme.colors.gray }}>{w}</p>
          ))}
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="outline" fullWidth onClick={handlePreview}>
          {preview ? 'Re-generate' : `Generate ${MONTH_NAMES[selMonth]}`}
        </Button>
        {preview && !applied && (
          <Button variant="primary" fullWidth onClick={handleApply} disabled={preview.totalAssigned === 0 || applying}>
            {applying ? 'Applying...' : `Apply (${preview.totalAssigned})`}
          </Button>
        )}
        {applied && (
          <div className="flex-1 flex items-center justify-center"><Badge color="success">Applied</Badge></div>
        )}
      </div>
    </div>
  );
}
