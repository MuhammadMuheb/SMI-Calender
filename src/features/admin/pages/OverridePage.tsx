import { TranslatedText } from '@/i18n/LanguageContext';
import { useState } from 'react';
import { useLeave } from '@/features/leave/LeaveContext';
import { useAuth } from '@/features/auth/AuthContext';
import type { LeaveStatus } from '@/models/leave';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
export default function OverridePage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { requests, override } = useLeave();
  const [id, setId] = useState('');
  const [status, setStatus] = useState<LeaveStatus>('approved');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (user?.role !== 'super_admin') return null;
  return <div className="space-y-4"><PageHeader title="Override leave decision" description="Change a decision with a recorded reason." onBack={onBack} />
    <form className="grid max-w-xl gap-4" onSubmit={async e => { e.preventDefault(); setBusy(true); try { const error = await override(id, status, user, note); if (error) toast.error(error); else { toast.success('Decision updated'); setNote(''); } } finally { setBusy(false); } }}>
      <label className="grid gap-1"><TranslatedText text="Request" /><select required className="rounded border p-2" value={id} onChange={e => setId(e.target.value)}><option value="">Choose request</option>{requests.map(r => <option key={r.id} value={r.id}>{r.userRef.displayName} — {r.date} — {r.status}</option>)}</select></label>
      <label className="grid gap-1"><TranslatedText text="New decision" /><select className="rounded border p-2" value={status} onChange={e => setStatus(e.target.value as LeaveStatus)}>{['approved','rejected','cancelled','pending'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="grid gap-1"><TranslatedText text="Reason" /><Input required value={note} onChange={e => setNote(e.target.value)} /></label>
      <Button disabled={busy || !id || !note.trim()}><TranslatedText text="Save override" /></Button>
    </form></div>;
}
