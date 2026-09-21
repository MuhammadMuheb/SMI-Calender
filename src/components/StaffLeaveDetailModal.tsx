import { Modal, Badge } from './ui';
import { theme } from '../config/theme';
import { alpha } from '../utils/themeColor';
import type { LeaveBalance } from '../models/balance';
import type { StaffUser } from '../models/user';

interface StaffLeaveDetailModalProps {
  open: boolean;
  onClose: () => void;
  staff: StaffUser | null;
  balance: LeaveBalance | null;
}

export default function StaffLeaveDetailModal({
  open,
  onClose,
  staff,
  balance,
}: StaffLeaveDetailModalProps) {
  // Error boundary: render error state if data missing
  if (open && (!staff || !balance)) {
    return (
      <Modal open={open} onClose={onClose} title="Leave Details">
        <div className="p-4 text-center">
          <p style={{ color: theme.colors.danger }}>Unable to load leave details. Please try again.</p>
        </div>
      </Modal>
    );
  }

  if (!staff || !balance) return null;

  const regularUsagePct = balance.regularDaysAllowed > 0
    ? Math.round((balance.regularDaysUsed / balance.regularDaysAllowed) * 100)
    : 0;

  const vacationUsagePct = balance.vacationDaysTotal > 0
    ? Math.round((balance.vacationDaysUsed / balance.vacationDaysTotal) * 100)
    : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Complete Leave Balance"
    >
      <div className="space-y-4">
        {/* Staff Member Header */}
        <div className="flex items-center gap-3 pb-3" style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{
              backgroundColor: alpha(theme.colors.primary, '20'),
              color: theme.colors.primaryLight,
            }}
          >
            {staff.displayName[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: theme.colors.white }}>
              {staff.displayName}
            </p>
            <p className="text-xs" style={{ color: theme.colors.grayDark }}>
              {staff.username}
            </p>
          </div>
          <Badge color={staff.isActive ? 'success' : 'danger'} size="xs">
            {staff.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Cycle Context */}
        <div
          className="p-2.5 rounded-lg text-[9px]"
          style={{ backgroundColor: alpha(theme.colors.secondary, '15'), border: `1px solid ${alpha(theme.colors.secondary, '30')}` }}
        >
          <p style={{ color: theme.colors.white }}>
            <strong>📅 Current Cycle:</strong> {balance.cycleStart} to {balance.cycleEnd}
          </p>
        </div>

        {/* Monthly Vacation Balance */}
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>
              🏖️ Monthly Vacation Balance
            </p>
            <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
              Accrues automatically • Never expires • Rolls over
            </p>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}` }}
          >
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>
                  {balance.vacationDaysRemaining} of {balance.vacationDaysTotal} days remaining
                </p>
                <p className="text-[9px]" style={{ color: theme.colors.grayDark }}>
                  {balance.vacationDaysUsed} days already used
                </p>
              </div>
              <p className="text-3xl font-bold" style={{ color: theme.colors.warning }}>
                {balance.vacationDaysRemaining}
              </p>
            </div>
            {/* Visual progress bar */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.colors.secondary }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${vacationUsagePct}%`,
                    backgroundColor: theme.colors.warning,
                  }}
                />
              </div>
              <span className="text-[9px] font-semibold w-8 text-right" style={{ color: theme.colors.grayDark }}>
                {vacationUsagePct}%
              </span>
            </div>
          </div>
        </div>

        {/* Regular Days Off Balance */}
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>
              📋 Regular Days Off (This Cycle)
            </p>
            <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
              Resets at the end of each cycle
            </p>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}` }}
          >
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>
                  {balance.regularDaysRemaining} of {balance.regularDaysAllowed} days remaining
                </p>
                <p className="text-[9px]" style={{ color: theme.colors.grayDark }}>
                  {balance.regularDaysUsed} days already used
                </p>
              </div>
              <p className="text-3xl font-bold" style={{ color: theme.colors.primary }}>
                {balance.regularDaysRemaining}
              </p>
            </div>
            {/* Visual progress bar */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.colors.secondary }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${regularUsagePct}%`,
                    backgroundColor: theme.colors.primary,
                  }}
                />
              </div>
              <span className="text-[9px] font-semibold w-8 text-right" style={{ color: theme.colors.grayDark }}>
                {regularUsagePct}%
              </span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div
          className="p-2.5 rounded-lg text-[9px] space-y-1"
          style={{ backgroundColor: alpha(theme.colors.primary, '10'), border: `1px solid ${alpha(theme.colors.primary, '30')}` }}
        >
          <p style={{ color: theme.colors.primaryLight }}>
            <strong>ℹ️ Balance Types:</strong>
          </p>
          <p style={{ color: theme.colors.primaryLight }}>
            🏖️ Vacation: Accrues 2 days/month, never expires, rolls over
          </p>
          <p style={{ color: theme.colors.primaryLight }}>
            📋 Regular Days: Resets each cycle, approvals auto-deduct
          </p>
        </div>
      </div>
    </Modal>
  );
}
