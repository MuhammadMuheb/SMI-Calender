import { useState, useMemo, useRef, type FormEvent } from 'react';
import { AlertCircle, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldLegend, FieldTitle,
} from '@/components/ui/field';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { useAppData } from '@/app/AppDataContext';
import { leaveTypeMeta } from '@/features/leave/leaveMeta';
import { cn } from '@/lib/utils';
import type { LeaveType } from '@/models/leave';
import { formatDateLocal } from '@/utils/dateUtils';
import { getPickableDateRange, getCurrentCycle, getCycleLabel, getRemainingQuota } from '@/utils/cycleUtils';
import VacationDateRangeSelector from '@/features/leave/components/VacationDateRangeSelector';

interface RequestFormModalProps { open: boolean; onClose: () => void; }

type RequestableType = Extract<LeaveType, 'regular_day_off' | 'paid_vacation' | 'sick_day'>;

const FORM_ID = 'request-time-off-form';

function getTodayStr(): string {
  return formatDateLocal(new Date());
}

function getYearEnd(): string {
  return `${new Date().getFullYear()}-12-31`;
}

export default function RequestFormModal({ open, onClose }: RequestFormModalProps) {
  const { user } = useAuth();
  const { submitRequest, submitRangeRequest, requests } = useLeave();
  const { roleAssignments } = useAppData();

  const [leaveType, setLeaveType] = useState<RequestableType>('regular_day_off');
  const [date, setDate] = useState('');
  const [vacationStartDate, setVacationStartDate] = useState('');
  const [vacationEndDate, setVacationEndDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const userId = user?.id ?? '';

  // Staffing constraints
  const staffingConstraints = useMemo(() => {
    const userRoles = roleAssignments.filter((a) => a.userId === userId).map((a) => a.jobRoleId);

    if (userRoles.length === 0) {
      return { isRoleTooSmall: true, lockedDates: new Set<string>() };
    }

    let isRoleTooSmall = false;
    for (const roleId of userRoles) {
      const staffCount = roleAssignments.filter((a) => a.jobRoleId === roleId).length;
      if (staffCount < 3) {
        isRoleTooSmall = true;
        break;
      }
    }

    const lockedDates = new Set<string>();
    if (!isRoleTooSmall) {
      for (const roleId of userRoles) {
        const approvedForRole = requests.filter(
          (r) =>
            r.status === 'approved' &&
            roleAssignments.some((a) => a.userId === r.userId && a.jobRoleId === roleId),
        );

        const dateCount = new Map<string, number>();
        for (const req of approvedForRole) {
          dateCount.set(req.date, (dateCount.get(req.date) ?? 0) + 1);
        }

        for (const [d, count] of dateCount.entries()) {
          if (count >= 2) lockedDates.add(d);
        }
      }
    }

    return { isRoleTooSmall, lockedDates };
  }, [userId, roleAssignments, requests]);

  // Cycle-aware date range
  const cycleRange = useMemo(() => getPickableDateRange(), []);
  const currentCycle = useMemo(() => getCurrentCycle(), []);

  // Approved days in current cycle
  const approvedInCurrentCycle = useMemo(() => {
    if (!currentCycle) return [];
    return requests
      .filter((r) => r.userId === userId && r.status === 'approved' && r.leaveType === 'regular_day_off' && r.date >= currentCycle.start && r.date <= currentCycle.end)
      .map((r) => r.date);
  }, [requests, userId, currentCycle]);

  const remainingQuota = useMemo(() => {
    if (!currentCycle) return 0;
    return getRemainingQuota(currentCycle, approvedInCurrentCycle);
  }, [currentCycle, approvedInCurrentCycle]);

  const pendingInCurrentCycle = useMemo(() => {
    if (!currentCycle) return 0;
    return requests.filter((r) => r.userId === userId && r.status === 'pending' && r.leaveType === 'regular_day_off' && r.date >= currentCycle.start && r.date <= currentCycle.end).length;
  }, [requests, userId, currentCycle]);

  const effectiveRemaining = remainingQuota - pendingInCurrentCycle;

  const { minDate, maxDate, dateLabel } = useMemo(() => {
    if (leaveType === 'sick_day' || leaveType === 'paid_vacation') {
      return { minDate: getTodayStr(), maxDate: getYearEnd(), dateLabel: 'today through the end of the year' };
    }
    if (!cycleRange) {
      return { minDate: '', maxDate: '', dateLabel: 'the current cycle' };
    }
    const label = currentCycle ? getCycleLabel(currentCycle) : 'the current cycle';
    return { minDate: cycleRange.min, maxDate: cycleRange.max, dateLabel: label };
  }, [leaveType, cycleRange, currentCycle]);

  if (!user) return null;

  const isRegularLocked = leaveType === 'regular_day_off' && (!cycleRange || cycleRange.locked);
  const isOverQuota = leaveType === 'regular_day_off' && effectiveRemaining <= 0;
  const isDateInputDisabled = staffingConstraints.isRoleTooSmall;

  const chooseType = (value: string) => {
    setLeaveType(value as RequestableType);
    setDate('');
    setError('');
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (submitting) return; // Prevent double submissions
    setError('');

    let submitDate = date;
    let submitEndDate = '';

    if (leaveType === 'paid_vacation') {
      if (!vacationStartDate || !vacationEndDate) {
        setError('Pick the first and last day of your vacation.');
        return;
      }
      submitDate = vacationStartDate;
      submitEndDate = vacationEndDate;
    } else if (!date) {
      setError('Pick a date.');
      return;
    }

    // Validate staffing constraints
    if (staffingConstraints.isRoleTooSmall) {
      setError('Your role has fewer than 3 staff, so time-off requests are locked. Ask your manager to arrange it with you.');
      return;
    }
    if (staffingConstraints.lockedDates.has(submitDate)) {
      setError('Two people in your role are already off that day. Pick another date.');
      return;
    }

    if (leaveType === 'regular_day_off') {
      if (isRegularLocked) {
        setError('Day off requests are locked right now. Contact a super admin.');
        return;
      }
      if (isOverQuota) {
        setError(`You have no days off left this cycle (quota: ${currentCycle?.quota || 0}). Try paid vacation instead.`);
        return;
      }
      if (cycleRange && (submitDate < cycleRange.min || submitDate > cycleRange.max)) {
        setError(`Pick a date within ${dateLabel}.`);
        return;
      }
    }

    const attachmentUrl = attachment && leaveType === 'sick_day' ? `[File: ${attachment.name}]` : null;
    const fullNote = [note, attachmentUrl ? `Attachment: ${attachmentUrl}` : ''].filter(Boolean).join(' | ');
    const userRef = { id: user.id, displayName: user.displayName, role: user.role };

    setSubmitting(true);
    try {
      const err = leaveType === 'paid_vacation'
        ? await submitRangeRequest(userRef, submitDate, submitEndDate, leaveType, fullNote)
        : await submitRequest(user.id, userRef, submitDate, leaveType, fullNote);

      if (err) {
        setError(err);
        toast.error(err);
        return;
      }

      toast.success(leaveType === 'paid_vacation' ? 'Vacation request sent' : 'Request sent');
      setDate('');
      setVacationStartDate('');
      setVacationEndDate('');
      setNote('');
      setAttachment(null);
      if (fileRef.current) fileRef.current.value = '';
      onClose();
    } catch (err) {
      console.error('Failed to submit leave request:', err);
      const message = err instanceof Error ? err.message : 'Couldn’t send your request. Try again.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const typeOptions: { value: RequestableType; title: string; description: string }[] = [
    {
      value: 'regular_day_off',
      title: 'Day off',
      description: currentCycle
        ? `${Math.max(effectiveRemaining, 0)} left this cycle`
        : 'From your cycle allowance',
    },
    { value: 'paid_vacation', title: 'Paid vacation', description: 'A date range · uses vacation days' },
    { value: 'sick_day', title: 'Sick day', description: 'Medical certificate optional' },
  ];

  const submitDisabled = submitting || isRegularLocked || isOverQuota;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => { if (!o) handleClose(); }}
      title="Request time off"
      description="Your manager gets a notification and reviews it."
      size="md"
      footer={
        <>
          <Button type="button" variant="outline" size="lg" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} size="lg" disabled={submitDisabled}>
            {submitting && <Spinner />}
            {submitting ? 'Sending…' : leaveType === 'paid_vacation' ? 'Request vacation' : 'Send request'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">Type of leave</FieldLegend>
            <RadioGroup value={leaveType} onValueChange={chooseType}>
              {typeOptions.map((opt) => {
                const meta = leaveTypeMeta(opt.value);
                const Icon = meta.icon;
                const id = `leave-type-${opt.value}`;
                return (
                  <FieldLabel key={opt.value} htmlFor={id}>
                    <Field orientation="horizontal">
                      <span
                        aria-hidden="true"
                        className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', meta.chip)}
                      >
                        <Icon className="size-4" />
                      </span>
                      <FieldContent>
                        <FieldTitle>{opt.title}</FieldTitle>
                        <FieldDescription>{opt.description}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={opt.value} id={id} />
                    </Field>
                  </FieldLabel>
                );
              })}
            </RadioGroup>
          </FieldSet>

          {leaveType === 'regular_day_off' && (
            <>
              {currentCycle && (
                <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{getCycleLabel(currentCycle)}</span>
                    <span className="shrink-0 text-muted-foreground">{currentCycle.weeks} weeks</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground tabular-nums">Quota: {currentCycle.quota} days</span>
                    <span className={cn('font-medium tabular-nums', effectiveRemaining > 0 ? 'text-primary' : 'text-destructive')}>
                      {effectiveRemaining} left
                    </span>
                  </div>
                  {pendingInCurrentCycle > 0 && (
                    <p className="mt-1 text-warning">
                      {pendingInCurrentCycle} pending request{pendingInCurrentCycle > 1 ? 's' : ''} counted
                    </p>
                  )}
                </div>
              )}

              <Field data-disabled={isDateInputDisabled || isRegularLocked ? true : undefined}>
                <FieldLabel htmlFor="request-date">Date</FieldLabel>
                <Input
                  id="request-date"
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setError(''); }}
                  min={minDate}
                  max={maxDate || undefined}
                  disabled={isDateInputDisabled || isRegularLocked}
                  className="h-10 dark:scheme-dark"
                />
                {isDateInputDisabled ? (
                  <FieldDescription className="text-destructive">
                    Your role has fewer than 3 staff, so day off requests are locked. Ask your manager.
                  </FieldDescription>
                ) : isRegularLocked ? (
                  <FieldDescription className="text-destructive">
                    Day off requests are locked right now. Contact a super admin.
                  </FieldDescription>
                ) : isOverQuota ? (
                  <FieldDescription className="text-destructive">
                    You’ve used all your days off this cycle. Try paid vacation instead.
                  </FieldDescription>
                ) : (
                  <FieldDescription>Any day in {dateLabel}.</FieldDescription>
                )}
              </Field>
            </>
          )}

          {leaveType === 'paid_vacation' && (
            <VacationDateRangeSelector
              onSelectRange={(start, end) => {
                setVacationStartDate(start);
                setVacationEndDate(end);
                setError('');
              }}
              defaultStartDate={vacationStartDate}
              defaultEndDate={vacationEndDate}
              minDate={minDate}
              maxDate={maxDate}
            />
          )}

          {leaveType === 'sick_day' && (
            <>
              <Field>
                <FieldLabel htmlFor="sick-date">Date</FieldLabel>
                <Input
                  id="sick-date"
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setError(''); }}
                  min={minDate}
                  max={maxDate || undefined}
                  className="h-10 dark:scheme-dark"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="sick-attachment">Medical certificate (optional)</FieldLabel>
                <input
                  ref={fileRef}
                  id="sick-attachment"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
                {attachment ? (
                  <div className="flex h-10 items-center gap-2 rounded-lg border px-3 text-sm">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove attachment"
                      onClick={() => {
                        setAttachment(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="lg" className="h-10 justify-start" onClick={() => fileRef.current?.click()}>
                    <Paperclip data-icon="inline-start" />
                    Attach a photo or PDF
                  </Button>
                )}
              </Field>
            </>
          )}

          <Field>
            <FieldLabel htmlFor="request-note">Note for your manager (optional)</FieldLabel>
            <Textarea
              id="request-note"
              placeholder="Anything they should know"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </Field>

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  );
}
