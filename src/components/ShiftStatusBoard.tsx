import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Button, Modal } from './ui';
import { theme } from '../config/theme';
import { useNotifications } from '../context/NotificationContext';
import { useAppData } from '../context/AppDataContext';


interface ShiftNotif {
  id: string;
  userId: string;
  userName: string;
  confirmStatus: 'pending' | 'confirmed' | 'rejected';
  rejectReason: string;
  body: string;
  createdAt: string;
}

interface ShiftStatusBoardProps {
  onBack: () => void;
}

export default function ShiftStatusBoard({ onBack }: ShiftStatusBoardProps) {
  const { addNotification } = useNotifications();
  const { users } = useAppData();
  const [notifs, setNotifs] = useState<ShiftNotif[]>([]);
  const [loading, setLoading] = useState(true);

  // Resend modal
  const [resendTarget, setResendTarget] = useState<ShiftNotif | null>(null);
  const [resendStart, setResendStart] = useState('08:00');
  const [resendEnd, setResendEnd] = useState('17:00');
  const [sending, setSending] = useState(false);

  const c = theme.colors;

  // Tomorrow's label for matching
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowLabel = tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const fetchShiftNotifs = useCallback(async () => {
    setLoading(true);

    // Get shift notifications that mention tomorrow
    const { data } = await supabase
      .from('notifications')
      .select('id, user_id, title, body, confirm_status, reject_reason, created_at')
      .eq('type', 'daily_absence_summary')
      .ilike('title', `%${tomorrowLabel}%`)
      .order('created_at', { ascending: false });

    if (data) {
      // Deduplicate — keep only the latest per user
      const latestPerUser = new Map<string, ShiftNotif>();
      for (const row of data) {
        const userId = row.user_id as string;
        if (!latestPerUser.has(userId)) {
          const u = users.find((u) => u.id === userId);
          latestPerUser.set(userId, {
            id: row.id as string,
            userId,
            userName: u?.displayName || userId,
            confirmStatus: (row.confirm_status || 'pending') as 'pending' | 'confirmed' | 'rejected',
            rejectReason: (row.reject_reason || '') as string,
            body: (row.body || '') as string,
            createdAt: row.created_at as string,
          });
        }
      }
      setNotifs(Array.from(latestPerUser.values()));
    }
    setLoading(false);
  }, [tomorrowLabel, users]);

  useEffect(() => { fetchShiftNotifs(); }, [fetchShiftNotifs]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(fetchShiftNotifs, 30000);
    return () => clearInterval(interval);
  }, [fetchShiftNotifs]);

  const confirmed = notifs.filter((n) => n.confirmStatus === 'confirmed');
  const rejected = notifs.filter((n) => n.confirmStatus === 'rejected');
  const pending = notifs.filter((n) => n.confirmStatus === 'pending');

  function openResend(n: ShiftNotif) {
    setResendTarget(n);
    setResendStart('08:00');
    setResendEnd('17:00');
  }

  async function handleResend() {
    if (!resendTarget) return;
    setSending(true);
    addNotification(
      resendTarget.userId, 'daily_absence_summary',
      `Tomorrow's Shift — ${tomorrowLabel}`,
      `You are on duty, ${resendStart} – ${resendEnd}. Please confirm or reject.`,
    );
    setSending(false);
    setResendTarget(null);
    // Refresh after a short delay to pick up the new notification
    setTimeout(fetchShiftNotifs, 1000);
  }

  async function resendAllPending() {
    for (const n of pending) {
      addNotification(
        n.userId, 'daily_absence_summary',
        `Tomorrow's Shift — ${tomorrowLabel}`,
        `Reminder: You are on duty tomorrow. Please confirm or reject.`,
      );
    }
    setTimeout(fetchShiftNotifs, 1000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: c.primary }}>← Back</button>
        <h2 className="text-base font-bold" style={{ color: c.white }}>📋 Shift Responses — {tomorrowLabel}</h2>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: '12px', padding: '10px 12px', borderRadius: '10px', backgroundColor: c.bgCard, border: `1px solid ${c.border}` }}>
        <div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: c.primary }}>{confirmed.length}</p>
          <p style={{ fontSize: '10px', color: c.grayDark }}>Confirmed</p>
        </div>
        <div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: c.secondary }}>{rejected.length}</p>
          <p style={{ fontSize: '10px', color: c.grayDark }}>Rejected</p>
        </div>
        <div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: c.warning }}>{pending.length}</p>
          <p style={{ fontSize: '10px', color: c.grayDark }}>Pending</p>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '24px 0', color: c.grayDark, fontSize: '12px' }}>Loading...</p>
      ) : notifs.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '24px 0', color: c.grayDark, fontSize: '12px' }}>
          No shift notifications sent for tomorrow yet.
        </p>
      ) : (
        <div className="space-y-3">
          {/* CONFIRMED */}
          {confirmed.length > 0 && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: c.primary, marginBottom: '6px' }}>
                ✅ Confirmed ({confirmed.length})
              </p>
              {confirmed.map((n) => (
                <div key={n.id} style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: c.bgCard, border: `1px solid ${c.primary}30`, marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.primary }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: c.white }}>{n.userName}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: c.grayDark }}>{n.body.match(/\d{2}:\d{2}\s*[–-]\s*\d{2}:\d{2}/) || ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* REJECTED */}
          {rejected.length > 0 && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: c.secondary, marginBottom: '6px' }}>
                ❌ Rejected ({rejected.length})
              </p>
              {rejected.map((n) => (
                <div key={n.id} style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: c.bgCard, border: `1px solid ${c.secondary}30`, marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: n.rejectReason ? '6px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.secondary }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: c.white }}>{n.userName}</span>
                    </div>
                    <button onClick={() => openResend(n)} style={{ background: 'none', border: `1px solid ${c.primary}40`, borderRadius: '6px', color: c.primaryLight, fontSize: '10px', padding: '3px 8px', cursor: 'pointer' }}>
                      Resend
                    </button>
                  </div>
                  {n.rejectReason && (
                    <p style={{ fontSize: '11px', color: c.warning, padding: '6px 8px', borderRadius: '6px', backgroundColor: c.warning + '10', marginLeft: '16px' }}>
                      💬 "{n.rejectReason}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* PENDING */}
          {pending.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: c.warning }}>
                  ⏳ Pending ({pending.length})
                </p>
                <button onClick={resendAllPending} style={{ background: 'none', border: `1px solid ${c.warning}40`, borderRadius: '6px', color: c.warning, fontSize: '10px', padding: '3px 8px', cursor: 'pointer' }}>
                  Remind All
                </button>
              </div>
              {pending.map((n) => (
                <div key={n.id} style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: c.bgCard, border: `1px solid ${c.warning}30`, marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.warning }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: c.white }}>{n.userName}</span>
                    </div>
                    <button onClick={() => openResend(n)} style={{ background: 'none', border: `1px solid ${c.primary}40`, borderRadius: '6px', color: c.primaryLight, fontSize: '10px', padding: '3px 8px', cursor: 'pointer' }}>
                      Resend
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resend with new time modal */}
      <Modal open={!!resendTarget} onClose={() => setResendTarget(null)} title={`Resend to ${resendTarget?.userName}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setResendTarget(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleResend} disabled={sending}>
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </>
        }
      >
        {resendTarget?.confirmStatus === 'rejected' && resendTarget.rejectReason && (
          <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: c.warning + '10', marginBottom: '12px' }}>
            <p style={{ fontSize: '10px', color: c.grayDark, marginBottom: '2px' }}>Their reason:</p>
            <p style={{ fontSize: '12px', color: c.warning }}>💬 "{resendTarget.rejectReason}"</p>
          </div>
        )}
        <p style={{ fontSize: '11px', color: c.grayDark, marginBottom: '10px' }}>Set new shift times:</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: c.grayDark, marginBottom: '4px' }}>Start</label>
            <input type="time" value={resendStart} onChange={(e) => setResendStart(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.white, colorScheme: 'dark', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: c.grayDark, marginBottom: '4px' }}>End</label>
            <input type="time" value={resendEnd} onChange={(e) => setResendEnd(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.white, colorScheme: 'dark', outline: 'none' }} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
