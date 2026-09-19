import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, limit, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useGeolocation, type Location } from '../hooks/useGeolocation';
import { theme } from '../config/theme';

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

export default function CheckInButton({ userId, userName, userJobRoles, userRole: _userRole }: CheckInButtonProps) {
  const { loading: geoLoading, error: geoError, nearbyLocations, distanceToNearest, latitude, longitude, accuracy, requestPosition } = useGeolocation(userJobRoles, true);
  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checkingDb, setCheckingDb] = useState(true);
  const [showWfhChoice, setShowWfhChoice] = useState(false);

  const canWfh = userJobRoles.some((r) => WFH_ELIGIBLE_ROLES.includes(r));

  const fetchActiveCheckIn = useCallback(async () => {
    setCheckingDb(true);
    setActiveCheckIn(null);
    try {
      const q = query(
        collection(db, 'checkIns'),
        where('userId', '==', userId),
        where('checkOutAt', '==', null),
        orderBy('checkInAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setActiveCheckIn({
          id: snapshot.docs[0].id,
          locationId: data.locationId ?? '',
          locationName: data.locationName ?? 'Unknown',
          checkInAt: data.checkInAt ?? new Date().toISOString(),
          isWfh: data.isWfh ?? false,
          workType: data.workType ?? 'on_site',
        });
      }
    } catch (err) {
      console.debug('CheckIn fetch (Firestore):', err);
    } finally {
      setCheckingDb(false);
    }
  }, [userId]);

  useEffect(() => { fetchActiveCheckIn(); }, [fetchActiveCheckIn]);

  function formatElapsed(checkInAt: string): string {
    const diff = Date.now() - new Date(checkInAt).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  async function handleCheckIn(location: Location) {
    if (!latitude || !longitude) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const docRef = await addDoc(collection(db, 'checkIns'), {
        userId,
        locationId: location.id ?? '',
        locationName: location.name ?? 'Unknown',
        checkInLat: latitude,
        checkInLng: longitude,
        isWfh: false,
        workType: 'on_site',
        checkInAt: new Date().toISOString(),
        checkOutAt: null,
        createdAt: new Date().toISOString(),
      });
      setActiveCheckIn({
        id: docRef.id,
        locationId: location.id ?? '',
        locationName: location.name ?? 'Unknown',
        checkInAt: new Date().toISOString(),
        isWfh: false,
        workType: 'on_site',
      });
      setMessage(`Checked in at ${location.name ?? 'location'}`);
      notifyManagers('check_in', userName, location.name ?? 'Unknown', false);
    } catch (error) {
      console.error('Check-in error:', error);
      setMessage('Check-in failed. Please try again.');
    } finally {
      setActionLoading(false);
      setShowWfhChoice(false);
    }
  }

  async function handleWfhCheckIn() {
    setActionLoading(true);
    setMessage(null);
    try {
      const q = query(collection(db, 'locations'), where('isActive', '==', true), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setMessage('No location configured.');
        return;
      }
      const officeLoc = snapshot.docs[0].data();
      const officeName = officeLoc.name ?? 'Office';

      const docRef = await addDoc(collection(db, 'checkIns'), {
        userId,
        locationId: snapshot.docs[0].id,
        locationName: officeName,
        checkInLat: latitude,
        checkInLng: longitude,
        isWfh: true,
        workType: 'wfh',
        checkInAt: new Date().toISOString(),
        checkOutAt: null,
        createdAt: new Date().toISOString(),
      });
      setActiveCheckIn({
        id: docRef.id,
        locationId: snapshot.docs[0].id,
        locationName: officeName,
        checkInAt: new Date().toISOString(),
        isWfh: true,
        workType: 'wfh',
      });
      setMessage('Checked in — Working from Home');
      notifyManagers('check_in', userName, 'Home (WFH)', true);
    } catch (error) {
      console.error('WFH check-in error:', error);
      setMessage('Check-in failed. Please try again.');
    } finally {
      setActionLoading(false);
      setShowWfhChoice(false);
    }
  }

  async function handleCheckOut() {
    if (!activeCheckIn) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const updateData: Record<string, any> = { checkOutAt: new Date().toISOString() };
      if (latitude && longitude) {
        updateData.checkOutLat = latitude;
        updateData.checkOutLng = longitude;
      }
      const checkInRef = doc(db, 'checkIns', activeCheckIn.id);
      await updateDoc(checkInRef, updateData);
      const label = activeCheckIn.isWfh ? 'WFH' : activeCheckIn.locationName;
      setMessage(`Checked out from ${label}`);
      notifyManagers('check_out', userName, label, activeCheckIn.isWfh);
      setActiveCheckIn(null);
    } catch (error) {
      console.error('Check-out error:', error);
      setMessage('Check-out failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
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

      const wfhTag = isWfh ? ' 🏠' : '';
      const title = type === 'check_in' ? `📍 Staff Arrived${wfhTag}` : `👋 Staff Left${wfhTag}`;
      const body = type === 'check_in' ? `${name} checked in at ${location}` : `${name} checked out from ${location}`;

      for (const doc of snapshot.docs) {
        const manager = doc.data();
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
    } catch (error) {
      console.debug('Manager notification error:', error);
    }
  }

  const isLoading = geoLoading || checkingDb;
  const c = theme.colors;

  const card = (borderColor: string): React.CSSProperties => ({
    backgroundColor: c.bgCard,
    border: `1px solid ${borderColor}`,
    borderRadius: '12px',
    padding: '16px',
  });

  const btn = (bg: string): React.CSSProperties => ({
    width: '100%',
    padding: '14px',
    backgroundColor: bg,
    color: c.white,
    fontWeight: 700,
    fontSize: '15px',
    borderRadius: '10px',
    border: 'none',
    cursor: actionLoading ? 'not-allowed' : 'pointer',
    opacity: actionLoading ? 0.6 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  });

  // ===== CHECKED IN =====
  if (activeCheckIn) {
    const accent = activeCheckIn.isWfh ? c.warning : c.primary;
    return (
      <div style={card(accent + '40')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: accent }} />
          <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: accent }}>
            {activeCheckIn.isWfh ? '🏠 Working from Home' : '✅ Checked In'}
          </span>
        </div>
        {!activeCheckIn.isWfh && (
          <p style={{ fontSize: '15px', fontWeight: 700, color: c.white, marginBottom: '4px' }}>{activeCheckIn.locationName}</p>
        )}
        <p style={{ fontSize: '11px', color: c.grayDark, marginBottom: '14px' }}>
          Since {new Date(activeCheckIn.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {formatElapsed(activeCheckIn.checkInAt)}
        </p>
        <button onClick={handleCheckOut} disabled={actionLoading} style={btn(c.secondary)}>
          {actionLoading ? 'Checking out...' : '👋 Check Out'}
        </button>
        {message && <p style={{ fontSize: '11px', color: c.success, marginTop: '10px', textAlign: 'center' }}>{message}</p>}
      </div>
    );
  }

  // ===== NOT CHECKED IN =====
  return (
    <div style={card(c.border)}>
      {isLoading ? (
        <div style={{ textAlign: 'center', color: c.grayDark, fontSize: '12px' }}>Loading check-in status...</div>
      ) : nearbyLocations?.length === 0 ? (
        <button onClick={requestPosition} disabled={geoLoading} style={btn(c.primary)}>
          {geoLoading ? 'Getting location...' : '📍 Enable Location'}
        </button>
      ) : (
        <>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', color: c.grayDark, marginBottom: '8px' }}>Nearby locations:</p>
            {nearbyLocations?.map((loc) => (
              <button
                key={loc.id}
                onClick={() => handleCheckIn(loc)}
                disabled={actionLoading || !latitude || !longitude}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '6px',
                  backgroundColor: c.bgElevated,
                  color: c.white,
                  border: `1px solid ${c.border}`,
                  borderRadius: '8px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.6 : 1,
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                {actionLoading ? 'Checking in...' : `📍 ${loc.name ?? 'Location'}`}
              </button>
            ))}
          </div>
          {canWfh && (
            <>
              <button onClick={() => setShowWfhChoice(!showWfhChoice)} style={btn(c.warning)}>
                {showWfhChoice ? '✖ Cancel' : '🏠 Work from Home'}
              </button>
              {showWfhChoice && (
                <>
                  <button onClick={handleWfhCheckIn} disabled={actionLoading} style={btn(c.success)} >
                    {actionLoading ? 'Checking in...' : '✓ Confirm WFH'}
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
      {message && (
        <p style={{ fontSize: '11px', marginTop: '10px', textAlign: 'center', color: message.includes('failed') ? c.danger : c.success }}>
          {message}
        </p>
      )}
    </div>
  );
}
