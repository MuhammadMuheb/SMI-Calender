import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppData } from '@/app/AppDataContext';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useWorkArrangements } from './WorkArrangementsContext';
import { WorkDays, WorkFieldset, WorkInput, WorkSelect, WEEKDAYS } from './WorkFields';
import { MODE_LABELS } from './WorkModeBadge';
import { MODES, localParts, type Arrangement, type DailyMode, type WorkMode } from '../../../shared/work-arrangements.mjs';
export function ArrangementForm({ initial, parent, assign = false, onClose }: { initial?: Arrangement; parent?: Arrangement; assign?: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { users } = useAppData();
  const { policy, mutate } = useWorkArrangements();
  const source = initial || parent;
  const [draft, setDraft] = useState({
    userId: source?.userId || (assign && user?.role === 'manager' ? users.find(u => u.role === 'staff')?.id || '' : user!.id), mode: source?.mode || 'wfh' as WorkMode,
    kind: initial?.kind || 'single' as Arrangement['kind'], startDate: initial?.startDate || localParts(new Date(), policy.timezone).date,
    endDate: initial?.endDate || localParts(new Date(), policy.timezone).date, portion: initial?.portion || 'full' as Arrangement['portion'],
    weekdays: source?.weekdays || policy.workingDays, schedule: source?.schedule || { 0: 'on_site', 1: 'on_site', 2: 'on_site', 3: 'wfh', 4: 'wfh', 5: 'on_site', 6: 'on_site' } as Record<number, DailyMode>,
    hybridStyle: source?.hybridStyle || 'fixed', timezone: source?.timezone || policy.timezone,
    shiftStart: source?.shiftStart || policy.shiftStart, shiftEnd: source?.shiftEnd || policy.shiftEnd, splitTime: source?.splitTime || policy.splitTime,
    location: source?.location || '', city: source?.city || '', country: source?.country || '', reason: initial?.reason || '', parentId: parent?.id || initial?.parentId || null,
  });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft(d => ({ ...d, [key]: value }));
  const employees = users.filter(u => u.role !== 'spectator' && (user!.role === 'super_admin' || u.role === 'staff'));
  const executive = users.find(u => u.id === draft.userId)?.weekendsOff;
  const weekdays = executive ? draft.weekdays.filter(d => d !== 0 && d !== 6) : draft.weekdays;
  const allowedModes = executive ? MODES.filter(m => m !== 'remote') : MODES;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await mutate({ action: initial ? 'modify' : assign ? 'assign' : 'request', id: initial?.id, expectedVersion: initial?.version, note,
        data: { ...draft, weekdays, endDate: draft.kind === 'permanent' ? null : draft.endDate, portion: draft.kind === 'half' ? draft.portion === 'full' ? 'am' : draft.portion : 'full' } });
      toast.success(initial ? 'Request modified. Review it before approval.' : assign ? 'Arrangement assigned' : 'Request submitted'); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save'); }
    finally { setBusy(false); }
  }
  const remote = draft.mode === 'remote' || draft.mode === 'hybrid' && Object.values(draft.schedule).includes('remote');
  return <ResponsiveDialog open onOpenChange={open => { if (!open && !busy) onClose(); }} title={initial ? 'Modify pending request' : parent ? 'Dated schedule change' : assign ? 'Assign work arrangement' : 'Request work arrangement'}
    description={parent ? 'This change overrides the original schedule only for the selected dates, after approval.' : 'Leave and public holidays take priority. Work arrangements do not use your leave balance.'} size="lg"
    footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button form="arrangement-form" type="submit" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : assign ? 'Assign arrangement' : 'Submit request'}</Button></>}>
    <form id="arrangement-form" className="space-y-4" onSubmit={submit}>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {assign && !parent && <WorkSelect label="Employee" value={draft.userId} onChange={e => set('userId', e.target.value)}>{employees.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</WorkSelect>}
      <div className="grid gap-3 sm:grid-cols-2">
        <WorkSelect label="Work mode" value={draft.mode} onChange={e => set('mode', e.target.value as WorkMode)}>{allowedModes.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}</WorkSelect>
        <WorkSelect label="Duration" value={draft.kind} onChange={e => set('kind', e.target.value as Arrangement['kind'])}>{[['single', 'Single day'], ['half', 'Half day'], ['multi', 'Multiple days'], ['recurring', 'Recurring weekly'], ['temporary', 'Temporary'], ['permanent', 'Permanent']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</WorkSelect>
        <WorkInput label="Start date" type="date" required value={draft.startDate} onChange={e => set('startDate', e.target.value)} />
        {!['single', 'half', 'permanent'].includes(draft.kind) && <WorkInput label="End date" type="date" required min={draft.startDate} value={draft.endDate || ''} onChange={e => set('endDate', e.target.value)} />}
        {draft.kind === 'half' && <WorkSelect label="Half day" value={draft.portion === 'full' ? 'am' : draft.portion} onChange={e => set('portion', e.target.value as Arrangement['portion'])}><option value="am">Morning</option><option value="pm">Afternoon</option></WorkSelect>}
      </div>
      {executive && <p className="text-sm text-muted-foreground">Executive schedule: Monday–Friday. Saturday and Sunday are off.</p>}
      <WorkDays label="Days covered each week" value={weekdays} allowed={executive ? [1, 2, 3, 4, 5] : undefined} onChange={v => set('weekdays', v)} />
      {draft.mode === 'hybrid' && <WorkFieldset label="Hybrid schedule">
        <WorkSelect label="Schedule type" value={draft.hybridStyle} onChange={e => set('hybridStyle', e.target.value as 'fixed' | 'flexible')}><option value="fixed">Fixed weekly pattern</option><option value="flexible">Flexible weekly pattern with dated changes</option></WorkSelect>
        <p className="text-sm text-muted-foreground">Set your usual pattern. For a flexible week, submit a dated change to choose different office days. Office requirements still apply.</p>
        <div className="grid gap-3 sm:grid-cols-2">{WEEKDAYS.filter(d => weekdays.includes(d.id)).map(d => <WorkSelect key={d.id} label={d.name} value={draft.schedule[d.id] || 'on_site'} onChange={e => set('schedule', { ...draft.schedule, [d.id]: e.target.value as DailyMode })}>{allowedModes.filter(m => m !== 'hybrid').map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}</WorkSelect>)}</div>
      </WorkFieldset>}
      <WorkFieldset label="Location and working hours">
        <WorkInput label="Working location (private to you and approvers)" required={draft.mode !== 'on_site'} placeholder="Home office, workspace or office name" value={draft.location} onChange={e => set('location', e.target.value)} maxLength={200} />
        {remote && <div className="grid grid-cols-2 gap-3"><WorkInput label="City" required value={draft.city} onChange={e => set('city', e.target.value)} /><WorkInput label="Country code" placeholder="IT" required minLength={2} maxLength={2} value={draft.country} onChange={e => set('country', e.target.value.toUpperCase())} /></div>}
        <WorkInput label="Timezone" list="work-timezones" required value={draft.timezone} onChange={e => set('timezone', e.target.value)} />
        <datalist id="work-timezones">{['Europe/Rome', 'Europe/London', 'Asia/Karachi', 'Asia/Dubai', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney'].map(z => <option key={z} value={z} />)}</datalist>
        <div className="grid gap-3 sm:grid-cols-3"><WorkInput label="Start time" type="time" required value={draft.shiftStart} onChange={e => set('shiftStart', e.target.value)} /><WorkInput label="End time" type="time" required value={draft.shiftEnd} onChange={e => set('shiftEnd', e.target.value)} /><WorkInput label="Half-day boundary" type="time" required value={draft.splitTime} onChange={e => set('splitTime', e.target.value)} /></div>
      </WorkFieldset>
      <label className="block space-y-2 text-sm font-medium">Reason<Textarea className="text-base" required value={draft.reason} onChange={e => set('reason', e.target.value)} maxLength={2000} /></label>
      {initial && <label className="block space-y-2 text-sm font-medium">Reason for modification<Textarea required className="text-base" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} /></label>}
    </form>
  </ResponsiveDialog>;
}
