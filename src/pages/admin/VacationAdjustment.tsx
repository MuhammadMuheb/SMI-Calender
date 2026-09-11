import { useState } from 'react';
import { Card, Badge, Button, Modal, FormInput } from '../../components/ui';
import { theme } from '../../config/theme';
import { alpha } from '../../utils/themeColor';
import { useAppData } from '../../context/AppDataContext';
import { useLeave } from '../../context/LeaveContext';
import { useAuth } from '../../context/AuthContext';
import { insertAuditLog, updateUserDb } from '../../services/supabaseService';

interface Props { onBack: () => void }

export default function VacationAdjustment({ onBack }: Props) {
  const { user } = useAuth();
  const { users } = useAppData();
  const { getBalance } = useLeave();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [regularValue, setRegularValue] = useState('');
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const allUsers = users.filter((u) => u.isActive);
  const selected = allUsers.find((u) => u.id === selectedUser);
  const balance = selectedUser ? getBalance(selectedUser) : null;

  const handleAdjust = async () => {
    if (!selectedUser || !reason.trim() || !selected) return;
    const vacProvided = adjustValue !== '';
    const regProvided = regularValue !== '';
    if (!vacProvided && !regProvided) return;

    const payload: Record<string, unknown> = {};
    let desc = '';

    if (vacProvided) {
      const newVac = Number(adjustValue);
      if (isNaN(newVac) || newVac < 0) return;
      payload.vacation_override = newVac;
      payload.vacation_override_at = new Date().toISOString();
      desc += `Vacation ${balance?.vacationDaysTotal ?? 0} -> ${newVac}. `;
    }
    if (regProvided) {
      const newReg = Number(regularValue);
      if (isNaN(newReg) || newReg < 0) return;
      payload.regular_override = newReg;
      desc += `Days-off allowance ${balance?.regularDaysAllowed ?? 6} -> ${newReg}. `;
    }

    await updateUserDb(selectedUser, payload);

    await insertAuditLog({
      actorId: user?.id ?? 'admin',
      actorName: user?.displayName ?? 'Admin',
      action: 'balance_adjusted',
      entityType: 'balance',
      entityId: selectedUser,
      description: `Adjusted ${selected.displayName}: ${desc}Reason: ${reason}`,
    });

    setDone(true);
    setTimeout(() => {
      setDone(false); setShowConfirm(false); setAdjustValue(''); setRegularValue(''); setReason('');
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>&larr; Back</button>
        <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Leave Allowances</h2>
      </div>

      <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
        Select a person to adjust their vacation balance and/or day-off allowance.
      </p>

      <div className="space-y-2">
        {allUsers.map((u) => {
          const bal = getBalance(u.id);
          const isSelected = selectedUser === u.id;
          return (
            <button key={u.id} onClick={() => setSelectedUser(isSelected ? null : u.id)} className="w-full text-left cursor-pointer">
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: alpha(theme.colors.primary, '20'), color: theme.colors.primaryLight }}>
                      {u.displayName[0]?.toUpperCase()}
                    </div>
                    <p className="text-xs font-medium" style={{ color: theme.colors.white }}>{u.displayName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold" style={{ color: theme.colors.warning }}>{bal.vacationDaysRemaining}</p>
                    <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>of {bal.vacationDaysTotal} accrued</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>Regular Days Off</p>
                        <p className="text-sm font-bold" style={{ color: theme.colors.primary }}>{bal.regularDaysRemaining} / {bal.regularDaysAllowed}</p>
                        <p className="text-[9px]" style={{ color: theme.colors.grayDark }}>resets each cycle · {bal.regularDaysUsed} used</p>
                      </div>
                      <div>
                        <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>Vacation Balance</p>
                        <p className="text-sm font-bold" style={{ color: theme.colors.warning }}>{bal.vacationDaysRemaining} / {bal.vacationDaysTotal}</p>
                        <p className="text-[9px]" style={{ color: theme.colors.grayDark }}>accrued, never expires · {bal.vacationDaysUsed} used</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" fullWidth onClick={(e) => { e.stopPropagation(); setAdjustValue(String(bal.vacationDaysTotal)); setRegularValue(String(bal.regularDaysAllowed)); setShowConfirm(true); }}>
                      Adjust Allowances
                    </Button>
                  </div>
                )}
              </Card>
            </button>
          );
        })}
      </div>

      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title={`Adjust: ${selected?.displayName ?? ''}`}
        footer={!done ? <><Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleAdjust} disabled={(!adjustValue && !regularValue) || !reason.trim()}>Confirm</Button></> : undefined}>
        {done ? (
          <div className="flex items-center gap-2"><Badge color="success">Done</Badge>
            <span className="text-xs" style={{ color: theme.colors.success }}>Allowances adjusted</span></div>
        ) : (
          <>
            <p className="text-xs mb-3" style={{ color: theme.colors.gray }}>
              Current vacation total: <strong>{balance?.vacationDaysTotal ?? 0}</strong> days &middot;
              Current day-off allowance: <strong>{balance?.regularDaysAllowed ?? 6}</strong> per cycle
            </p>
            <FormInput label="Vacation Total (days)" type="number" placeholder="e.g. 14"
              value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} />
            <FormInput label="Day-Off Allowance (per cycle)" type="number" placeholder="e.g. 6"
              value={regularValue} onChange={(e) => setRegularValue(e.target.value)} />
            <FormInput label="Reason (required)" placeholder="Why is this adjustment needed?"
              value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="text-[10px]" style={{ color: theme.colors.warning }}>
              Leave a field blank to keep it unchanged. This action is logged in the audit trail.
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}
