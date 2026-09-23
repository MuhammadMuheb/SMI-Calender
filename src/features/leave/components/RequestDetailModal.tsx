import { useState, useMemo, type ReactNode } from 'react';
import { Ban, Check, ShieldAlert, ShieldCheck, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { useAppData } from '@/app/AppDataContext';
import BalanceRing from '@/features/leave/components/BalanceRing';
import { LeaveStatusBadge, LeaveTypeBadge, formatShortDate } from '@/features/leave/leaveMeta';
import { displayStaffNote } from '@/features/leave/requestNotes';
import { cn } from '@/lib/utils';
import type { LeaveRequest } from '@/models/leave';
import { checkStaffingForDate, wouldCauseShortage, getUserJobRoleIds, scopeStatusesToRoles } from '@/services/staffingService';

/**
 * Request details with the requester's balance and the staffing impact of
 * approving it. Managers approve or decline pending requests; a super admin
 * can also remove an approved day off.
 */

interface RequestDetailModalProps {
  request: LeaveRequest | null;
  open: boolean;
  onClose: () => void;
}

type ImpactLevel = 'safe' | 'warning' | 'danger';
type Action = 'approve' | 'reject' | 'remove';

const IMPACT: Record<ImpactLevel, { title: string; description: string; icon: typeof ShieldCheck; className: string }> = {
  safe: {
    title: 'Enough cover if approved',
    description: 'Every role this person works stays at or above its minimum.',
    icon: ShieldCheck,
    className: 'border-success/25 bg-success/8 text-success',
  },
  warning: {
    title: 'Cover gets thin if approved',
    description: 'At least one role drops below its minimum. You can still approve.',
    icon: ShieldAlert,
    className: 'border-warning/25 bg-warning/8 text-warning',
  },
  danger: {
    title: 'Below minimum cover',
    description: 'Approving would break a hard staffing rule. Decline it, or ask a super admin to adjust the rule.',
    icon: Ban,
    className: 'border-destructive/25 bg-destructive/8 text-destructive',
  },
};

function longDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function RequestDetailModal({
  request,
  open,
  onClose,
}: RequestDetailModalProps) {
  const { user } = useAuth();
  const { approve, reject, cancelRequest, requests, getBalance } = useLeave();
  const { jobRoles, roleAssignments, staffingRules } = useAppData();
  const [note, setNote] = useState('');
  const [working, setWorking] = useState<Action | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Compute staffing impact
  const impact = useMemo(() => {
    if (!request) return null;

    const roleNames: Record<string, string> = {};
    for (const r of jobRoles) roleNames[r.id] = r.name;

    // Already-approved leave on this date (excluding the current request)
    const approvedOnDate = requests.filter(
      (r) => r.date === request.date && r.status === 'approved' && r.id !== request.id,
    );

    // Staffing IF this request were approved (add this user to the "off" list)
    const withApproval = checkStaffingForDate(
      request.date, staffingRules, roleAssignments, [...approvedOnDate, request], roleNames,
    );

    // Only the requester's own job role(s) are relevant here — an unrelated
    // department that's already short-staffed that day must not block or even
    // show up as a warning against a request that has nothing to do with it.
    const myRoleIds = getUserJobRoleIds(request.userId, roleAssignments);
    const myWithApproval = scopeStatusesToRoles(withApproval, myRoleIds);

    const { hasShortage, hasHardBlock } = wouldCauseShortage(myWithApproval);

    let level: ImpactLevel = 'safe';
    if (hasHardBlock) level = 'danger';
    else if (hasShortage) level = 'warning';

    return { withApproval: myWithApproval, level, hasHardBlock };
  }, [request, requests, jobRoles, roleAssignments, staffingRules]);

  if (!request || !user) return null;

  const employeeBalance = getBalance(request.userId);
  const isPending = request.status === 'pending';
  const canRemove = request.status === 'approved' && user.role === 'super_admin';
  const approverRef = { id: user.id, displayName: user.displayName, role: user.role };
  const firstName = request.userRef.displayName.split(' ')[0] || 'them';
  const staffNote = displayStaffNote(request.staffNote);

  const handleClose = () => {
    if (working) return;
    setNote('');
    setConfirmRemove(false);
    onClose();
  };

  const run = async (action: Action, call: () => Promise<string | null>, success: string) => {
    setWorking(action);
    const err = await call();
    setWorking(null);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(success);
    setNote('');
    setConfirmRemove(false);
    onClose();
  };

  const handleApprove = () => run('approve', () => approve(request.id, approverRef, note), 'Request approved');
  const handleReject = () => run('reject', () => reject(request.id, approverRef, note), 'Request declined');
  const handleRemove = () => run('remove', () => cancelRequest(request.id), 'Day off removed');

  const impactMeta = impact ? IMPACT[impact.level] : null;
  const ImpactIcon = impactMeta?.icon;

  const footer = isPending ? (
    <>
      <Button variant="outline" size="lg" onClick={handleReject} disabled={!!working}>
        {working === 'reject' ? <Spinner /> : <X data-icon="inline-start" />}
        Decline
      </Button>
      <Button size="lg" onClick={handleApprove} disabled={!!working || impact?.hasHardBlock}>
        {working === 'approve' ? <Spinner /> : <Check data-icon="inline-start" />}
        Approve
      </Button>
    </>
  ) : canRemove ? (
    <Button variant="destructive" size="lg" onClick={() => setConfirmRemove(true)} disabled={!!working}>
      {working === 'remove' ? <Spinner /> : <Trash2 data-icon="inline-start" />}
      Remove day off
    </Button>
  ) : undefined;

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={(o) => { if (!o) handleClose(); }}
        title="Request details"
        size="md"
        footer={footer}
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <UserAvatar name={request.userRef.displayName} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{request.userRef.displayName}</p>
              <p className="text-sm text-muted-foreground">{formatShortDate(request.date)}</p>
            </div>
            <LeaveStatusBadge status={request.status} />
          </div>

          <dl className="divide-y rounded-lg border text-sm">
            <DetailRow label="Date">{longDate(request.date)}</DetailRow>
            <DetailRow label="Type"><LeaveTypeBadge type={request.leaveType} /></DetailRow>
            {staffNote && <DetailRow label="Staff note">{staffNote}</DetailRow>}
            {request.approverNote && <DetailRow label="Manager note">{request.approverNote}</DetailRow>}
            {request.isOverridden && (
              <DetailRow label="Override">
                Changed by {request.overriddenBy?.displayName ?? 'a super admin'}
              </DetailRow>
            )}
          </dl>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">{firstName}’s balance</h3>
            <div className="grid grid-cols-2 gap-4">
              <BalanceRing
                label="Regular days"
                sublabel="days"
                remaining={employeeBalance.regularDaysRemaining}
                total={employeeBalance.regularDaysAllowed}
                tone="day-off"
              />
              <BalanceRing
                label="Vacation"
                sublabel="days"
                remaining={employeeBalance.vacationDaysRemaining}
                total={employeeBalance.vacationDaysTotal}
                tone="vacation"
              />
            </div>
          </section>

          {isPending && impact && impactMeta && ImpactIcon && (
            <section className={cn('rounded-lg border p-3', impactMeta.className)} aria-live="polite">
              <div className="flex items-start gap-2">
                <ImpactIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{impactMeta.title}</p>
                  <p className="text-sm text-muted-foreground">{impactMeta.description}</p>
                </div>
              </div>

              {impact.withApproval.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-current/15 pt-3">
                  {impact.withApproval.map((s) => (
                    <li key={s.jobRoleId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-foreground">{s.jobRoleName}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={cn(
                            'font-medium tabular-nums',
                            s.surplus < 0 ? 'text-destructive' : s.surplus === 0 ? 'text-warning' : 'text-success',
                          )}
                        >
                          {s.scheduled} of {s.required} min
                        </span>
                        {s.enforcement === 'hard_block' && s.surplus < 0 && (
                          <Badge variant="destructive">Blocked</Badge>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {isPending && (
            <Field>
              <FieldLabel htmlFor="approver-note">Note for {firstName} (optional)</FieldLabel>
              <Textarea
                id="approver-note"
                placeholder="Shown with your decision"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={!!working}
                rows={2}
              />
              <FieldDescription>Sent along with the approval or decline.</FieldDescription>
            </Field>
          )}
        </div>
      </ResponsiveDialog>

      <AlertDialog open={confirmRemove} onOpenChange={(o) => { if (!working) setConfirmRemove(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this day off?</AlertDialogTitle>
            <AlertDialogDescription>
              {request.userRef.displayName}’s day off on {formatShortDate(request.date)} is cancelled and the day goes
              back into their balance, so they can pick a new date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!working}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!!working}
              onClick={(e) => { e.preventDefault(); void handleRemove(); }}
            >
              {working === 'remove' && <Spinner />}
              Remove day off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right wrap-break-word">{children}</dd>
    </div>
  );
}
