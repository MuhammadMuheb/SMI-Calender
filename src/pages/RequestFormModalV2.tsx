import { useState, useMemo, useRef } from 'react';
import { Modal, Button, FormInput, Badge } from '../components/ui';
import { ShadButton } from '../components/ui/ShadButton';
import { theme } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { useLeave } from '../context/LeaveContext';
import { useAppData } from '../context/AppDataContext';
import type { LeaveType } from '../models/leave';
import { LEAVE_TYPE_LABELS } from '../models/leave';
import { getPickableDateRange, getCurrentCycle, getCycleLabel, getRemainingQuota } from '../utils/cycleUtils';
import { submitMultiDayLeaveRequest } from '../services/multiDayLeaveService';
import VacationDateRangeSelector from '../components/VacationDateRangeSelector';

interface RequestFormModalV2Props { open: boolean; onClose: () => void; }

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYearEnd(): string {
  return `${new Date().getFullYear()}-12-31`;
}

export default function RequestFormModalV2({ open, onClose }: RequestFormModalV2Props) {
  const { user } = useAuth();
  const { submitRequest, requests } = useLeave();
  const { roleAssignments, jobRoles } = useAppData();

  const [leaveType, setLeaveType] = useState<LeaveType>('regular_day_off');
  const [date, setDate] = useState('');
  const [vacationStartDate, setVacationStartDate] = useState('');
  const [vacationEndDate, setVacationEndDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  // Staffing constraints
  const staffingConstraints = useMemo(() => {
    const userAssignments = roleAssignments.filter((a) => a.userId === user.id);
    const userRoles = userAssignments.map((a) => a.jobRoleId);

    if (userRoles.length === 0) {
      return { isRoleTooSmall: true, lockedDates: new Set() };
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
            roleAssignments.some((a) => a.userId === r.userId && a.jobRoleId === roleId)
        );

        const dateCount = new Map<string, number>();
        for (const req of approvedForRole) {
          dateCount.set(req.date, (dateCount.get(req.date) ?? 0) + 1);
        }

        for (const [d, count] of dateCount.entries()) {
          if (count >= 2) {
            lockedDates.add(d);
          }
        }
      }
    }

    return { isRoleTooSmall, lockedDates };
  }, [user.id, roleAssignments, requests]);

  // Cycle-aware date range
  const cycleRange = useMemo(() => getPickableDateRange(user.role), [user.role]);
  const currentCycle = useMemo(() => getCurrentCycle(), []);

  // Approved days in current cycle
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

  const pendingInCurrentCycle = useMemo(() => {
    if (!currentCycle) return 0;
    return requests.filter((r) => r.userId === user.id && r.status === 'pending' && r.leaveType === 'regular_day_off' && r.date >= currentCycle.start && r.date <= currentCycle.end).length;
  }, [requests, user.id, currentCycle]);

  const effectiveRemaining = remainingQuota - pendingInCurrentCycle;

  const { minDate, maxDate, dateLabel } = useMemo(() => {
    if (leaveType === 'sick_day') {
      return { minDate: getTodayStr(), maxDate: getYearEnd(), dateLabel: 'Sick day — today through end of year' };
    }
    if (leaveType === 'paid_vacation') {
      return { minDate: getTodayStr(), maxDate: getYearEnd(), dateLabel: 'Vacation — today through end of year (uses vacation days)' };
    }
    if (!cycleRange) {
      return { minDate: '', maxDate: '', dateLabel: 'No current cycle available' };
    }
    const label = currentCycle ? getCycleLabel(currentCycle) : 'Current cycle';
    return { minDate: cycleRange.min, maxDate: cycleRange.max, dateLabel: label };
  }, [leaveType, cycleRange, currentCycle]);

  const isRegularLocked = leaveType === 'regular_day_off' && (!cycleRange || cycleRange.locked);
  const isOverQuota = leaveType === 'regular_day_off' && effectiveRemaining <= 0;
  const isDateInputDisabled = staffingConstraints.isRoleTooSmall;

  const handleSubmit = async () => {
    setError('');
    setSuccess(false);

    let submitDate = date;
    let submitEndDate = '';

    if (leaveType === 'paid_vacation') {
      if (!vacationStartDate || !vacationEndDate) {
        setError('Please select vacation dates');
        return;
      }
      submitDate = vacationStartDate;
      submitEndDate = vacationEndDate;
    } else {
      if (!date) {
        setError('Please select a date');
        return;
      }
    }

    // Validate staffing constraints
    if (staffingConstraints.isRoleTooSmall) {
      setError('❌ This role has fewer than 3 staff members. Date requests are locked for compliance.');
      return;
    }
    if (staffingConstraints.lockedDates.has(submitDate)) {
      setError('❌ This date is locked — maximum 2 staff in this role already approved for leave. Request denied.');
      return;
    }

    if (leaveType === 'regular_day_off') {
      if (isRegularLocked) {
        setError('Day off requests are locked — contact super admin.');
        return;
      }
      if (isOverQuota) {
        setError(`No days left in current cycle (quota: ${currentCycle?.quota || 0}).`);
        return;
      }
      if (cycleRange && (submitDate < cycleRange.min || submitDate > cycleRange.max)) {
        setError(`Date must be within ${dateLabel}`);
        return;
      }
    }

    let attachmentUrl: string | null = null;
    if (attachment && leaveType === 'sick_day') {
      setUploading(true);
      attachmentUrl = `[File: ${attachment.name}]`;
      setUploading(false);
    }

    const fullNote = [note, attachmentUrl ? `Attachment: ${attachmentUrl}` : ''].filter(Boolean).join(' | ');

    try {
      if (leaveType === 'paid_vacation') {
        await submitMultiDayLeaveRequest(
          user.id,
          submitDate,
          submitEndDate,
          leaveType,
          user.displayName,
          user.role,
          fullNote
        );
      } else {
        const err = await submitRequest(
          user.id,
          { id: user.id, displayName: user.displayName, role: user.role },
          submitDate,
          leaveType,
          fullNote
        );
        if (err) {
          setError(err);
          return;
        }
      }

      setSuccess(true);
      setDate('');
      setVacationStartDate('');
      setVacationEndDate('');
      setNote('');
      setAttachment(null);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    }
  };

  const c = theme.colors;

  return (
    <Modal open={open} onClose={onClose} title="Request Time Off">
      {/* Leave Type Selector - Improved Design */}
      <div className="space-y-2 mb-6">
        {/* Regular Day Off */}
        <button
          onClick={() => { setLeaveType('regular_day_off'); setDate(''); setError(''); }}
          className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
            leaveType === 'regular_day_off'
              ? `border-emerald-600 bg-emerald-600/10`
              : `border-slate-600 bg-slate-800/50 hover:border-slate-500`
          }`}
        >
          <p className="font-semibold text-sm" style={{ color: leaveType === 'regular_day_off' ? c.primaryLight : c.white }}>
            📅 Regular Day Off
          </p>
          <p className="text-xs mt-1" style={{ color: c.grayDark }}>
            {currentCycle ? `${getCycleLabel(currentCycle)} (${effectiveRemaining} remaining)` : 'Current cycle'}
          </p>
        </button>

        {/* Paid Vacation */}
        <button
          onClick={() => { setLeaveType('paid_vacation'); setDate(''); setError(''); }}
          className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
            leaveType === 'paid_vacation'
              ? `border-emerald-600 bg-emerald-600/10`
              : `border-slate-600 bg-slate-800/50 hover:border-slate-500`
          }`}
        >
          <p className="font-semibold text-sm" style={{ color: leaveType === 'paid_vacation' ? c.primaryLight : c.white }}>
            ✈️ Paid Vacation
          </p>
          <p className="text-xs mt-1" style={{ color: c.grayDark }}>
            Select date range · uses vacation days
          </p>
        </button>

        {/* Sick Day */}
        <button
          onClick={() => { setLeaveType('sick_day'); setDate(''); setError(''); }}
          className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
            leaveType === 'sick_day'
              ? `border-emerald-600 bg-emerald-600/10`
              : `border-slate-600 bg-slate-800/50 hover:border-slate-500`
          }`}
        >
          <p className="font-semibold text-sm" style={{ color: leaveType === 'sick_day' ? c.primaryLight : c.white }}>
            🏥 Sick Leave
          </p>
          <p className="text-xs mt-1" style={{ color: c.grayDark }}>
            Medical certificate optional
          </p>
        </button>
      </div>

      {/* Content based on leave type */}
      {leaveType === 'regular_day_off' && (
        <div className="space-y-3 mb-4">
          {currentCycle && (
            <div className="p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: c.gray }}>
                  {getCycleLabel(currentCycle)}
                </span>
                <span className="text-xs font-bold" style={{ color: c.primaryLight }}>
                  {currentCycle.weeks} weeks
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: c.grayDark }}>
                  Quota: {currentCycle.quota} days
                </span>
                <span className="text-xs font-bold" style={{ color: effectiveRemaining > 0 ? c.primaryLight : c.danger }}>
                  {effectiveRemaining} remaining
                </span>
              </div>
              {pendingInCurrentCycle > 0 && (
                <p className="text-xs mt-2" style={{ color: c.warning }}>
                  {pendingInCurrentCycle} pending request{pendingInCurrentCycle > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: c.gray }}>
              Select Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={minDate}
              max={maxDate || undefined}
              disabled={isDateInputDisabled || isRegularLocked}
              className="w-full rounded-lg text-sm outline-none px-3 py-2.5"
              style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}`, color: c.white, colorScheme: 'dark' }}
            />
            {isDateInputDisabled && (
              <p className="text-xs mt-2" style={{ color: c.danger }}>
                ❌ Role has fewer than 3 staff. Requests locked.
              </p>
            )}
          </div>
        </div>
      )}

      {leaveType === 'paid_vacation' && (
        <div className="space-y-4 mb-4">
          <p className="text-xs" style={{ color: c.grayDark }}>
            Choose your vacation dates. You can use the quick select buttons or enter dates manually.
          </p>
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
        </div>
      )}

      {leaveType === 'sick_day' && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: c.gray }}>
              Sick Day Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={minDate}
              max={maxDate || undefined}
              className="w-full rounded-lg text-sm outline-none px-3 py-2.5"
              style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}`, color: c.white, colorScheme: 'dark' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: c.gray }}>
              Medical Certificate (optional)
            </label>
            <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full px-3 py-2.5 rounded-lg text-left cursor-pointer text-sm transition-colors"
              style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}` }}
            >
              {attachment ? (
                <div className="flex items-center justify-between">
                  <span style={{ color: c.primaryLight }}>📎 {attachment.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAttachment(null); }}
                    className="text-xs cursor-pointer"
                    style={{ color: c.danger }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <span style={{ color: c.grayDark }}>📷 Tap to attach photo or PDF</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Note field */}
      <FormInput
        label="Additional Notes (optional)"
        placeholder="Any details for your manager..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {/* Submit Button */}
      <ShadButton
        className="w-full mt-4"
        size="lg"
        onClick={handleSubmit}
        disabled={uploading || (isRegularLocked && leaveType === 'regular_day_off') || (isOverQuota && leaveType === 'regular_day_off')}
      >
        {uploading ? 'Uploading...' : leaveType === 'paid_vacation' ? 'Request Vacation' : 'Submit Request'}
      </ShadButton>

      {/* Messages */}
      {error && (
        <p className="text-xs mt-3 p-2 bg-red-900/30 border border-red-600/50 rounded text-red-200">
          {error}
        </p>
      )}
      {success && (
        <div className="mt-3 flex items-center gap-2 p-2 bg-emerald-900/30 border border-emerald-600/50 rounded">
          <Badge color="success">Submitted</Badge>
          <span className="text-xs" style={{ color: c.success }}>Request submitted successfully</span>
        </div>
      )}
    </Modal>
  );
}
