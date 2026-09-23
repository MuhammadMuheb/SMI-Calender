import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TranslatedText } from '@/i18n/LanguageContext';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAppData } from '@/app/AppDataContext';
import { serverApi } from '@/lib/serverApi';
import type { CheckInData } from '../services/checkInsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
const localInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
export default function AttendanceEditor({ records, onSaved }: { records: CheckInData[]; onSaved: () => void }) {
  const { users } = useAppData();
  const [id, setId] = useState('');
  const [userId, setUserId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const [remote, setRemote] = useState(true);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState('');
  useEffect(() => onSnapshot(collection(db, 'locations'), snapshot => setLocations(snapshot.docs.map(d => ({ id: d.id, name: String(d.data().name || d.id) }))), () => toast.error('Unable to load locations')), []);
  const [busy, setBusy] = useState(false);
  const choose = (value: string) => {
    setId(value);
    const row = records.find(r => r.id === value);
    setUserId(row?.userId || ''); setCheckIn(row ? localInput(row.checkInAt) : ''); setCheckOut(row?.checkOutAt ? localInput(row.checkOutAt) : '');
    setRemote(row?.isWfh ?? true); setLocationId(row?.locationId || '');
  };
  const save = async (action: 'save' | 'delete') => {
    setBusy(true);
    try {
      await serverApi('attendance', { action, id: id || undefined, reason, data: { userId, checkInAt: checkIn ? new Date(checkIn).toISOString() : undefined, checkOutAt: checkOut ? new Date(checkOut).toISOString() : null, isWfh: remote, locationId } });
      toast.success(action === 'save' ? 'Attendance saved' : 'Check-in deleted'); choose(''); setReason(''); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to save'); }
    finally { setBusy(false); }
  };
  return <Card><CardHeader><CardTitle><TranslatedText text="Correct attendance" /></CardTitle></CardHeader><CardContent>
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void save('save'); }}>
      <label className="grid gap-1">Record<select className="rounded border p-2" value={id} onChange={e => choose(e.target.value)}><option value="">Add manual check-in</option>{records.map(r => <option key={r.id} value={r.id}>{r.userName} — {localInput(r.checkInAt)}</option>)}</select></label>
      <label className="grid gap-1"><TranslatedText text="Person" /><select required disabled={!!id} className="rounded border p-2" value={userId} onChange={e => setUserId(e.target.value)}><option value="">Choose person</option>{users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select></label>
      <label className="grid gap-1">Check-in<Input type="datetime-local" required value={checkIn} onChange={e => setCheckIn(e.target.value)} /></label>
      <label className="grid gap-1">Check-out (blank if still working)<Input type="datetime-local" value={checkOut} onChange={e => setCheckOut(e.target.value)} /></label>
      <label><input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} /> Remote work</label>
      {!remote && <label>Location<select required className="rounded border p-2" value={locationId} onChange={e => setLocationId(e.target.value)}><option value="">Choose location</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
      <label className="grid gap-1"><TranslatedText text="Reason" /><Input required value={reason} onChange={e => setReason(e.target.value)} /></label>
      <div className="flex gap-2"><Button disabled={busy}><TranslatedText text="Save correction" /></Button>{id && <Button type="button" variant="destructive" disabled={busy || !reason.trim()} onClick={() => void save('delete')}><TranslatedText text="Delete record" /></Button>}</div>
    </form>
  </CardContent></Card>;
}
