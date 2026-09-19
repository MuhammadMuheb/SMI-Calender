import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useGeolocation, type Location } from '../hooks/useGeolocation';
import { theme } from '../config/theme';

const WFH_ELIGIBLE_ROLES = ['Office', 'Back Office', 'Back Office Extra'];

interface ActiveCheckIn {
  id: string;
  location_id: string;
  location_name: string;
  check_in_at: string;
  is_wfh: boolean;
  work_type: string;
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
    try {
      const { data, error } = await supabase
        .from('check_ins').select('id, location_id, check_in_at, is_wfh, work_type, locations(name)')
        .eq('user_id', userId).is('check_out_at', null).order('check_in_at', { ascending: false }).limit(1).single();
      if (!error && data) {
        setActiveCheckIn({ id: data.id, location_id: data.location_id, location_name: (data.locations as any)?.name || 'Unknown', check_in_at: data.check_in_at, is_wfh: data.is_wfh, work_type: data.work_type });
      } else {
        setActiveCheckIn(null);
      }
    } catch (err) {
      console.warn('CheckIn fetch unavailable (Supabase migration in progress):', err);
      setActiveCheckIn(null);
    }
    setCheckingDb(false);
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
    setActionLoading(true); setMessage(null);
    const { data, error } = await supabase.from('check_ins').insert({ user_id: userId, location_id: location.id, check_in_lat: latitude, check_in_lng: longitude, is_wfh: false, work_type: 'on_site' }).select('id, location_id, check_in_at, is_wfh, work_type').single();
    if (error) { setMessage('Check-in failed. Please try again.'); }
    else if (data) { setActiveCheckIn({ id: data.id, location_id: data.location_id, location_name: location.name, check_in_at: data.check_in_at, is_wfh: false, work_type: 'on_site' }); setMessage(`Checked in at ${location.name}`); notifyManagers('check_in', userName, location.name, false); }
    setActionLoading(false); setShowWfhChoice(false);
  }

  async function handleWfhCheckIn() {
    setActionLoading(true); setMessage(null);
    const { data: officeLoc } = await supabase.from('locations').select('id, name').eq('is_active', true).limit(1).single();
    if (!officeLoc) { setMessage('No location configured.'); setActionLoading(false); return; }
    const { data, error } = await supabase.from('check_ins').insert({ user_id: userId, location_id: officeLoc.id, check_in_lat: latitude, check_in_lng: longitude, is_wfh: true, work_type: 'wfh' }).select('id, location_id, check_in_at, is_wfh, work_type').single();
    if (error) { setMessage('Check-in failed. Please try again.'); }
    else if (data) { setActiveCheckIn({ id: data.id, location_id: data.location_id, location_name: officeLoc.name, check_in_at: data.check_in_at, is_wfh: true, work_type: 'wfh' }); setMessage('Checked in — Working from Home'); notifyManagers('check_in', userName, 'Home (WFH)', true); }
    setActionLoading(false); setShowWfhChoice(false);
  }

  async function handleCheckOut() {
    if (!activeCheckIn) return;
    setActionLoading(true); setMessage(null);
    const updateData: Record<string, any> = { check_out_at: new Date().toISOString() };
    if (latitude && longitude) { updateData.check_out_lat = latitude; updateData.check_out_lng = longitude; }
    const { error } = await supabase.from('check_ins').update(updateData).eq('id', activeCheckIn.id);
    if (error) { setMessage('Check-out failed. Please try again.'); }
    else { const label = activeCheckIn.is_wfh ? 'WFH' : activeCheckIn.location_name; setMessage(`Checked out from ${label}`); notifyManagers('check_out', userName, label, activeCheckIn.is_wfh); setActiveCheckIn(null); }
    setActionLoading(false);
  }

  async function notifyManagers(type: 'check_in' | 'check_out', name: string, location: string, isWfh: boolean) {
    try {
      const { data: managers } = await supabase.from('users').select('id, push_subscription').in('role', ['super_admin', 'manager']).not('push_subscription', 'is', null);
      if (!managers || managers.length === 0) return;
      const wfhTag = isWfh ? ' 🏠' : '';
      const title = type === 'check_in' ? `📍 Staff Arrived${wfhTag}` : `👋 Staff Left${wfhTag}`;
      const body = type === 'check_in' ? `${name} checked in at ${location}` : `${name} checked out from ${location}`;
      for (const mgr of managers) { try { await fetch('/api/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: mgr.push_subscription, title, body }) }); } catch {} }
    } catch {}
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
    const accent = activeCheckIn.is_wfh ? c.warning : c.primary;
    return (
      <div style={card(accent + '40')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: accent }} />
          <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: accent }}>
            {activeCheckIn.is_wfh ? '🏠 Working from Home' : '✅ Checked In'}
          </span>
        </div>
        {!activeCheckIn.is_wfh && (
          <p style={{ fontSize: '15px', fontWeight: 700, color: c.white, marginBottom: '4px' }}>{activeCheckIn.location_name}</p>
        )}
        <p style={{ fontSize: '11px', color: c.grayDark, marginBottom: '14px' }}>
          Since {new Date(activeCheckIn.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {formatElapsed(activeCheckIn.check_in_at)}
        </p>
        <button onClick={handleCheckOut} disabled={actionLoading} style={btn(c.secondary)}>
          {actionLoading ? 'Checking out...' : '👋 Check Out'}
        </button>
        {message && <p style={{ marginTop: '10px', fontSize: '11px', textAlign: 'center', color: accent }}>{message}</p>}
      </div>
    );
  }

  // ===== LOADING =====
  if (isLoading) {
    return (
      <div style={card(c.border)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px 0' }}>
          <span style={{ fontSize: '12px', color: c.grayDark }}>📍 Detecting your location...</span>
        </div>
      </div>
    );
  }

  // ===== WFH CHOICE =====
  if (showWfhChoice) {
    return (
      <div style={card(c.border)}>
        <p style={{ fontSize: '14px', fontWeight: 700, color: c.white, textAlign: 'center', marginBottom: '14px' }}>
          How are you working today?
        </p>
        {nearbyLocations.map((loc) => (
          <button key={loc.id} onClick={() => handleCheckIn(loc)} disabled={actionLoading} style={{ ...btn(c.primary), marginBottom: '8px' }}>
            📍 On Site — {loc.name}
          </button>
        ))}
        <button onClick={handleWfhCheckIn} disabled={actionLoading} style={{ ...btn(c.primaryDark), marginBottom: '8px' }}>
          {actionLoading ? 'Checking in...' : '🏠 Work from Home'}
        </button>
        <button onClick={() => setShowWfhChoice(false)} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', color: c.grayDark, fontSize: '11px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    );
  }

  // ===== GPS ERROR (no WFH) =====
  if (geoError && !canWfh) {
    return (
      <div style={card(c.warning + '30')}>
        <p style={{ fontSize: '11px', color: c.warning, marginBottom: '10px' }}>📍 {geoError}</p>
        <button onClick={requestPosition} style={btn(c.warning)}>Try Again</button>
      </div>
    );
  }

  // ===== GPS ERROR (can WFH) =====
  if (geoError && canWfh) {
    return (
      <div style={card(c.warning + '30')}>
        <p style={{ fontSize: '11px', color: c.warning, marginBottom: '10px' }}>📍 {geoError}</p>
        <button onClick={requestPosition} style={{ ...btn(c.grayDarker), marginBottom: '8px', color: c.gray }}>
          Retry GPS for On-Site
        </button>
        <button onClick={handleWfhCheckIn} disabled={actionLoading} style={btn(c.primaryDark)}>
          {actionLoading ? 'Checking in...' : '🏠 Work from Home'}
        </button>
      </div>
    );
  }

  // ===== NEAR LOCATION =====
  if (nearbyLocations.length > 0) {
    return (
      <div style={card(c.primary + '40')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontSize: '20px' }}>📍</span>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: c.primaryLight }}>
              {nearbyLocations.length === 1 ? "You're at" : 'Nearby locations'}
            </p>
            {nearbyLocations.length === 1 && (
              <p style={{ fontSize: '15px', fontWeight: 700, color: c.white }}>{nearbyLocations[0].name}</p>
            )}
          </div>
        </div>
        {distanceToNearest !== null && (
          <p style={{ fontSize: '10px', color: c.grayDark, marginBottom: '12px' }}>
            {distanceToNearest}m away · GPS ±{accuracy ? Math.round(accuracy) : '?'}m
          </p>
        )}
        {nearbyLocations.length > 1 ? (
          nearbyLocations.map((loc) => (
            <button key={loc.id} onClick={() => handleCheckIn(loc)} disabled={actionLoading} style={{ ...btn(c.primary), marginBottom: '8px' }}>
              ✅ Check In — {loc.name}
            </button>
          ))
        ) : (
          <button onClick={() => { if (canWfh) { setShowWfhChoice(true); } else { handleCheckIn(nearbyLocations[0]); } }} disabled={actionLoading} style={btn(c.primary)}>
            {actionLoading ? 'Checking in...' : '✅ Check In'}
          </button>
        )}
        {canWfh && nearbyLocations.length > 1 && (
          <button onClick={handleWfhCheckIn} disabled={actionLoading} style={{ ...btn(c.primaryDark), marginTop: '8px' }}>
            🏠 Work from Home Instead
          </button>
        )}
        {message && <p style={{ marginTop: '10px', fontSize: '11px', textAlign: 'center', color: c.primaryLight }}>{message}</p>}
      </div>
    );
  }

  // ===== NOT NEAR ANY LOCATION =====
  return (
    <div style={card(c.border)}>
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <p style={{ fontSize: '11px', color: c.grayDark, marginBottom: '6px' }}>📍 Not at a check-in location</p>
        {distanceToNearest !== null && (
          <p style={{ fontSize: '10px', color: c.grayDarker, marginBottom: '8px' }}>
            Nearest: {distanceToNearest >= 1000 ? `${(distanceToNearest / 1000).toFixed(1)}km` : `${distanceToNearest}m`} away
          </p>
        )}
        <button onClick={requestPosition} style={{ background: 'none', border: 'none', color: c.primaryLight, fontSize: '11px', fontWeight: 500, cursor: 'pointer', marginBottom: canWfh ? '10px' : '0' }}>
          Refresh location
        </button>
        {canWfh && (
          <button onClick={handleWfhCheckIn} disabled={actionLoading} style={btn(c.primaryDark)}>
            {actionLoading ? 'Checking in...' : '🏠 Work from Home'}
          </button>
        )}
      </div>
    </div>
  );
}
