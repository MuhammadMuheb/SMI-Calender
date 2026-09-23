import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, limit, addDoc, updateDoc, doc } from 'firebase/firestore';
import { House, LogIn, LogOut, MapPin, MapPinOff } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useGeolocation, type Location } from '@/features/attendance/hooks/useGeolocation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const WFH_ELIGIBLE_ROLES = ['Office', 'Back Office', 'Back Office Extra'];

interface ActiveCheckIn {
  id: string;
  locationId: string;
  locationName: string;
  checkInAt: string;
  isWfh: boolean;
  workType: string;
}

interface CheckInButtonProps {
  userId: string;
  userName: string;
  userJobRoles: string[];
  userRole: string;
}

type Permission = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown';
type LocationStatus = 'on' | 'locating' | 'off' | 'blocked' | 'error' | 'unsupported';

function hasGeolocation() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/** Browser permission for geolocation, kept in sync when the user changes it. */
function useLocationPermission(): Permission {
  const [permission, setPermission] = useState<Permission>(() => (hasGeolocation() ? 'unknown' : 'unsupported'));

  useEffect(() => {
    if (!hasGeolocation() || !navigator.permissions?.query) return;
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const update = () => {
      if (status && !cancelled) setPermission(status.state as Permission);
    };
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        status = s;
        update();
        s.addEventListener('change', update);
      })
      .catch(() => { /* Permissions API not available for geolocation; fall back to geolocation errors. */ });
    return () => {
      cancelled = true;
      status?.removeEventListener('change', update);
    };
  }, []);

  return permission;
}

/** The user's open check-in (no check-out yet), if any. */
async function loadActiveCheckIn(userId: string): Promise<ActiveCheckIn | null> {
  // Equality filters only, so no composite index is needed; newest first is sorted in memory.
  const q = query(
    collection(db, 'check_ins'),
    where('userId', '==', userId),
    where('checkOutAt', '==', null),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const latest = [...snapshot.docs].sort((a, b) =>
    String(b.data().checkInAt ?? '').localeCompare(String(a.data().checkInAt ?? '')),
  )[0];
  const data = latest.data();
  return {
    id: latest.id,
    locationId: data.locationId ?? '',
    locationName: data.locationName ?? 'Unknown',
    checkInAt: data.checkInAt ?? new Date().toISOString(),
    isWfh: data.isWfh ?? false,
    workType: data.workType ?? 'on_site',
  };
}

async function notifyManagers(type: 'check_in' | 'check_out', name: string, location: string, isWfh: boolean) {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['super_admin', 'manager']),
      where('pushSubscription', '!=', null)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const wfhTag = isWfh ? ' (WFH)' : '';
    const title = type === 'check_in' ? `Staff arrived${wfhTag}` : `Staff left${wfhTag}`;
    const body = type === 'check_in' ? `${name} checked in at ${location}` : `${name} checked out from ${location}`;

    for (const managerDoc of snapshot.docs) {
      const manager = managerDoc.data();
      if (!manager.pushSubscription) continue;
      try {
        await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: manager.pushSubscription,
            title,
            body,
          }),
        });
      } catch {
        // Silently fail on individual notification
      }
    }
  } catch {
    // Notifications are best-effort; the check-in itself already succeeded.
  }
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(checkInAt: string, now: number): string {
  const diff = Math.max(now - new Date(checkInAt).getTime(), 0);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

export default function CheckInButton({ userId, userName, userJobRoles }: CheckInButtonProps) {
  // Callers often pass a fresh array each render; keep it stable so the location watch isn't restarted.
  const rolesKey = userJobRoles.join('|');
  const jobRoles = useMemo(() => (rolesKey ? rolesKey.split('|') : []), [rolesKey]);

  const {
    loading: geoLoading, error: geoError, nearbyLocations, nearestLocation, distanceToNearest,
    latitude, longitude, accuracy, requestPosition,
  } = useGeolocation(jobRoles, true);
  const permission = useLocationPermission();

  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(null);
  const [lastCheckOutAt, setLastCheckOutAt] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'check_in' | 'wfh' | 'check_out' | null>(null);
  const [checkingDb, setCheckingDb] = useState(true);
  const [showWfhChoice, setShowWfhChoice] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const canWfh = jobRoles.some((r) => WFH_ELIGIBLE_ROLES.includes(r));

  useEffect(() => {
    let cancelled = false;
    loadActiveCheckIn(userId)
      .then((active) => {
        if (cancelled) return;
        setActiveCheckIn(active);
        setCheckingDb(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCheckingDb(false);
        toast.error('Couldn’t load your check-in status. Refresh to try again.', { id: 'checkin-status' });
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Keep the elapsed time fresh while checked in.
  useEffect(() => {
    if (!activeCheckIn) return;
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [activeCheckIn]);

  const hasFix = latitude != null && longitude != null;
  const selectedLocation: Location | undefined =
    nearbyLocations.find((l) => l.id === selectedLocationId) ?? nearbyLocations[0];

  let locationStatus: LocationStatus;
  if (permission === 'unsupported') locationStatus = 'unsupported';
  else if (hasFix) locationStatus = 'on';
  else if (permission === 'denied' || geoError?.toLowerCase().includes('denied')) locationStatus = 'blocked';
  else if (geoLoading && permission !== 'prompt') locationStatus = 'locating';
  else if (geoError) locationStatus = 'error';
  else locationStatus = 'off';

  async function handleCheckIn(location: Location) {
    if (latitude == null || longitude == null) return;
    setActionLoading('check_in');
    try {
      const checkInAt = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'check_ins'), {
        userId,
        locationId: location.id ?? '',
        locationName: location.name ?? 'Unknown',
        checkInLat: latitude,
        checkInLng: longitude,
        isWfh: false,
        workType: 'on_site',
        checkInAt,
        checkOutAt: null,
        createdAt: checkInAt,
      });
      setActiveCheckIn({
        id: docRef.id,
        locationId: location.id ?? '',
        locationName: location.name ?? 'Unknown',
        checkInAt,
        isWfh: false,
        workType: 'on_site',
      });
      setNow(Date.now());
      toast.success(`Checked in at ${location.name || 'your location'}`);
      notifyManagers('check_in', userName, location.name ?? 'Unknown', false);
    } catch {
      toast.error('Couldn’t check you in. Check your connection and try again.');
    } finally {
      setActionLoading(null);
      setShowWfhChoice(false);
    }
  }

  async function handleWfhCheckIn() {
    setActionLoading('wfh');
    try {
      const q = query(collection(db, 'locations'), where('isActive', '==', true), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        toast.error('No office location is set up yet. Ask a manager to add one.');
        return;
      }
      const officeLoc = snapshot.docs[0].data();
      const officeName = officeLoc.name ?? 'Office';
      const checkInAt = new Date().toISOString();

      const docRef = await addDoc(collection(db, 'check_ins'), {
        userId,
        locationId: snapshot.docs[0].id,
        locationName: officeName,
        checkInLat: latitude,
        checkInLng: longitude,
        isWfh: true,
        workType: 'wfh',
        checkInAt,
        checkOutAt: null,
        createdAt: checkInAt,
      });
      setActiveCheckIn({
        id: docRef.id,
        locationId: snapshot.docs[0].id,
        locationName: officeName,
        checkInAt,
        isWfh: true,
        workType: 'wfh',
      });
      setNow(Date.now());
      toast.success('Checked in, working from home');
      notifyManagers('check_in', userName, 'Home (WFH)', true);
    } catch {
      toast.error('Couldn’t check you in. Check your connection and try again.');
    } finally {
      setActionLoading(null);
      setShowWfhChoice(false);
    }
  }

  async function handleCheckOut() {
    if (!activeCheckIn) return;
    setActionLoading('check_out');
    try {
      const checkOutAt = new Date().toISOString();
      const updateData: Record<string, unknown> = { checkOutAt };
      if (latitude && longitude) {
        updateData.checkOutLat = latitude;
        updateData.checkOutLng = longitude;
      }
      const checkInRef = doc(db, 'check_ins', activeCheckIn.id);
      await updateDoc(checkInRef, updateData);
      const label = activeCheckIn.isWfh ? 'WFH' : activeCheckIn.locationName;
      toast.success(activeCheckIn.isWfh ? 'Checked out' : `Checked out from ${label}`);
      notifyManagers('check_out', userName, label, activeCheckIn.isWfh);
      setActiveCheckIn(null);
      setLastCheckOutAt(checkOutAt);
    } catch {
      toast.error('Couldn’t check you out. Check your connection and try again.');
    } finally {
      setActionLoading(null);
    }
  }

  // ===== Loading =====
  if (checkingDb) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check-in</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Spinner className="size-3.5" /> Loading your status…
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // ===== Checked in =====
  if (activeCheckIn) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check-in</CardTitle>
          <CardDescription>
            Checked in at {formatClock(activeCheckIn.checkInAt)}
            {' · '}
            {activeCheckIn.isWfh ? 'Working from home' : activeCheckIn.locationName}
            {' · '}
            <span className="tabular-nums">{formatElapsed(activeCheckIn.checkInAt, now)}</span>
          </CardDescription>
          <CardAction>
            <Badge className="bg-success/15 text-success">
              {activeCheckIn.isWfh ? <House /> : <MapPin />}
              {activeCheckIn.isWfh ? 'Working from home' : 'Checked in'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            variant="outline"
            className="h-10 w-full sm:w-auto"
            onClick={handleCheckOut}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'check_out' ? <Spinner /> : <LogOut />}
            {actionLoading === 'check_out' ? 'Checking out…' : 'Check out'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ===== Not checked in (or checked out earlier) =====
  const canCheckIn = hasFix && !!selectedLocation && actionLoading === null;
  const locationHint = (() => {
    switch (locationStatus) {
      case 'on': {
        const acc = accuracy != null ? ` · ±${Math.round(accuracy)} m` : '';
        if (selectedLocation) return `Location on${acc}. You’re at ${selectedLocation.name || 'a check-in location'}.`;
        if (nearestLocation && distanceToNearest != null) {
          return `Location on${acc}. You’re ${formatDistance(distanceToNearest)} from ${nearestLocation.name || 'the nearest location'}. Move closer to check in.`;
        }
        return `Location on${acc}. No check-in locations are set up for your role.`;
      }
      case 'locating': return 'Finding your location…';
      case 'blocked': return 'Location is blocked. Allow it for this site in your browser settings, then try again.';
      case 'error': return geoError ?? 'Couldn’t get your location. Try again.';
      case 'unsupported': return 'This device can’t share its location, so on-site check-in isn’t available.';
      default: return 'Location is off. Turn it on to check in on site.';
    }
  })();

  const LocationIcon = locationStatus === 'on' ? MapPin : MapPinOff;
  const showEnableLocation = locationStatus === 'off' || locationStatus === 'blocked' || locationStatus === 'error';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check-in</CardTitle>
        <CardDescription>
          {lastCheckOutAt ? `Checked out at ${formatClock(lastCheckOutAt)}` : 'You haven’t checked in yet.'}
        </CardDescription>
        <CardAction>
          <Badge variant={lastCheckOutAt ? 'secondary' : 'outline'}>
            {lastCheckOutAt ? 'Checked out' : 'Not checked in'}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          {locationStatus === 'locating'
            ? <Spinner className="mt-0.5 size-4 shrink-0" />
            : <LocationIcon className={cn('mt-0.5 size-4 shrink-0', locationStatus === 'on' && 'text-success')} aria-hidden="true" />}
          <span>{locationHint}</span>
        </p>

        {nearbyLocations.length > 1 && (
          <Select value={selectedLocation?.id} onValueChange={setSelectedLocationId}>
            <SelectTrigger className="h-10 w-full" aria-label="Check-in location">
              <SelectValue placeholder="Choose a location" />
            </SelectTrigger>
            <SelectContent>
              {nearbyLocations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name || 'Location'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {showWfhChoice ? (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">Check in as working from home?</p>
            <div className="flex gap-2">
              <Button variant="ghost" className="h-10 flex-1 sm:flex-none" onClick={() => setShowWfhChoice(false)} disabled={actionLoading !== null}>
                Cancel
              </Button>
              <Button className="h-10 flex-1 sm:flex-none" onClick={handleWfhCheckIn} disabled={actionLoading !== null}>
                {actionLoading === 'wfh' ? <Spinner /> : <House />}
                {actionLoading === 'wfh' ? 'Checking in…' : 'Confirm'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              size="lg"
              className="h-10 w-full sm:w-auto"
              onClick={() => selectedLocation && handleCheckIn(selectedLocation)}
              disabled={!canCheckIn}
            >
              {actionLoading === 'check_in' ? <Spinner /> : <LogIn />}
              {actionLoading === 'check_in' ? 'Checking in…' : 'Check in'}
            </Button>
            {showEnableLocation && (
              <Button
                size="lg"
                variant="outline"
                className="h-10 w-full sm:w-auto"
                onClick={requestPosition}
                disabled={geoLoading && locationStatus !== 'off'}
              >
                <MapPin />
                {locationStatus === 'off' ? 'Enable location' : 'Try again'}
              </Button>
            )}
            {canWfh && (
              <Button
                size="lg"
                variant="ghost"
                className="h-10 w-full sm:w-auto"
                onClick={() => setShowWfhChoice(true)}
                disabled={actionLoading !== null}
              >
                <House />
                Work from home
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
