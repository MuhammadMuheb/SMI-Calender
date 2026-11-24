import { useState } from 'react';
import { toast } from 'sonner';
import { useAppData } from '@/app/AppDataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkArrangements } from './WorkArrangementsContext';
import { WorkDays, WorkFieldset, WorkInput, WorkSelect, WorkToggle } from './WorkFields';
import { MODE_LABELS } from './WorkModeBadge';
import { effectivePolicy, MODES, type WorkPolicy, type DailyMode } from '../../../shared/work-arrangements.mjs';
export function WorkPolicyEditor() {
  const { policy, loading } = useWorkArrangements();
  if (loading) return <p role="status">Loading policy…</p>;
  return <PolicyForm key={policy.version} initial={policy} />;
}
function PolicyForm({ initial }: { initial: WorkPolicy }) {
  const { users } = useAppData();
  const { mutate } = useWorkArrangements();
  const [draft, setDraft] = useState(initial);
  const [employee, setEmployee] = useState('global');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = effectivePolicy(draft, employee === 'global' ? undefined : employee);
  function update<K extends keyof WorkPolicy>(key: K, value: WorkPolicy[K]) {
    setDraft(prev => employee === 'global' ? { ...prev, [key]: value } : { ...prev, employees: { ...prev.employees, [employee]: { ...prev.employees?.[employee], [key]: value } } });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await mutate({ action: 'policy', expectedVersion: initial.version, data: draft }); toast.success('Work policies saved'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save'); }
    finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>Policies & eligibility</CardTitle></CardHeader><CardContent><form className="space-y-5" onSubmit={save}>
    <p className="text-sm text-muted-foreground">Global defaults apply to everyone. Employee overrides take priority. New requests and approvals use the latest policy; existing approvals remain scheduled until changed or revoked. Location and attendance checks use the current policy.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <WorkSelect label="Configure" value={employee} onChange={e => setEmployee(e.target.value)}><option value="global">Everyone (defaults)</option>{users.filter(u => u.role !== 'spectator').map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</WorkSelect>
    {employee !== 'global' && <><WorkInput label="Department" value={current.department || ''} onChange={e => update('department', e.target.value)} maxLength={80} /><Button type="button" variant="outline" onClick={() => setDraft(prev => ({ ...prev, employees: Object.fromEntries(Object.entries(prev.employees || {}).filter(([id]) => id !== employee)) }))}>Reset employee to defaults</Button></>}
    <WorkFieldset label="Eligibility and approval">
      <WorkToggle label="Eligible for off-site work" checked={current.eligible} onChange={v => update('eligible', v)} />
      <WorkToggle label="Require approval for employee requests" checked={current.approvalRequired} onChange={v => update('approvalRequired', v)} />
      <div className="flex flex-wrap gap-x-5">{MODES.filter(m => m !== 'on_site').map(mode => <WorkToggle key={mode} label={MODE_LABELS[mode]} checked={current.allowedModes.includes(mode)} onChange={v => update('allowedModes', v ? [...current.allowedModes, mode] : current.allowedModes.filter(m => m !== mode))} />)}</div>
      <WorkInput label="WFH days per month (blank = unlimited; half days count as 0.5)" type="number" min={0} max={31} value={current.maxWfhDaysPerMonth ?? ''} onChange={e => update('maxWfhDaysPerMonth', e.target.value === '' ? null : Number(e.target.value))} />
    </WorkFieldset>
    <WorkDays label="Usual working days" value={current.workingDays} onChange={v => update('workingDays', v)} />
    <WorkDays label="Mandatory office days" value={current.mandatoryOfficeDays} onChange={v => update('mandatoryOfficeDays', v)} />
    <WorkInput label="Minimum full office days per week" type="number" min={0} max={7} value={current.minOfficeDays} onChange={e => update('minOfficeDays', Number(e.target.value))} />
    <p className="text-sm text-muted-foreground">Approved leave, holidays and the first Sunday of the month reduce the available working days.</p>
    <WorkFieldset label="Remote work">
      <WorkToggle label="Allow remote work in another city or country" checked={current.remoteAllowed} onChange={v => update('remoteAllowed', v)} />
      <WorkInput label="Allowed countries (comma-separated two-letter codes; blank = all)" placeholder="IT, GB, PK" value={current.allowedCountries.join(',')} onChange={e => update('allowedCountries', e.target.value ? e.target.value.toUpperCase().split(',').map(v => v.trim()) : [])} />
    </WorkFieldset>
    <WorkFieldset label="Attendance validation">
      <div className="grid gap-3 sm:grid-cols-3">{(['on_site', 'wfh', 'remote'] as DailyMode[]).map(mode => <WorkSelect key={mode} label={MODE_LABELS[mode]} value={current.locationValidation[mode]} onChange={e => update('locationValidation', { ...current.locationValidation, [mode]: e.target.value as 'none' | 'office' | 'coordinates' })}><option value="none">No GPS required</option>{mode === 'on_site' ? <option value="office">Office geofence</option> : <option value="coordinates">Record GPS coordinates</option>}</WorkSelect>)}</div>
      <p className="text-sm text-muted-foreground">Off-site GPS records the reported coordinates; it does not certify a country or home address.</p>
      <WorkToggle label="Enforce approved check-in hours" checked={current.enforceHours} onChange={v => update('enforceHours', v)} />
      <div className="grid gap-3 sm:grid-cols-2"><WorkInput label="Early check-in allowance (minutes)" type="number" min={0} max={240} value={current.earlyCheckInMinutes} onChange={e => update('earlyCheckInMinutes', Number(e.target.value))} /><WorkInput label="Late / missing check-in grace (minutes)" type="number" min={0} max={120} value={current.graceMinutes} onChange={e => update('graceMinutes', Number(e.target.value))} /></div>
    </WorkFieldset>
    <WorkFieldset label="Default hours and timezone"><WorkInput label="IANA timezone" required value={current.timezone} onChange={e => update('timezone', e.target.value)} /><div className="grid gap-3 sm:grid-cols-3"><WorkInput label="Start" type="time" required value={current.shiftStart} onChange={e => update('shiftStart', e.target.value)} /><WorkInput label="End" type="time" required value={current.shiftEnd} onChange={e => update('shiftEnd', e.target.value)} /><WorkInput label="Half-day boundary" type="time" required value={current.splitTime} onChange={e => update('splitTime', e.target.value)} /></div><p className="text-sm text-muted-foreground">Without an arrangement, attendance uses the primary job role’s shift. An employee override takes priority.</p></WorkFieldset>
    <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save all policy changes'}</Button>
  </form></CardContent></Card>;
}
