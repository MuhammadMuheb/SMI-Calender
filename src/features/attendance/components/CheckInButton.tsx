import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, MapPin, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { serverApi } from '@/lib/serverApi';
import { useGeolocation } from '@/features/attendance/hooks/useGeolocation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkModeBadge } from '@/features/work-arrangements/WorkModeBadge';
import { WorkSelect } from '@/features/work-arrangements/WorkFields';
import type { WorkSlot } from '../../../../shared/work-arrangements.mjs';
import type { CheckInData } from '../services/checkInsService';
interface Status {
  active: (CheckInData & { arrangementId?: string | null }) | null;
  current: WorkSlot & { date: string; withinHours: boolean; start: string; end: string };
  validation: string; enforceHours: boolean;
}
interface Props { userId: string; userName: string; userJobRoles: string[]; userRole: string }
export default function CheckInButton({ userId, userJobRoles }: Props) {
  const rolesKey = userJobRoles.join('|');
  const jobRoles = useMemo(() => rolesKey.split('|').filter(Boolean), [rolesKey]);
  const geo = useGeolocation(jobRoles, false);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const refresh = useCallback(async () => {
    try { setStatus(await serverApi<Status>('attendance', { action: 'status' })); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load check-in status'); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    window.addEventListener('work-schedule-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('work-schedule-changed', refresh); window.removeEventListener('focus', refresh); };
  }, [refresh, userId]);
  const allowedLocations = geo.allLocations.filter(loc => !loc.allowed_roles?.length || !jobRoles.length || loc.allowed_roles.some(r => jobRoles.some(m => m.toLowerCase() === r.toLowerCase())));
  const locationId = selectedLocation || geo.nearbyLocations[0]?.id || allowedLocations[0]?.id || '';
  async function act(action: string) {
    setBusy(true);
    try {
      await serverApi('attendance', { action, data: { locationId, latitude: geo.latitude, longitude: geo.longitude, accuracy: geo.accuracy } });
      await refresh(); toast.success(action === 'check-out' ? 'Checked out' : action === 'switch-mode' ? 'Work mode changed; previous segment saved' : 'Checked in');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to update attendance'); }
    finally { setBusy(false); }
  }
  const current = status?.current;
  const active = status?.active;
  const switchAvailable = !!active && !!current && current.mode !== 'off' && (active.workType !== current.mode || active.arrangementId !== current.arrangementId);
  const needsGps = status?.validation !== 'none';
  const blocked = !status || !!error || current?.mode === 'off' || status.enforceHours && !current?.withinHours;
  return <Card><CardHeader><CardTitle>Check-in</CardTitle></CardHeader><CardContent className="space-y-3">
    {!status && !error && <p role="status">Loading your approved schedule…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {current && <><div className="flex flex-wrap items-center gap-2"><WorkModeBadge mode={current.mode} /><span className="text-sm text-muted-foreground">{current.shiftStart}–{current.shiftEnd} · {current.timezone}</span></div>
      {current.mode === 'off' ? <p className="text-sm">{current.reason}</p> : <p className="text-sm text-muted-foreground">{current.arrangementId ? 'Your approved work arrangement applies.' : 'Your default on-site schedule applies. Request approval in Work arrangements to work off site.'}</p>}
      {status?.enforceHours && !current.withinHours && <p className="text-sm">Check-in opens during your approved working hours and early arrival allowance.</p>}
    </>}
    {active && <div className="space-y-2"><p className="text-sm">Checked in at {new Date(active.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {active.workType === 'remote' ? 'Remote' : active.locationName}</p><Button variant="outline" className="h-11 w-full sm:w-auto" disabled={busy} onClick={() => void act('check-out')}><LogOut />{busy ? 'Saving…' : 'Check out'}</Button></div>}
    {(!active || switchAvailable) && current?.mode !== 'off' && <>
      {current?.mode === 'on_site' && <WorkSelect label="Office location" value={locationId} onChange={e => setSelectedLocation(e.target.value)}><option value="">Choose a location</option>{allowedLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</WorkSelect>}
      {needsGps && <div className="space-y-2"><p className="text-sm text-muted-foreground">{geo.latitude !== null ? `Location available${geo.accuracy != null ? ` (±${Math.round(geo.accuracy)} m)` : ''}.` : 'Share your current location for this check-in.'} {geo.nearestLocation && geo.distanceToNearest != null && current?.mode === 'on_site' ? `${geo.distanceToNearest} m from ${geo.nearestLocation.name}.` : ''}</p>{geo.error && <p className="text-sm text-destructive">{geo.error}</p>}<Button variant="outline" className="h-11" onClick={geo.requestPosition}><MapPin />{geo.latitude !== null ? 'Refresh location' : 'Enable location'}</Button></div>}
      <Button className="h-11 w-full sm:w-auto" disabled={busy || blocked || needsGps && geo.latitude === null || current?.mode === 'on_site' && !locationId} onClick={() => void act(switchAvailable ? 'switch-mode' : 'check-in')}><LogIn />{busy ? 'Saving…' : switchAvailable ? 'Switch to scheduled mode' : 'Check in'}</Button>
    </>}
    <Button variant="ghost" className="h-11" disabled={busy} onClick={() => void refresh()}><RefreshCw />Refresh status</Button>
  </CardContent></Card>;
}
