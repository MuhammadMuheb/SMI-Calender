import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppData } from '@/app/AppDataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkArrangements } from './WorkArrangementsContext';
import { WorkInput, WorkSelect } from './WorkFields';
import { MODE_LABELS } from './WorkModeBadge';
import { addDays, localParts, type DailyMode } from '../../../shared/work-arrangements.mjs';
import type { CheckInData } from '@/features/attendance/services/checkInsService';
interface ReportCheck extends CheckInData { workDate?: string; timezone?: string; scheduledStart?: string; graceMinutes?: number }
export function WorkAttendanceReport() {
  const { users } = useAppData();
  const { slotsFor, departments, policy } = useWorkArrangements();
  const today = localParts(new Date(), policy.timezone).date;
  const [start, setStart] = useState(today.slice(0, 7) + '-01');
  const [end, setEnd] = useState(today);
  const [employee, setEmployee] = useState('all');
  const [department, setDepartment] = useState('all');
  const [mode, setMode] = useState('all');
  const [checks, setChecks] = useState<ReportCheck[]>([]);
  const [error, setError] = useState('');
  const validRange = start && end && start <= end && Date.parse(end) - Date.parse(start) <= 92 * 86400000;
  useEffect(() => {
    if (!validRange) return;
    return onSnapshot(query(collection(db, 'check_ins'), where('checkInAt', '>=', addDays(start, -1) + 'T00:00:00.000Z'), where('checkInAt', '<=', addDays(end, 2) + 'T00:00:00.000Z')),
      snap => { setChecks(snap.docs.map(d => ({ ...d.data(), id: d.id })) as ReportCheck[]); setError(''); }, () => setError('Unable to load attendance report'));
  }, [start, end, validRange]);
  const report = useMemo(() => {
    if (!validRange) return [];
    const result: { key: string; date: string; name: string; department: string; expected: string; actual: string; hours: string; status: string }[] = [];
    for (let date = start; date <= end; date = addDays(date, 1)) for (const user of users.filter(u => u.role !== 'spectator' && (employee === 'all' || u.id === employee) && (department === 'all' || departments[u.id] === department))) {
      const slots = slotsFor(user.id, date);
      if (mode !== 'all' && !slots.some(s => s.mode === mode || mode === 'hybrid' && s.hybrid)) continue;
      const own = checks.filter(c => c.userId === user.id && (c.workDate || localParts(c.checkInAt, c.timezone || policy.timezone).date) === date);
      const hours = own.reduce((sum, c) => sum + (c.checkOutAt ? Math.max(0, Date.parse(c.checkOutAt) - Date.parse(c.checkInAt)) / 3600000 : 0), 0);
      const expected = [...new Set(slots.map(s => MODE_LABELS[s.mode]))].join(' / ');
      const actual = [...new Set(own.map(c => MODE_LABELS[c.workType as DailyMode] || c.workType))].join(' / ');
      const late = own.some(c => c.scheduledStart && Date.parse(c.checkInAt) > Date.parse(c.scheduledStart) + (c.graceMinutes ?? 15) * 60000);
      result.push({ key: user.id + date, date, name: user.displayName, department: departments[user.id] || 'Unassigned', expected, actual: actual || '—', hours: hours.toFixed(1),
        status: own.some(c => !c.checkOutAt) ? 'Open check-in' : own.some(c => c.autoCheckedOut) ? 'Auto checked out' : late ? 'Late arrival' : own.length ? 'Recorded' : slots.every(s => s.mode === 'off') ? 'Time off' : date < today ? 'Missed check-in' : 'Not checked in yet' });
    }
    return result;
  }, [validRange, start, end, users, employee, department, departments, slotsFor, checks, mode, policy.timezone, today]);
  function download() {
    const cell = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" : '') + value.replaceAll('"', '""') + '"';
    const csv = [['Date', 'Employee', 'Department', 'Scheduled', 'Recorded', 'Closed hours', 'Status'], ...report.map(r => [r.date, r.name, r.department, r.expected, r.actual, r.hours, r.status])].map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `work-attendance-${start}-${end}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Card><CardHeader><CardTitle>Attendance by work arrangement</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><WorkInput label="From" type="date" value={start} onChange={e => setStart(e.target.value)} /><WorkInput label="Through" type="date" value={end} onChange={e => setEnd(e.target.value)} /><WorkSelect label="Employee" value={employee} onChange={e => setEmployee(e.target.value)}><option value="all">Everyone</option>{users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</WorkSelect><WorkSelect label="Department" value={department} onChange={e => setDepartment(e.target.value)}><option value="all">All departments</option>{[...new Set(Object.values(departments))].map(v => <option key={v}>{v}</option>)}</WorkSelect><WorkSelect label="Work arrangement" value={mode} onChange={e => setMode(e.target.value)}><option value="all">All arrangements</option>{Object.entries(MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</WorkSelect></div>
    {!validRange && <p role="alert">Choose a date range of up to 93 days.</p>}{error && <p role="alert" className="text-destructive">{error}</p>}
    <Button variant="outline" disabled={!validRange || !!error} onClick={download}>Download CSV</Button>
    <p className="text-sm text-muted-foreground">Hours total closed attendance segments only. Split work modes are recorded as separate segments. Times follow each approved arrangement’s timezone.</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Date', 'Employee', 'Scheduled', 'Recorded', 'Hours', 'Status'].map(h => <th className="whitespace-nowrap border-b p-2" key={h}>{h}</th>)}</tr></thead><tbody>{report.map(r => <tr key={r.key}>{[r.date, r.name, r.expected, r.actual, r.hours, r.status].map((v, i) => <td key={i} className="border-b p-2">{v}</td>)}</tr>)}</tbody></table></div>
    {validRange && !report.length && <p>No attendance rows match these filters.</p>}
  </CardContent></Card>;
}
