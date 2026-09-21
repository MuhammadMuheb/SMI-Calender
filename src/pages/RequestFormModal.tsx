import { useState, useMemo, useRef } from 'react';
import { Modal, Button, FormInput, Badge } from '../components/ui';
import { theme } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { useLeave } from '../context/LeaveContext';
import type { LeaveType } from '../models/leave';
import { LEAVE_TYPE_LABELS } from '../models/leave';
import { getPickableDateRange, getCurrentCycle, getCycleLabel, getRemainingQuota } from '../utils/cycleUtils';

interface RequestFormModalProps { open: boolean; onClose: () => void; }

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYearEnd(): string {
  return `${new Date().getFullYear()}-12-31`;
}

export default function RequestFormModal({ open, onClose }: RequestFormModalProps) {
  const { user } = useAuth();
  const { submitRequest, requests } = useLeave();
  const [date, setDate] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('regular_day_off');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;
  // ── Cycle-aware date range for regular day off ──
  // ONLY allow requests for CURRENT cycle (remaining dates), never future cycles
  const cycleRange = useMemo(() => getPickableDateRange(user.role), [user.role]);
  const currentCycle = useMemo(() => getCurrentCycle(), []);

  // Count user's already-approved days in current cycle
  const approvedInCurrentCycle = useMemo(() => {
    if (!currentCycle) return [];
    return requests
      .filter((r) => r.userId === user.id && r.status === 'approved' && r.leaveType === 'regular_day_off' && r.date >= currentCycle.start && r.date <= currentCycle.end)
      .map((r) => r.date);
  }, [requests, user.id, currentCycle]);

  const remainingQuota = useMemo(() => {
    if (!currentCycle) return 0;
    return getRemainingQuota(currentCycle, approvedInCurrentCycle);
  }, [currentCycle, approvedInCurrentCycle]);

  // Pending requests also count toward quota
  const pendingInCurrentCycle = useMemo(() => {
    if (!currentCycle) return 0;
    return requests.filter((r) => r.userId === user.id && r.status === 'pending' && r.leaveType === 'regular_day_off' && r.date >= currentCycle.start && r.date <= currentCycle.end).length;
  }, [requests, user.id, currentCycle]);

  const effectiveRemaining = remainingQuota - pendingInCurrentCycle;

  // Date constraints per leave type
  const { minDate, maxDate, dateLabel } = useMemo(() => {
    if (leaveType === 'sick_day') {
      return { minDate: getTodayStr(), maxDate: getYearEnd(), dateLabel: 'Sick day — today through end of year' };
    }
    if (leaveType === 'paid_vacation') {
      return { minDate: getTodayStr(), maxDate: getYearEnd(), dateLabel: 'Vacation — today through end of year (uses vacation days)' };
    }
    // regular_day_off — current cycle only, no future cycles
    if (!cycleRange) {
      return { minDate: '', maxDate: '', dateLabel: 'No current cycle available' };
    }
    const label = currentCycle ? getCycleLabel(currentCycle) : 'Current cycle';
    return { minDate: cycleRange.min, maxDate: cycleRange.max, dateLabel: label };
  }, [leaveType, cycleRange, currentCycle]);

  const isRegularLocked = leaveType === 'regular_day_off' && (!cycleRange || cycleRange.locked);
  const isOverQuota = leaveType === 'regular_day_off' && effectiveRemaining <= 0;

  const REQUEST_TYPES: { type: LeaveType; label: string; description: string }[] = [
    { type: 'regular_day_off', label: LEAVE_TYPE_LABELS.regular_day_off, description: currentCycle ? `${getCycleLabel(currentCycle)} (remaining dates only)` : 'Current cycle' },
    { type: 'paid_vacation', label: LEAVE_TYPE_LABELS.paid_vacation, description: 'Any remaining date this year — uses vacation days' },
    { type: 'sick_day', label: LEAVE_TYPE_LABELS.sick_day, description: 'Sick leave — attach medical certificate' },
  ];

  const handleSubmit = async () => {
    setError(''); setSuccess(false);

    if (!date) { setError('Please select a date'); return; }

    if (leaveType === 'regular_day_off') {
      if (isRegularLocked) { setError('Day off requests are locked — contact super admin.'); return; }
      if (isOverQuota) { setError(`No days left in current cycle (quota: ${currentCycle?.quota || 0}).`); return; }
      if (cycleRange && (date < cycleRange.min || date > cycleRange.max)) {
        setError(`Date must be within ${dateLabel}`); return;
      }
    }

    let attachmentUrl: string | null = null;
    if (attachment && leaveType === 'sick_day') {
      setUploading(true);
      // TODO: Migrate to Firestore file uploads
      attachmentUrl = `[File: ${attachment.name}]`;
      setUploading(false);
    }

    const fullNote = [note, attachmentUrl ? `Attachment: ${attachmentUrl}` : ''].filter(Boolean).join(' | ');
    const err = await submitRequest(
      user.id,
      { id: user.id, displayName: user.displayName, role: user.role,  },
      date, leaveType, fullNote,
    );
    if (err) { setError(err); } else { setSuccess(true); setDate(''); setNote(''); setAttachment(null); }
  };

  const c = theme.colors;

  return (
    <Modal open={open} onClose={onClose} title="Request Time Off">
      {/* Leave type selector */}
      <div className="space-y-2 mb-4">
        {REQUEST_TYPES.map((rt) => (
          <button key={rt.type} onClick={() => { setLeaveType(rt.type); setDate(''); setError(''); }}
            className="w-full text-left px-3 py-2.5 rounded-lg cursor-pointer transition-all"
            style={{
              backgroundColor: leaveType === rt.type ? c.primary + '20' : c.bgElevated,
              border: `1px solid ${leaveType === rt.type ? c.primary : c.border}`,
            }}>
            <p className="text-xs font-semibold" style={{ color: leaveType === rt.type ? c.primaryLight : c.white }}>
              {rt.label}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: c.grayDark }}>{rt.description}</p>
          </button>
        ))}
      </div>

      {/* Cycle info for regular day off */}
      {leaveType === 'regular_day_off' && currentCycle && (
        <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: c.bgElevated, border: `1px solid ${c.border}` }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold" style={{ color: c.gray }}>
              {getCycleLabel(currentCycle)}
            </span>
            <span className="text-[10px] font-bold" style={{ color: c.primaryLight }}>
              {currentCycle.weeks} weeks
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: c.grayDark }}>
              Quota: {currentCycle.quota} days (incl. auto-Sunday)
            </span>
            <span className="text-[10px] font-bold" style={{ color: effectiveRemaining > 0 ? c.primaryLight : c.danger }}>
              {effectiveRemaining} remaining
            </span>
          </div>
          {pendingInCurrentCycle > 0 && (
            <p className="text-[9px] mt-1" style={{ color: c.warning }}>
              {pendingInCurrentCycle} pending request{pendingInCurrentCycle > 1 ? 's' : ''} awaiting approval
            </p>
          )}
        </div>
      )}

      {/* Date picker */}
      <div className="mb-3">
        <label className="block text-xs font-medium mb-1.5" style={{ color: c.gray }}>Date</label>
        <input type="date" value={date}
          onChange={(e) => setDate(e.target.value)}
          min={minDate} max={maxDate || undefined}
          disabled={isRegularLocked && leaveType === 'regular_day_off'}
          className="w-full rounded-lg text-sm outline-none px-3 py-2.5"
          style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}`, color: c.white, colorScheme: 'dark' }} />
        <p className="text-[9px] mt-1" style={{ color: c.grayDark }}>
          {dateLabel}
        </p>
      </div>

      {/* Attachment for sick day */}
      {leaveType === 'sick_day' && (
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: c.gray }}>
            Medical Certificate (optional)
          </label>
          <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} className="hidden" />
          <button onClick={() => fileRef.current?.click()}
            className="w-full px-3 py-2.5 rounded-lg text-left cursor-pointer"
            style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}` }}>
            {attachment ? (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: c.primaryLight }}>📎 {attachment.name}</span>
                <button onClick={(e) => { e.stopPropagation(); setAttachment(null); }}
                  className="text-[10px] cursor-pointer" style={{ color: c.danger }}>Remove</button>
              </div>
            ) : (
              <span className="text-xs" style={{ color: c.grayDark }}>📷 Tap to attach photo or PDF</span>
            )}
          </button>
        </div>
      )}

      <FormInput label="Note (optional)" placeholder="Any details for your manager..."
        value={note} onChange={(e) => setNote(e.target.value)} />

      <Button variant="primary" fullWidth onClick={handleSubmit}
        disabled={uploading || (isRegularLocked && leaveType === 'regular_day_off') || (isOverQuota && leaveType === 'regular_day_off')}>
        {uploading ? 'Uploading...' : 'Submit Request'}
      </Button>

      {error && <p className="text-xs mt-2" style={{ color: c.danger }}>{error}</p>}
      {success && (
        <div className="mt-2 flex items-center gap-2">
          <Badge color="success">Submitted</Badge>
          <span className="text-xs" style={{ color: c.success }}>Request submitted successfully</span>
        </div>
      )}
    </Modal>
  );
}
