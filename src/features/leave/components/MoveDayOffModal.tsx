import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { formatShortDate } from '@/features/leave/leaveMeta';
import { formatDateLocal } from '@/utils/dateUtils';
import type { LeaveRequest } from '@/models/leave';

interface Props {
  request: LeaveRequest | null;
  open: boolean;
  onClose: () => void;
}

const todayStr = () => formatDateLocal(new Date());

export default function MoveDayOffModal({ request, open, onClose }: Props) {
  const { user } = useAuth();
  const { submitRequest } = useLeave();
  const [newDate, setNewDate] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!user || !request) return null;

  const oldDateLabel = formatShortDate(request.date);

  const reset = () => { setError(''); setNewDate(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    setError('');
    if (!newDate) { setError('Pick the new date.'); return; }
    if (newDate === request.date) { setError('Pick a different date from the one you have now.'); return; }
    if (newDate < todayStr()) { setError('Pick today or a later date.'); return; }

    setSubmitting(true);
    const userRef = { id: user.id, displayName: user.displayName, role: user.role };
    const note = `Move request: move day off from ${oldDateLabel} to ${formatShortDate(newDate)} | move_from:${request.id}`;
    const err = await submitRequest(user.id, userRef, newDate, 'regular_day_off', note);
    setSubmitting(false);

    if (err) { toast.error(err); return; }
    toast.success('Move request sent');
    handleClose();
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => { if (!o) handleClose(); }}
      title="Move day off"
      description="Your manager reviews the move. Once approved, the old date is cancelled and the new one is booked."
      size="sm"
      footer={
        <>
          <Button variant="outline" size="lg" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Spinner />}
            {submitting ? 'Sending…' : 'Send move request'}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Current day off</div>
            <div className="font-medium">{oldDateLabel}</div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">New day off</div>
            <div className="font-medium">{newDate ? formatShortDate(newDate) : 'Not picked yet'}</div>
          </div>
        </div>

        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="move-new-date">New date</FieldLabel>
          <Input
            id="move-new-date"
            type="date"
            value={newDate}
            min={todayStr()}
            onChange={(e) => { setNewDate(e.target.value); setError(''); }}
            aria-invalid={error ? true : undefined}
            className="h-10 dark:scheme-dark"
          />
          {error ? <FieldError>{error}</FieldError> : <FieldDescription>Today or later.</FieldDescription>}
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
