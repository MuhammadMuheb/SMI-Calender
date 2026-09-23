import { TranslatedText } from '@/i18n/LanguageContext';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { SlidersHorizontal, Users } from 'lucide-react';
import { useAppData } from '@/app/AppDataContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { useAuth } from '@/features/auth/AuthContext';
import { insertAuditLog, updateUserDb } from '@/features/auth/authService';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Field, FieldDescription, FieldError, FieldGroup, FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

/** Vacation accrues monthly, so totals can be fractional. */
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const allUsers = useMemo(
    () => users.filter((u) => u.isActive).slice().sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [users],
  );
  const selected = allUsers.find((u) => u.id === selectedUser);
  const balance = selectedUser ? getBalance(selectedUser) : null;

  const openAdjust = (userId: string) => {
    const bal = getBalance(userId);
    setSelectedUser(userId);
    setAdjustValue(String(bal.vacationDaysTotal));
    setRegularValue(String(bal.regularDaysAllowed));
    setReason('');
    setFormError('');
    setShowConfirm(true);
  };

  const closeAdjust = () => {
    if (saving) return;
    setShowConfirm(false);
  };

  const handleAdjust = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!selectedUser || !selected) return;
    if (!reason.trim()) { setFormError('Add a reason for this change.'); return; }

    const currentVac = balance?.vacationDaysTotal ?? 0;
    const currentReg = balance?.regularDaysAllowed ?? 6;
    const vacProvided = adjustValue.trim() !== '';
    const regProvided = regularValue.trim() !== '';
    if (!vacProvided && !regProvided) { setFormError('Enter a new vacation total or day-off allowance.'); return; }

    const payload: Record<string, unknown> = {};
    let desc = '';

    if (vacProvided) {
      const newVac = Number(adjustValue);
      if (isNaN(newVac) || newVac < 0) { setFormError('The vacation total must be 0 or more.'); return; }
      if (newVac !== currentVac) {
        payload.vacationOverride = newVac;
        payload.vacationOverrideAt = new Date().toISOString();
        desc += `Vacation ${fmt(currentVac)} -> ${newVac}. `;
      }
    }
    if (regProvided) {
      const newReg = Number(regularValue);
      if (isNaN(newReg) || newReg < 0 || !Number.isInteger(newReg)) {
        setFormError('The day-off allowance must be a whole number, 0 or more.'); return;
      }
      if (newReg !== currentReg) {
        payload.regularOverride = newReg;
        desc += `Days-off allowance ${currentReg} -> ${newReg}. `;
      }
    }
    if (Object.keys(payload).length === 0) { setFormError('Nothing has changed. Edit a value, or cancel.'); return; }

    setSaving(true);
    setFormError('');
    try {
      await updateUserDb(selectedUser, payload);
      await insertAuditLog({
        actorId: user?.id ?? 'admin',
        actorName: user?.displayName ?? 'Admin',
        action: 'balance_adjusted',
        entityType: 'balance',
        entityId: selectedUser,
        description: `Adjusted ${selected.displayName}: ${desc}Reason: ${reason}`,
      });
      toast.success(`Allowances updated for ${selected.displayName}`, {
        description: 'Reloading to show the new balances…',
      });
      setShowConfirm(false);
      // Balances are derived from user data loaded at startup, so reload to pick up the change.
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error(`Couldn’t update allowances for ${selected.displayName}. Try again.`);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave allowances"
        description="Adjust someone’s vacation balance or day-off allowance. Every change is recorded in the audit log."
        onBack={onBack}
      />

      {allUsers.length === 0 ? (
        <EmptyState icon={Users} title="No active people" description="People you add appear here with their leave balances." />
      ) : (
        <>
          {/* Desktop: table */}
          <Card className="hidden py-0 md:flex">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4"><TranslatedText text="Name" /></TableHead>
                  <TableHead className="text-right"><TranslatedText text="Days off left" /></TableHead>
                  <TableHead className="text-right">Vacation left</TableHead>
                  <TableHead className="w-28 pr-4"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map((u) => {
                  const bal = getBalance(u.id);
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={u.displayName} />
                          <span className="font-medium">{u.displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-medium">{fmt(bal.regularDaysRemaining)}</span>
                        <span className="text-muted-foreground"> of {fmt(bal.regularDaysAllowed)} this cycle</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-medium">{fmt(bal.vacationDaysRemaining)}</span>
                        <span className="text-muted-foreground"> of {fmt(bal.vacationDaysTotal)} accrued</span>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button variant="outline" onClick={() => openAdjust(u.id)}>
                          <SlidersHorizontal data-icon="inline-start" />
                          Adjust
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: stacked rows */}
          <Card className="gap-0 divide-y py-0 md:hidden">
            {allUsers.map((u) => {
              const bal = getBalance(u.id);
              return (
                <div key={u.id} className="flex items-center gap-3 p-4">
                  <UserAvatar name={u.displayName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.displayName}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {fmt(bal.regularDaysRemaining)}/{fmt(bal.regularDaysAllowed)} days off · {fmt(bal.vacationDaysRemaining)}/{fmt(bal.vacationDaysTotal)} vacation
                    </p>
                  </div>
                  <Button variant="outline" size="lg" onClick={() => openAdjust(u.id)}>Adjust</Button>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <ResponsiveDialog
        open={showConfirm}
        onOpenChange={(open) => { if (!open) closeAdjust(); }}
        title={`Adjust allowances for ${selected?.displayName ?? ''}`}
        description="Leave a field as it is to keep it unchanged."
        footer={(
          <>
            <Button variant="outline" size="lg" onClick={closeAdjust} disabled={saving}><TranslatedText text="Cancel" /></Button>
            <Button
              type="submit"
              form="allowance-form"
              size="lg"
              disabled={saving || (!adjustValue && !regularValue) || !reason.trim()}
            >
              {saving && <Spinner />}
              Save changes
            </Button>
          </>
        )}
      >
        <form id="allowance-form" onSubmit={handleAdjust} noValidate>
          <FieldGroup>
            {balance && (
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Days off this cycle</p>
                  <p className="font-medium tabular-nums">{fmt(balance.regularDaysRemaining)} of {fmt(balance.regularDaysAllowed)} left</p>
                  <p className="text-xs text-muted-foreground">{fmt(balance.regularDaysUsed)} used · resets each cycle</p>
                </div>
                <div>
                  <p className="text-muted-foreground"><TranslatedText text="Vacation" /></p>
                  <p className="font-medium tabular-nums">{fmt(balance.vacationDaysRemaining)} of {fmt(balance.vacationDaysTotal)} left</p>
                  <p className="text-xs text-muted-foreground">{fmt(balance.vacationDaysUsed)} used · never expires</p>
                </div>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="adjust-vacation">Vacation total (days)</FieldLabel>
                <Input
                  id="adjust-vacation"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="For example, 14"
                  value={adjustValue}
                  onChange={(e) => { setAdjustValue(e.target.value); setFormError(''); }}
                  className="h-10"
                />
                <FieldDescription>Accrual continues from this total.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="adjust-regular">Days off per cycle</FieldLabel>
                <Input
                  id="adjust-regular"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="For example, 6"
                  value={regularValue}
                  onChange={(e) => { setRegularValue(e.target.value); setFormError(''); }}
                  className="h-10"
                />
                <FieldDescription>The usual allowance is 6.</FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="adjust-reason"><TranslatedText text="Reason" /></FieldLabel>
              <Textarea
                id="adjust-reason"
                placeholder="Why is this change needed?"
                value={reason}
                onChange={(e) => { setReason(e.target.value); setFormError(''); }}
              />
              <FieldDescription>Required. Saved with the change in the audit log.</FieldDescription>
            </Field>

            {formError && <FieldError>{formError}</FieldError>}
          </FieldGroup>
        </form>
      </ResponsiveDialog>
    </div>
  );
}
