import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { serverApi } from '@/lib/serverApi';
import { useWorkArrangements } from './WorkArrangementsContext';
import { WorkModeBadge, MODE_LABELS } from './WorkModeBadge';
import { WorkSelect } from './WorkFields';
import { WorkSummary } from './WorkSummary';
import { ArrangementForm } from './ArrangementForm';
import { WorkPolicyEditor } from './WorkPolicyEditor';
import { WorkAttendanceReport } from './WorkAttendanceReport';
import type { Arrangement } from '../../../shared/work-arrangements.mjs';
export default function WorkArrangementsPage() {
  const { user } = useAuth();
  const { arrangements, loading, error, refresh, mutate } = useWorkArrangements();
  const [filter, setFilter] = useState('active');
  const [form, setForm] = useState<{ initial?: Arrangement; parent?: Arrangement; assign?: boolean } | null>(null);
  const [decision, setDecision] = useState<{ item: Arrangement; action: string } | null>(null);
  const [history, setHistory] = useState<Arrangement | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const manager = user?.role === 'manager' || user?.role === 'super_admin';
  const canManage = (a: Arrangement) => user?.role === 'super_admin' || user?.role === 'manager' && a.userId !== user.id && a.requesterRole === 'staff';
  async function decide() {
    if (!decision) return;
    setBusy(true);
    try { await mutate({ action: decision.action, id: decision.item.id, expectedVersion: decision.item.version, note }); toast.success('Work arrangement updated'); setDecision(null); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to save'); }
    finally { setBusy(false); }
  }
  const visible = arrangements.filter(a => filter === 'all' || filter === 'mine' && a.userId === user?.id || filter === 'active' && ['pending', 'approved'].includes(a.status) || a.status === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <div className="space-y-5"><PageHeader title="Work arrangements" description="Plan where you work, request changes and keep your team informed." actions={<div className="flex flex-wrap gap-2"><Button onClick={() => setForm({})}>Request arrangement</Button>{manager && <Button variant="outline" onClick={() => setForm({ assign: true })}>Assign to employee</Button>}</div>} />
    <Tabs defaultValue="requests"><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="requests">Requests & schedule</TabsTrigger>{manager && <TabsTrigger value="reports">Attendance report</TabsTrigger>}{user?.role === 'super_admin' && <TabsTrigger value="policy">Policies & eligibility</TabsTrigger>}</TabsList>
      <TabsContent value="requests" className="space-y-4"><WorkSummary />
        <div className="flex items-end gap-3"><div className="flex-1"><WorkSelect label="Show requests" value={filter} onChange={e => setFilter(e.target.value)}>{[['active', 'Pending and approved'], ['pending', 'Pending approval'], ['mine', 'My requests'], ['all', 'All history'], ['rejected', 'Rejected'], ['revoked', 'Revoked'], ['cancelled', 'Cancelled']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</WorkSelect></div><Button variant="outline" onClick={() => void refresh()}>Refresh</Button></div>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {loading ? <p role="status">Loading requests…</p> : !visible.length ? <p className="rounded-lg border p-6 text-muted-foreground">No work arrangements in this view.</p> : visible.map(a => <Card key={a.id}><CardHeader><CardTitle className="flex flex-wrap items-center gap-2"><span className="min-w-0 break-words">{a.userName}</span><WorkModeBadge mode={a.mode} /><Badge variant={a.status === 'rejected' || a.status === 'revoked' ? 'destructive' : 'outline'}>{a.status}</Badge></CardTitle></CardHeader><CardContent className="space-y-3">
          <p className="text-sm">{a.startDate}{a.endDate && a.endDate !== a.startDate ? ` – ${a.endDate}` : !a.endDate ? ' onwards' : ''} · {a.portion === 'full' ? 'Full day' : a.portion.toUpperCase()} · {a.kind}{a.parentId ? ' · Dated change' : ''}</p>
          <p className="text-sm text-muted-foreground">{a.shiftStart}–{a.shiftEnd} · {a.timezone}{a.location ? ` · ${a.location}` : ''}{a.city ? ` · ${a.city}, ${a.country}` : ''}</p>
          {a.mode === 'hybrid' && <p className="text-sm">{a.hybridStyle} · {a.weekdays.map(day => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]} ${MODE_LABELS[a.schedule[day]]}`).join(' · ')}</p>}
          <p className="whitespace-pre-wrap break-words text-sm">{a.reason}</p>{a.decisionNote && <p className="text-sm">Decision: {a.decisionNote}</p>}
          <div className="flex flex-wrap gap-2">
            {canManage(a) && a.status === 'pending' && <><Button onClick={() => { setDecision({ item: a, action: 'approve' }); setNote(''); }}>Approve</Button><Button variant="outline" onClick={() => setForm({ initial: a })}>Modify</Button><Button variant="outline" onClick={() => { setDecision({ item: a, action: 'reject' }); setNote(''); }}>Reject</Button></>}
            {a.status === 'approved' && (a.userId === user?.id || canManage(a)) && !a.parentId && <Button variant="outline" onClick={() => setForm({ parent: a, assign: a.userId !== user?.id })}>Dated change</Button>}
            {canManage(a) && a.status === 'approved' && <Button variant="outline" onClick={() => { setDecision({ item: a, action: 'revoke' }); setNote(''); }}>Revoke</Button>}
            {(a.userId === user?.id || canManage(a)) && ['pending', 'approved'].includes(a.status) && <Button variant="outline" onClick={() => { setDecision({ item: a, action: 'cancel' }); setNote(''); }}>Cancel arrangement</Button>}
            <Button variant="ghost" onClick={() => setHistory(a)}>Approval history</Button>
          </div>
        </CardContent></Card>)}
      </TabsContent>
      {manager && <TabsContent value="reports"><WorkAttendanceReport /></TabsContent>}
      {user?.role === 'super_admin' && <TabsContent value="policy"><WorkPolicyEditor /></TabsContent>}
    </Tabs>
    {form && <ArrangementForm {...form} onClose={() => setForm(null)} />}
    {decision && <ResponsiveDialog open onOpenChange={v => { if (!v && !busy) setDecision(null); }} title={`${decision.action[0].toUpperCase() + decision.action.slice(1)} arrangement`} description={`${decision.item.userName} · ${decision.item.startDate}. Cancellation and revocation take effect immediately; recorded attendance is retained.`} footer={<><Button variant="outline" disabled={busy} onClick={() => setDecision(null)}>Go back</Button><Button disabled={busy || decision.action !== 'approve' && !note.trim()} onClick={() => void decide()}>{busy ? 'Saving…' : 'Confirm decision'}</Button></>}><label className="space-y-2 text-sm font-medium">Decision note {decision.action === 'approve' ? '(optional)' : '(required)'}<Textarea className="text-base" value={note} maxLength={2000} onChange={e => setNote(e.target.value)} /></label></ResponsiveDialog>}
    {history && <HistoryDialog item={history} onClose={() => setHistory(null)} />}
  </div>;
}
function HistoryDialog({ item, onClose }: { item: Arrangement; onClose: () => void }) {
  const [events, setEvents] = useState<{ id: string; action: string; actorName: string; createdAt: string; note: string; after: Arrangement }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { let stopped = false; serverApi<{ history: typeof events }>('work-arrangements', { action: 'history', id: item.id }).then(r => { if (!stopped) setEvents(r.history); }).catch(e => { if (!stopped) setError(e.message); }).finally(() => { if (!stopped) setLoading(false); }); return () => { stopped = true; }; }, [item.id]);
  return <ResponsiveDialog open onOpenChange={onClose} title="Approval history" description={`${item.userName} · ${item.startDate}`}><div className="space-y-4">{loading && <p role="status">Loading history…</p>}{error && <p role="alert">{error}</p>}{events.map(e => <article key={e.id} className="space-y-1 border-b pb-3 text-sm"><p className="font-medium">{e.action} · {e.actorName}</p><time>{new Date(e.createdAt).toLocaleString()}</time><p>{e.after.startDate} – {e.after.endDate || 'Permanent'} · {MODE_LABELS[e.after.mode]} · {e.after.status}</p><p className="whitespace-pre-wrap break-words">{e.note}</p></article>)}</div></ResponsiveDialog>;
}
