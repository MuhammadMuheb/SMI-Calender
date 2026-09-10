import { useState, useMemo } from 'react';
import { Modal, Button, Badge } from './ui';
import { theme } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { useLeave } from '../context/LeaveContext';
import type { LeaveRequest } from '../models/leave';

interface Props {
  request: LeaveRequest | null;
  open: boolean;
  onClose: () => void;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MoveDayOffModal({ request, open, onClose }: Props) {
  const { user } = useAuth();
  const { submitRequest } = useLeave();
  const [newDate, setNewDate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const minDate = useMemo(() => getTodayStr(), []);

  if (!user || !request) return null;

  const oldDateLabel = new Date(request.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const handleSubmit = async () => {
    setError('');
    if (!newDate) { setError('Select a new date'); return; }
    if (newDate === request.date) { setError('New date must be different'); return; }
    if (newDate < getTodayStr()) { setError('Cannot move to a past date'); return; }

    setSubmitting(true);
    const userRef = { id: user.id, displayName: user.displayName, role: user.role };
    const note = `📋 MOVE REQUEST: Move day off from ${oldDateLabel} to ${new Date(newDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} | move_from:${request.id}`;
    const err = await submitRequest(user.id, userRef, newDate, 'regular_day_off', note);
    setSubmitting(false);

    if (err) { setError(err); return; }
    setSuccess(true);
    setTimeout(() => { setSuccess(false); setNewDate(''); onClose(); }, 1200);
  };

  const handleClose = () => { setError(''); setSuccess(false); setNewDate(''); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="Move Day Off"
      footer={<>
        <Button variant="outline" onClick={handleClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Move Request'}
        </Button>
      </>}>

      <div className="space-y-4">
        <div className="rounded-lg p-3" style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}` }}>
          <p className="text-[10px] uppercase" style={{ color: theme.colors.grayDark }}>Moving from</p>
          <p className="text-sm font-bold" style={{ color: theme.colors.secondary }}>{oldDateLabel}</p>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>New Date</label>
          <input type="date" value={newDate} onChange={(e) => { setNewDate(e.target.value); setError(''); }}
            min={minDate}
            className="w-full rounded-lg text-sm outline-none px-3 py-2.5"
            style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}`,
              color: theme.colors.white, colorScheme: 'dark' }} />
        </div>

        <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
          Your manager will review this move request. If approved, {oldDateLabel} will be cancelled and the new date will be approved.
        </p>

        {error && <p className="text-xs" style={{ color: theme.colors.danger }}>{error}</p>}
        {success && <div className="flex items-center gap-2">
          <Badge color="success">Submitted</Badge>
          <span className="text-xs" style={{ color: theme.colors.success }}>Move request sent for approval</span>
        </div>}
      </div>
    </Modal>
  );
}
