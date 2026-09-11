import { useState, useMemo } from 'react';
import { Modal, Button, Badge, FormInput, BalanceRing } from '../components/ui';
import { theme } from '../config/theme';
import { alpha } from '../utils/themeColor';
import { useAuth } from '../context/AuthContext';
import { useLeave } from '../context/LeaveContext';
import { useAppData } from '../context/AppDataContext';
import type { LeaveRequest } from '../models/leave';
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from '../models/leave';
import { checkStaffingForDate, wouldCauseShortage, getUserJobRoleIds, scopeStatusesToRoles } from '../services/staffingService';

/**
 * STATUS: UI COMPLETE, USES IN-MEMORY STORE (MOCK)
 * Shows request details + staffing impact.
 * Manager can approve/reject with optional note.
 */

interface RequestDetailModalProps {
  request: LeaveRequest | null;
  open: boolean;
  onClose: () => void;
}

type ImpactLevel = 'safe' | 'warning' | 'danger';

export default function RequestDetailModal({
  request,
  open,
  onClose,
}: RequestDetailModalProps) {
  const { user } = useAuth();
  const { approve, reject, cancelRequest, requests, getBalance } = useLeave();
  const { jobRoles, roleAssignments, staffingRules } = useAppData();
  const [note, setNote] = useState('');
  const [actionDone, setActionDone] = useState<'approved' | 'rejected' | null>(null);

  // Compute staffing impact
  const impact = useMemo(() => {
    if (!request) return null;

    const roleNames: Record<string, string> = {};
    for (const r of jobRoles) roleNames[r.id] = r.name;

    // Get already-approved leaves on this date (excluding the current request)
    const approvedOnDate = requests.filter(
      (r) =>
        r.date === request.date &&
        r.status === 'approved' &&
        r.id !== request.id,
    );

    // Check current staffing (without this request approved)
    const currentStatuses = checkStaffingForDate(
      request.date,
      staffingRules,
      roleAssignments,
      approvedOnDate,
      roleNames,
    );

    // Check staffing IF this request were approved (add this user to the "off" list)
    const withApproval = checkStaffingForDate(
      request.date,
      staffingRules,
      roleAssignments,
      [...approvedOnDate, request],
      roleNames,
    );

    // Only the requester's own job role(s) are relevant here — an unrelated
    // department that's already short-staffed that day must not block or even
    // show up as a warning against a request that has nothing to do with it.
    const myRoleIds = getUserJobRoleIds(request.userId, roleAssignments);
    const myCurrentStatuses = scopeStatusesToRoles(currentStatuses, myRoleIds);
    const myWithApproval = scopeStatusesToRoles(withApproval, myRoleIds);

    const { hasShortage, hasHardBlock, warnings } = wouldCauseShortage(myWithApproval);

    let level: ImpactLevel = 'safe';
    if (hasHardBlock) level = 'danger';
    else if (hasShortage) level = 'warning';

    return { currentStatuses: myCurrentStatuses, withApproval: myWithApproval, level, hasHardBlock, warnings };
  }, [request, requests, jobRoles, roleAssignments, staffingRules]);

  if (!request || !user) return null;

  const employeeBalance = getBalance(request.userId);
  const isPending = request.status === 'pending';
  const approverRef = { id: user.id, displayName: user.displayName, role: user.role };

  const handleApprove = () => {
    approve(request.id, approverRef, note);
    setActionDone('approved');
    setTimeout(() => {
      setActionDone(null);
      setNote('');
      onClose();
    }, 1000);
  };

  const handleReject = () => {
    reject(request.id, approverRef, note);
    setActionDone('rejected');
    setTimeout(() => {
      setActionDone(null);
      setNote('');
      onClose();
    }, 1000);
  };

  const handleClose = () => {
    setActionDone(null);
    setNote('');
    onClose();
  };

  const impactColors: Record<ImpactLevel, string> = {
    safe: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
  };

  const impactLabels: Record<ImpactLevel, string> = {
    safe: 'Safe to Approve',
    warning: 'Warning — Low Coverage',
    danger: 'Below Minimum — Hard Block',
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Request Details"
      footer={
        isPending && !actionDone ? (
          <>
            <Button variant="outline" onClick={handleReject}>
              Reject
            </Button>
            <Button
              variant="primary"
              onClick={handleApprove}
              disabled={impact?.hasHardBlock}
            >
              Approve
            </Button>
          </>
        ) : undefined
      }
    >
      {/* Action confirmation */}
      {actionDone && (
        <div className="flex items-center gap-2 mb-3">
          <Badge color={actionDone === 'approved' ? 'success' : 'danger'}>
            {actionDone === 'approved' ? 'Approved' : 'Rejected'}
          </Badge>
          <span className="text-xs" style={{ color: theme.colors.gray }}>
            Done
          </span>
        </div>
      )}

      {/* Staff info */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ backgroundColor: theme.colors.primary, color: theme.colors.white }}
        >
          {request.userRef.displayName[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: theme.colors.white }}>
            {request.userRef.displayName}
          </p>
          <Badge
            color={LEAVE_STATUS_COLORS[request.status] as 'warning' | 'success' | 'danger' | 'gray'}
            size="xs"
          >
            {LEAVE_STATUS_LABELS[request.status]}
          </Badge>
        </div>
      </div>

      {/* Request details */}
      <div className="space-y-2 mb-4">
        <DetailRow label="Date" value={
          new Date(request.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        } />
        <DetailRow label="Type" value={LEAVE_TYPE_LABELS[request.leaveType]} />
        {request.staffNote && (
          <DetailRow label="Staff Note" value={request.staffNote} />
        )}
        {request.approverNote && (
          <DetailRow label="Manager Note" value={request.approverNote} />
        )}
        {request.isOverridden && (
          <DetailRow label="Override" value={`Overridden by ${request.overriddenBy?.displayName}`} />
        )}
      </div>

      {/* Employee balance */}
      <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}` }}>
        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.colors.grayDark }}>Employee Balance</p>
        <div className="flex items-center justify-around">
          <BalanceRing label="Regular Days" sublabel="days" remaining={employeeBalance.regularDaysRemaining} total={employeeBalance.regularDaysAllowed} color={theme.colors.primary} size={68} />
          <BalanceRing label="Vacation" sublabel="days" remaining={employeeBalance.vacationDaysRemaining} total={employeeBalance.vacationDaysTotal} color={theme.colors.white} size={68} />
        </div>
      </div>

      {/* Staffing impact panel */}
      {isPending && impact && (
        <div
          className="rounded-lg p-3 mb-4"
          style={{
            backgroundColor: impactColors[impact.level] + '10',
            border: `1px solid ${impactColors[impact.level]}30`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: impactColors[impact.level] }}
            />
            <span className="text-xs font-semibold" style={{ color: impactColors[impact.level] }}>
              {impactLabels[impact.level]}
            </span>
          </div>

          {/* Per-role breakdown */}
          <div className="space-y-1.5">
            {impact.withApproval.map((s) => (
              <div key={s.jobRoleId} className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: theme.colors.gray }}>
                  {s.jobRoleName}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-medium"
                    style={{
                      color: s.surplus < 0
                        ? theme.colors.danger
                        : s.surplus === 0
                          ? theme.colors.warning
                          : theme.colors.success,
                    }}
                  >
                    {s.scheduled} / {s.required} min
                  </span>
                  {s.enforcement === 'hard_block' && s.surplus < 0 && (
                    <Badge color="danger" size="xs">BLOCKED</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Super Admin: Delete approved day off */}
      {request.status === 'approved' && user.role === 'super_admin' && !actionDone && (
        <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: alpha(theme.colors.danger, '10'), border: `1px solid ${alpha(theme.colors.danger, '30')}` }}>
          <p className="text-[10px] font-medium mb-2" style={{ color: theme.colors.danger }}>
            Remove this day off? Quota will be restored so they can pick a new date.
          </p>
          <button onClick={() => { cancelRequest(request.id); setActionDone('rejected'); setTimeout(() => { setActionDone(null); setNote(''); onClose(); }, 1000); }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-medium cursor-pointer"
            style={{ backgroundColor: theme.colors.danger, color: theme.colors.white }}>
            🗑 Delete Day Off
          </button>
        </div>
      )}
      {/* Approver note input */}
      {isPending && !actionDone && (
        <FormInput
          label="Note (optional)"
          placeholder="Add a note for the staff member..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: theme.colors.grayDark }}>
        {label}
      </span>
      <span className="text-xs text-right max-w-[60%]" style={{ color: theme.colors.white }}>
        {value}
      </span>
    </div>
  );
}
