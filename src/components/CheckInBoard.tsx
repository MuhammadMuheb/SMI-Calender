import { useState, useEffect, useCallback } from 'react';
import { fetchCheckInsForDate } from '../services/firestoreCheckInsService';
import { fetchActiveLocations } from '../services/firestoreLocationsService';
import { fetchUsers } from '../services/firestoreUserService';
import { Button, Badge as _Badge, Modal } from './ui';
import { theme } from '../config/theme';
import { getDisplayName } from '../utils/dataValidation';

interface CheckInRecord {
  id: string;
  userId: string;
  userName: string;
  jobRole: string[];
  locationName: string;
  checkInAt: string;
  checkOutAt: string | null;
  isWfh: boolean;
  autoCheckedOut: boolean;
}

interface CheckInBoardProps {
  onBack: () => void;
  currentUserRole: string; // 'manager' | 'super_admin'
}

export default function CheckInBoard({ onBack, currentUserRole }: CheckInBoardProps) {
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [allUsers, setAllUsers] = useState<{ id: string; displayName: string; jobRole: string[] }[]>([]);

  // Manual entry modal
  const [showManual, setShowManual] = useState(false);
  const [editRecord, setEditRecord] = useState<CheckInRecord | null>(null);
  const [manualUserId, setManualUserId] = useState('');
  const [manualCheckIn, setManualCheckIn] = useState('09:00');
  const [manualCheckOut, setManualCheckOut] = useState('17:00');
  const [manualIsWfh, setManualIsWfh] = useState(false);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = currentUserRole === 'super_admin';
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const c = theme.colors;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCheckInsForDate(selectedDate);
      const mapped = data.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        userName: getDisplayName(r) || 'Unknown',
        jobRole: Array.isArray(r.jobRole) ? r.jobRole : ['Office'],
        locationName: r.locationName || 'Unknown',
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt || null,
        isWfh: r.isWfh || false,
        autoCheckedOut: r.autoCheckedOut || false,
      }));
      setRecords(mapped);
    } catch (err) {
      console.error('Error fetching check-ins:', err);
      setRecords([]);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Auto-refresh every 30s for today
  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(fetchRecords, 30000);
    return () => clearInterval(interval);
  }, [fetchRecords, isToday]);

  // Fetch users for manual entry dropdown
  useEffect(() => {
    if (!isSuperAdmin) return;
    async function load() {
      try {
        const users = await fetchUsers();
        setAllUsers(users.map(u => ({
          id: u.id,
          displayName: getDisplayName(u),
          jobRole: Array.isArray(u.jobRole) ? u.jobRole : ['Office'],
        })));
      } catch (err) {
        console.error('Error loading users:', err);
      }
    }
    load();
  }, [isSuperAdmin]);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatHours(checkIn: string, checkOut: string | null) {
    const end = checkOut ? new Date(checkOut).getTime() : Date.now();
    const diff = end - new Date(checkIn).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.round((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // Open manual add
  function openManualAdd() {
    setEditRecord(null);
    setManualUserId(allUsers[0]?.id || '');
    setManualCheckIn('09:00');
    setManualCheckOut('17:00');
    setManualIsWfh(false);
    setShowManual(true);
  }

  // Open edit existing
  function openEdit(rec: CheckInRecord) {
    setEditRecord(rec);
    setManualUserId(rec.userId);
    setManualCheckIn(new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    setManualCheckOut(rec.checkOutAt ? new Date(rec.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
    setManualIsWfh(rec.isWfh);
    setShowManual(true);
  }

  async function handleSaveManual() {
    setSaving(true);

    try {
      if (editRecord) {
        // TODO: Implement update check-in in Firestore
        console.log('Update check-in:', editRecord.id);
      } else {
        // TODO: Implement insert check-in in Firestore
        console.log('Insert check-in for user:', manualUserId);
      }

      setShowManual(false);
      fetchRecords();
    } catch (err) {
      console.error('Error saving check-in:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this check-in record?')) return;
    try {
      // TODO: Implement delete check-in in Firestore
      console.log('Delete check-in:', id);
      fetchRecords();
    } catch (err) {
      console.error('Error deleting check-in:', err);
    }
  }

  const checkedIn = records.filter((r) => !r.checkOutAt);
  const checkedOut = records.filter((r) => r.checkOutAt);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: c.primary }}>← Back</button>
        <h2 className="text-base font-bold" style={{ color: c.white }}>📍 Check-In Board</h2>
      </div>

      {/* Date picker + manual add */}
      <div className="flex items-center justify-between gap-2">
        <input
          type="date" value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '12px', backgroundColor: c.bgCard, border: `1px solid ${c.border}`, color: c.white, colorScheme: 'dark', outline: 'none' }}
        />
        <div className="flex items-center gap-2">
          {isToday && (
            <span style={{ fontSize: '10px', color: c.primaryLight, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.primary, display: 'inline-block' }} />
              Live
            </span>
          )}
          {isSuperAdmin && (
            <Button variant="primary" size="sm" onClick={openManualAdd}>+ Manual</Button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '12px', padding: '10px 12px', borderRadius: '10px', backgroundColor: c.bgCard, border: `1px solid ${c.border}` }}>
        <div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: c.primaryLight }}>{checkedIn.length}</p>
          <p style={{ fontSize: '10px', color: c.grayDark }}>On Site Now</p>
        </div>
        <div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: c.gray }}>{checkedOut.length}</p>
          <p style={{ fontSize: '10px', color: c.grayDark }}>Checked Out</p>
        </div>
        <div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: c.white }}>{records.length}</p>
          <p style={{ fontSize: '10px', color: c.grayDark }}>Total</p>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '24px 0', color: c.grayDark, fontSize: '12px' }}>Loading...</p>
      ) : records.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '24px 0', color: c.grayDark, fontSize: '12px' }}>
          No check-ins {isToday ? 'yet today' : 'on this date'}
        </p>
      ) : (
        <div className="space-y-2">
          {/* Currently checked in */}
          {checkedIn.length > 0 && (
            <>
              <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: c.primaryLight, marginBottom: '4px' }}>
                On Site Now ({checkedIn.length})
              </p>
              {checkedIn.map((r) => (
                <div key={r.id} style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: c.bgCard, border: `1px solid ${c.primary}30` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.primary }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: c.white }}>{r.userName}</span>
                          {r.isWfh && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '99px', backgroundColor: c.warning + '20', color: c.warning }}>WFH</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                          {(r.jobRole || []).map((role) => (
                            <span key={role} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '99px', backgroundColor: c.primary + '15', color: c.primaryLight }}>{role}</span>
                          ))}
                        </div>
                        <p style={{ fontSize: '10px', color: c.grayDark, marginTop: '2px' }}>
                          {r.isWfh ? '🏠' : '📍'} {r.isWfh ? 'Home' : r.locationName} · In: {formatTime(r.checkInAt)} · {formatHours(r.checkInAt, null)}
                        </p>
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <button onClick={() => openEdit(r)} style={{ background: 'none', border: 'none', color: c.primaryLight, fontSize: '10px', cursor: 'pointer' }}>Edit</button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Checked out */}
          {checkedOut.length > 0 && (
            <>
              <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: c.grayDark, marginTop: '8px', marginBottom: '4px' }}>
                Checked Out ({checkedOut.length})
              </p>
              {checkedOut.map((r) => (
                <div key={r.id} style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: c.bgCard, border: `1px solid ${c.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.grayDarker }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: c.gray }}>{r.userName}</span>
                          {r.isWfh && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '99px', backgroundColor: c.warning + '15', color: c.warning }}>WFH</span>}
                          {r.autoCheckedOut && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '99px', backgroundColor: c.warning + '15', color: c.warning }}>auto</span>}
                        </div>
                        <p style={{ fontSize: '10px', color: c.grayDark, marginTop: '2px' }}>
                          In: {formatTime(r.checkInAt)} → Out: {formatTime(r.checkOutAt!)} · {formatHours(r.checkInAt, r.checkOutAt)}
                        </p>
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => openEdit(r)} style={{ background: 'none', border: 'none', color: c.primaryLight, fontSize: '10px', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', color: c.secondary, fontSize: '10px', cursor: 'pointer' }}>Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Manual entry/edit modal */}
      <Modal open={showManual} onClose={() => setShowManual(false)} title={editRecord ? 'Edit Check-In' : 'Manual Check-In'}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowManual(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveManual} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* User dropdown (only for new entries) */}
          {!editRecord && (
            <div>
              <label style={{ display: 'block', fontSize: '10px', color: c.grayDark, marginBottom: '4px' }}>Staff Member</label>
              <select
                value={manualUserId}
                onChange={(e) => setManualUserId(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.white, outline: 'none' }}
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName} ({(u.jobRole || []).join(', ')})</option>
                ))}
              </select>
            </div>
          )}
          {editRecord && (
            <p style={{ fontSize: '12px', fontWeight: 600, color: c.white }}>{editRecord.userName}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ display: 'block', fontSize: '10px', color: c.grayDark, marginBottom: '4px' }}>Check-In Time</label>
              <input type="time" value={manualCheckIn} onChange={(e) => setManualCheckIn(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.white, colorScheme: 'dark', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', color: c.grayDark, marginBottom: '4px' }}>Check-Out Time</label>
              <input type="time" value={manualCheckOut} onChange={(e) => setManualCheckOut(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.white, colorScheme: 'dark', outline: 'none' }} />
              <p style={{ fontSize: '9px', color: c.grayDark, marginTop: '2px' }}>Leave empty if still working</p>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={manualIsWfh} onChange={(e) => setManualIsWfh(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: c.primary }} />
            <span style={{ fontSize: '12px', color: c.white }}>🏠 Work from Home</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
