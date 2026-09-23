import { TranslatedText } from '@/i18n/LanguageContext';
import { useEffect, useState, type FormEvent } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppData } from '@/app/AppDataContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
interface Location { id: string; name: string; address: string; latitude: number; longitude: number; radius_meters: number; allowed_roles: string[]; isActive: boolean }
const blank: Location = { id: '', name: '', address: '', latitude: 41.9, longitude: 12.5, radius_meters: 100, allowed_roles: [], isActive: true };
export default function LocationManager() {
  const { jobRoles } = useAppData();
  const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState<Location | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => onSnapshot(collection(db, 'locations'), snapshot => setLocations(snapshot.docs.map(d => {
    const v = d.data(); return { ...blank, ...v, id: d.id, radius_meters: v.radius_meters ?? v.radius ?? 100, allowed_roles: v.allowed_roles ?? v.allowedRoles ?? [] } as Location;
  })), () => toast.error('Unable to load locations')), []);
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!form) return;
    if (!form.name.trim() || !Number.isFinite(form.latitude) || Math.abs(form.latitude) > 90 || !Number.isFinite(form.longitude) || Math.abs(form.longitude) > 180 || form.radius_meters <= 0) { toast.error('Enter a name, valid coordinates and a positive radius'); return; }
    setBusy(true);
    try { const id = form.id || crypto.randomUUID(); await setDoc(doc(db, 'locations', id), { ...form, id, name: form.name.trim(), updatedAt: new Date().toISOString() }, { merge: true }); setForm(null); toast.success('Location saved'); }
    catch { toast.error('Unable to save location'); } finally { setBusy(false); }
  };
  return <div className="space-y-4"><Button onClick={() => setForm({ ...blank })}><TranslatedText text="Add location" /></Button>
    {form && <Card><CardHeader><CardTitle>{form.id ? 'Edit location' : 'Add location'}</CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <label><TranslatedText text="Name" /><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label><TranslatedText text="Address" /><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
      <label><TranslatedText text="Latitude" /><Input type="number" required step="any" min={-90} max={90} value={form.latitude} onChange={e => setForm({ ...form, latitude: Number(e.target.value) })} /></label>
      <label><TranslatedText text="Longitude" /><Input type="number" required step="any" min={-180} max={180} value={form.longitude} onChange={e => setForm({ ...form, longitude: Number(e.target.value) })} /></label>
      <label><TranslatedText text="Radius in metres" /><Input type="number" required min={1} value={form.radius_meters} onChange={e => setForm({ ...form, radius_meters: Number(e.target.value) })} /></label>
      <label><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /><TranslatedText text="Active" /></label>
      <fieldset className="space-y-2"><legend>Allowed job roles (none means everyone)</legend>{jobRoles.map(r => <label key={r.id} className="block"><input type="checkbox" checked={form.allowed_roles.includes(r.name)} onChange={e => setForm({ ...form, allowed_roles: e.target.checked ? [...form.allowed_roles, r.name] : form.allowed_roles.filter(x => x !== r.name) })} /> {r.name}</label>)}</fieldset>
      <div className="flex gap-2"><Button disabled={busy}><TranslatedText text="Save location" /></Button><Button type="button" variant="outline" onClick={() => setForm(null)}><TranslatedText text="Cancel" /></Button></div>
    </form></CardContent></Card>}
    {locations.map(l => <Card key={l.id}><CardContent className="flex items-center justify-between py-4"><div><p className="font-medium">{l.name}</p><p className="text-sm text-muted-foreground">{l.address} ? {l.radius_meters} m ? {l.isActive ? 'Active' : 'Inactive'}</p></div><Button variant="outline" onClick={() => setForm(l)}><TranslatedText text="Edit" /></Button></CardContent></Card>)}
  </div>;
}
