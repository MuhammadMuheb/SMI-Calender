import { Modal, Badge, LeaveAllowanceCard } from './ui';
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
      title="Leave & Attendance Details"
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

        {/* Monthly Vacation Balance */}
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>
              📅 Monthly Vacation Balance
            </p>
            <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
              Accrues automatically • Never expires • Rolls over
            </p>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}` }}
          >
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>
                  {balance.vacationDaysRemaining} of {balance.vacationDaysTotal} days remaining
                </p>
                <p className="text-[9px]" style={{ color: theme.colors.grayDark }}>
                  {balance.vacationDaysUsed} days already used
                </p>
              </div>
              <p className="text-2xl font-bold" style={{ color: theme.colors.warning }}>
                {balance.vacationDaysRemaining}
              </p>
            </div>
            {/* Visual progress bar */}
            <div className="flex gap-2">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.colors.secondary }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${vacationUsagePct}%`,
                    backgroundColor: theme.colors.warning,
                  }}
                />
              </div>
              <span className="text-[9px] font-semibold" style={{ color: theme.colors.grayDark }}>
                {vacationUsagePct}%
              </span>
            </div>
            <div className="mt-2 flex gap-2 text-[9px]" style={{ color: theme.colors.grayDark }}>
              <span>Used: {balance.vacationDaysUsed}</span>
              <span>•</span>
              <span>Total: {balance.vacationDaysTotal}</span>
            </div>
          </div>
        </div>

        {/* Weekly/Cycle Regular Days Balance */}
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>
              📊 Weekly / Cycle Regular Days
            </p>
            <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
              Resets each cycle • Current: {balance.cycleStart} to {balance.cycleEnd}
            </p>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}` }}
          >
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>
                  {balance.regularDaysRemaining} of {balance.regularDaysAllowed} days remaining
                </p>
                <p className="text-[9px]" style={{ color: theme.colors.grayDark }}>
                  {balance.regularDaysUsed} days already used
                </p>
              </div>
              <p className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
                {balance.regularDaysRemaining}
              </p>
            </div>
            {/* Visual progress bar */}
            <div className="flex gap-2">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.colors.secondary }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${regularUsagePct}%`,
                    backgroundColor: theme.colors.primary,
                  }}
                />
              </div>
              <span className="text-[9px] font-semibold" style={{ color: theme.colors.grayDark }}>
                {regularUsagePct}%
              </span>
            </div>
            <div className="mt-2 flex gap-2 text-[9px]" style={{ color: theme.colors.grayDark }}>
              <span>Used: {balance.regularDaysUsed}</span>
              <span>•</span>
              <span>Allowed: {balance.regularDaysAllowed}</span>
            </div>
          </div>
        </div>

        {/* Key Info Box */}
        <div
          className="p-2.5 rounded-lg text-[9px]"
          style={{ backgroundColor: alpha(theme.colors.primary, '10'), border: `1px solid ${alpha(theme.colors.primary, '30')}` }}
        >
          <p style={{ color: theme.colors.primaryLight }}>
            <strong>ℹ️ Note:</strong> Vacation days accrue automatically at 2 days per month based on hire date.
            Regular days reset each cycle. Approved leave requests automatically deduct from balances.
          </p>
        </div>
      </div>
    </Modal>
  );
}
