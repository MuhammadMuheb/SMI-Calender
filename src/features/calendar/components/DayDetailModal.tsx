import { TranslatedText } from '@/i18n/LanguageContext';
import { useState, useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ArrowLeftRight, CalendarCheck, Flag, MapPin, Plus, Star, Trash } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { useAppData } from '@/app/AppDataContext';
import { useNotifications } from '@/features/notifications/NotificationContext';
import { LEAVE_TYPE_META, LeaveStatusBadge, LeaveTypeDot, formatShortDate, leaveTypeMeta } from '@/features/leave/leaveMeta';
import { checkStaffingForDate } from '@/services/staffingService';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { LeaveRequest, LeaveType } from '@/models/leave';

interface DayDetailModalProps { date: string | null; open: boolean; onClose: () => void; }

/** Leave types an admin can assign directly from the calendar. */
const ASSIGNABLE_TYPES: LeaveType[] = ['regular_day_off', 'paid_vacation', 'sick_day'];

/** Group order for "Off this day"; `private` = type hidden from the viewer. */
const GROUP_ORDER = [...(Object.keys(LEAVE_TYPE_META) as LeaveType[]), 'private'] as const;

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs font-medium text-muted-foreground">{children}</h3>;
}

export default function DayDetailModal({ date, open, onClose }: DayDetailModalProps) {
  const { user } = useAuth();
  const { requests, cancelRequest, directAssign } = useLeave();
  const { holidays, specialDays, users, roleAssignments, schedules, staffingRules, jobRoles } = useAppData();
  const { addNotification } = useNotifications();

  // Keep showing the last date while the dialog animates closed.
  const [shownDate, setShownDate] = useState<string | null>(date);
  if (date && date !== shownDate) setShownDate(date);
  const activeDate = date ?? shownDate;

  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [showMyDays, setShowMyDays] = useState(false);
  const [selectedMyDay, setSelectedMyDay] = useState<string | null>(null);

  // Super admin assign states
  const [showAssign, setShowAssign] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignType, setAssignType] = useState<LeaveType>('regular_day_off');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Super admin remove states
  const [removeTarget, setRemoveTarget] = useState<LeaveRequest | null>(null);
  const [removing, setRemoving] = useState(false);

  const myOffDays = useMemo(() => {
    if (!activeDate || !user) return [];
    const month = activeDate.slice(0, 7);
    return requests
      .filter((r) => r.userId === user.id && r.date.startsWith(month) && r.status === 'approved' && r.date !== activeDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [requests, user, activeDate]);

  const scheduledGuides = useMemo(() => {
    if (!activeDate || !schedules) return [];
    return [...new Set(schedules.filter((s) => s.date === activeDate).map((s) => s.guide))].sort();
  }, [activeDate, schedules]);

  const roleNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of jobRoles) map[r.id] = r.name;
    return map;
  }, [jobRoles]);

  if (!activeDate || !user) return null;
  const day = activeDate;

  const dayRequests = requests.filter((r) => r.date === day && r.status !== 'cancelled');
  const approvedOff = dayRequests.filter((r) => r.status === 'approved');
  const pending = dayRequests.filter((r) => r.status === 'pending');
  const holiday = holidays.find((h) => h.date === day);
  const special = specialDays.find((s) => s.date === day);
  const amIWorking = !approvedOff.some((r) => r.userId === user.id);
  const myRoleIds = roleAssignments.filter((a) => a.userId === user.id).map((a) => a.jobRoleId);
  const isSuperAdmin = user.role === 'super_admin';
  const isManagerView = user.role === 'manager' || isSuperAdmin;
  // Peers only ever see "someone is off" — the specific leave type (esp. Sick Day)
  // is private to the person themselves and to managers/admins reviewing coverage.
  const canSeeLeaveTypeOf = (r: { userId: string }) =>
    user.role === 'manager' || isSuperAdmin || r.userId === user.id;

  // Users not already off this day
  const assignableUsers = users.filter(u => u.isActive && !approvedOff.some(r => r.userId === u.id) && !pending.some(r => r.userId === u.id));

  const swappableOff = amIWorking ? approvedOff.filter((r) => {
    if (r.userId === user.id) return false;
    const theirRoles = roleAssignments.filter((a) => a.userId === r.userId).map((a) => a.jobRoleId);
    return myRoleIds.some((rid) => theirRoles.includes(rid));
  }) : [];

  // Per-role coverage from APPROVED leave only. Hidden roles are super-admin only.
  const hiddenRoleIds = new Set(jobRoles.filter((r) => r.isHidden).map((r) => r.id));
  const staffing = isManagerView
    ? checkStaffingForDate(day, staffingRules, roleAssignments, approvedOff, roleNames)
      .filter((s) => isSuperAdmin || !hiddenRoleIds.has(s.jobRoleId))
    : [];
  const roleColor = (id: string) => jobRoles.find((r) => r.id === id)?.color;

  // Group who's off by leave type (or "Off" when the type is private to the viewer).
  const offGroups = GROUP_ORDER
    .map((key) => ({
      key,
      items: approvedOff.filter((r) => (canSeeLeaveTypeOf(r) ? r.leaveType : 'private') === key),
    }))
    .filter((g) => g.items.length > 0);

  const resetSwap = () => { setShowMyDays(false); setSwapTarget(null); setSelectedMyDay(null); };
  const resetAssign = () => { setShowAssign(false); setAssignUserId(''); setAssignType('regular_day_off'); setAssignError(''); };

  const handleSwapRequest = () => {
    if (!swapTarget || !selectedMyDay) return;
    const target = users.find((u) => u.id === swapTarget);
    if (!target) return;
    const wantDate = formatShortDate(day);
    const offerDate = formatShortDate(selectedMyDay);
    const userName = user.displayName ?? user.username ?? 'Unknown';
    const targetName = target.displayName ?? target.username ?? 'Unknown';
    try {
      addNotification(swapTarget, 'new_request_pending', 'Swap request',
        `${userName} wants to swap: take your ${wantDate} off, give you ${offerDate} off instead.`);
      const admins = users.filter((u) => (u.role === 'manager' || u.role === 'super_admin') && u.id !== user.id);
      for (const admin of admins) {
        addNotification(admin.id, 'new_request_pending', 'Swap request',
          `${userName} asked ${targetName} to swap ${wantDate} for ${offerDate}.`);
      }
    } catch (e) {
      console.error('Swap notification error:', e);
      toast.error('Couldn’t send the swap request. Try again.');
      return;
    }
    toast.success('Swap request sent', { description: `${targetName} and the managers have been notified.` });
    resetSwap();
  };

  const handleAssign = async () => {
    if (!assignUserId) { setAssignError('Select a person'); return; }
    setAssigning(true); setAssignError('');
    const targetUser = users.find(u => u.id === assignUserId);
    if (!targetUser) { setAssignError('User not found'); setAssigning(false); return; }
    const targetName = targetUser.displayName ?? targetUser.username ?? 'Unknown';
    const userName = user.displayName ?? user.username ?? 'Unknown';
    const err = await directAssign(targetUser.id, targetName, targetUser.role as 'staff' | 'manager' | 'super_admin', day, assignType, userName);
    setAssigning(false);
    if (err) { toast.error(err); return; }
    toast.success(`${leaveTypeMeta(assignType).label} assigned to ${targetName}`);
    resetAssign();
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    const name = removeTarget.userRef?.displayName ?? 'Unknown';
    setRemoving(true);
    const err = await cancelRequest(removeTarget.id);
    setRemoving(false);
    if (err) { toast.error(err); return; }
    toast.success(`Removed ${name}'s day off`);
    setRemoveTarget(null);
  };

  const handleClose = () => { resetSwap(); resetAssign(); setRemoveTarget(null); onClose(); };
  const dateLabel = new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const isEmpty = scheduledGuides.length === 0 && approvedOff.length === 0 && pending.length === 0 && !holiday && !special;
  const isFirstSunday = new Date(day + 'T00:00:00').getDay() === 0 && Number(day.slice(8, 10)) <= 7;

  const summary = [
    approvedOff.length > 0 ? `${approvedOff.length} off` : null,
    pending.length > 0 ? `${pending.length} pending` : null,
  ].filter(Boolean).join(' · ') || 'Everyone is working';

  const swapTargetName = swapTarget ? (users.find((u) => u.id === swapTarget)?.displayName ?? 'them') : '';

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={(o) => { if (!o) handleClose(); }}
        title={dateLabel}
        description={summary}
        size="md"
      >
        <div className="space-y-6">
          {(holiday || special || isFirstSunday) && (
            <div className="flex flex-wrap gap-1.5">
              {holiday && (
                <Badge variant="secondary" className="border-transparent bg-info/12 text-info">
                  <Flag data-icon="inline-start" />
                  {holiday.name}
                </Badge>
              )}
              {special && (
                <Badge variant="secondary" className="border-transparent bg-leave-special/12 text-leave-special">
                  <Star data-icon="inline-start" />
                  {special.name}
                </Badge>
              )}
              {isFirstSunday && (
                <Badge variant="secondary" className="border-transparent bg-leave-auto/15 text-muted-foreground">
                  <CalendarCheck data-icon="inline-start" />
                  Monthly Sunday
                </Badge>
              )}
            </div>
          )}

          {staffing.length > 0 && (
            <section>
              <SectionLabel>Staffing</SectionLabel>
              <ItemGroup className="gap-1">
                {staffing.map((s, i) => {
                  const color = roleColor(s.jobRoleId);
                  return (
                    <Item key={`${s.jobRoleId}-${i}`} size="xs" variant="outline" role="listitem">
                      <ItemMedia>
                        <span
                          aria-hidden="true"
                          className="size-2.5 rounded-full bg-muted-foreground"
                          style={color ? { backgroundColor: color } : undefined}
                        />
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <ItemTitle>{s.jobRoleName}</ItemTitle>
                        <ItemDescription className="tabular-nums">
                          {s.scheduled} working · {s.required} needed
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        {s.surplus < 0 ? (
                          <Badge variant="secondary" className="border-transparent bg-warning/12 text-warning">
                            Short by {-s.surplus}
                          </Badge>
                        ) : s.surplus === 0 ? (
                          <Badge variant="secondary">At minimum</Badge>
                        ) : (
                          <Badge variant="secondary" className="border-transparent bg-success/12 text-success">Covered</Badge>
                        )}
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            </section>
          )}

          {approvedOff.length > 0 && (
            <section className="space-y-4">
              <SectionLabel>Off this day ({approvedOff.length})</SectionLabel>
              {offGroups.map((group) => (
                <div key={group.key} className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    {group.key === 'private'
                      ? <span aria-hidden="true" className="size-1.5 rounded-full border border-foreground/45" />
                      : <LeaveTypeDot type={group.key} />}
                    {group.key === 'private' ? 'Off' : leaveTypeMeta(group.key).label}
                    <span className="font-normal text-muted-foreground tabular-nums">{group.items.length}</span>
                  </p>
                  <ItemGroup className="gap-1">
                    {group.items.map((r) => {
                      const name = r.userRef?.displayName ?? 'Unknown';
                      const canSwapWith = swappableOff.some((s) => s.userId === r.userId);
                      const isSwapTarget = showMyDays && swapTarget === r.userId;
                      return (
                        <Item key={r.id} size="xs" variant="muted" role="listitem" className={cn(isSwapTarget && 'ring-1 ring-primary/40')}>
                          <ItemMedia>
                            <UserAvatar name={name} size="sm" />
                          </ItemMedia>
                          <ItemContent className="min-w-0">
                            <ItemTitle>
                              {name}
                              {r.userId === user.id && <span className="font-normal text-muted-foreground">(you)</span>}
                            </ItemTitle>
                          </ItemContent>
                          {(canSwapWith || isSuperAdmin) && (
                            <ItemActions>
                              {canSwapWith && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setSwapTarget(r.userId); setSelectedMyDay(null); setShowMyDays(true); }}
                                >
                                  <ArrowLeftRight data-icon="inline-start" />
                                  Swap
                                </Button>
                              )}
                              {isSuperAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => setRemoveTarget(r)}
                                  aria-label={`Remove ${name}'s day off`}
                                >
                                  <Trash />
                                </Button>
                              )}
                            </ItemActions>
                          )}
                        </Item>
                      );
                    })}
                  </ItemGroup>
                </div>
              ))}
            </section>
          )}

          {showMyDays && swapTarget && (
            <section className="rounded-lg border p-3">
              <FieldGroup className="gap-3">
                <Field>
                  <FieldLabel htmlFor="swap-day">Your day off to offer {swapTargetName}</FieldLabel>
                  {myOffDays.length === 0 ? (
                    <FieldDescription>You have no other days off this month to offer.</FieldDescription>
                  ) : (
                    <Select value={selectedMyDay ?? ''} onValueChange={setSelectedMyDay}>
                      <SelectTrigger id="swap-day" className="h-10 w-full">
                        <SelectValue placeholder="Choose a day" />
                      </SelectTrigger>
                      <SelectContent>
                        {myOffDays.map((d) => (
                          <SelectItem key={d.id} value={d.date}>{formatShortDate(d.date)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetSwap}><TranslatedText text="Cancel" /></Button>
                  <Button onClick={handleSwapRequest} disabled={!selectedMyDay}>Send swap request</Button>
                </div>
              </FieldGroup>
            </section>
          )}

          {pending.length > 0 && (
            <section>
              <SectionLabel>Pending ({pending.length})</SectionLabel>
              <ItemGroup className="gap-1">
                {pending.map((r) => {
                  const name = r.userRef?.displayName ?? 'Unknown';
                  return (
                    <Item key={r.id} size="xs" variant="muted" role="listitem">
                      <ItemMedia>
                        <UserAvatar name={name} size="sm" />
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <ItemTitle>{name}</ItemTitle>
                        {canSeeLeaveTypeOf(r) && <ItemDescription>{leaveTypeMeta(r.leaveType).label}</ItemDescription>}
                      </ItemContent>
                      <ItemActions>
                        <LeaveStatusBadge status="pending" />
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            </section>
          )}

          {scheduledGuides.length > 0 && (
            <section>
              <SectionLabel>Tour guides scheduled ({scheduledGuides.length})</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {scheduledGuides.map((guide) => (
                  <Badge key={guide} variant="outline" className="h-6">
                    <MapPin data-icon="inline-start" className="text-primary" />
                    {guide}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {isEmpty && (
            <EmptyState icon={CalendarCheck} title="Everyone is working" description="No one is off this day." className="py-6" />
          )}

          {/* Super Admin: quick assign day off */}
          {isSuperAdmin && !showAssign && (
            <Button variant="outline" size="lg" className="w-full" onClick={() => setShowAssign(true)}>
              <Plus data-icon="inline-start" />
              Assign day off
            </Button>
          )}

          {isSuperAdmin && showAssign && (
            <section className="rounded-lg border p-3">
              <h3 className="mb-3 text-sm font-medium">Assign day off for {formatShortDate(day)}</h3>
              <FieldGroup className="gap-3">
                <Field data-invalid={assignError ? true : undefined}>
                  <FieldLabel htmlFor="assign-person"><TranslatedText text="Person" /></FieldLabel>
                  {assignableUsers.length === 0 ? (
                    <FieldDescription>Everyone already has this day off or a pending request.</FieldDescription>
                  ) : (
                    <Select value={assignUserId} onValueChange={(v) => { setAssignUserId(v); setAssignError(''); }}>
                      <SelectTrigger id="assign-person" className="h-10 w-full" aria-invalid={assignError ? true : undefined}>
                        <SelectValue placeholder="Choose a person" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.displayName ?? u.username ?? 'Unknown'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {assignError && <FieldError>{assignError}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="assign-type">Type</FieldLabel>
                  <Select value={assignType} onValueChange={(v) => setAssignType(v as LeaveType)}>
                    <SelectTrigger id="assign-type" className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          <LeaveTypeDot type={t} className="size-2" />
                          {leaveTypeMeta(t).label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetAssign} disabled={assigning}><TranslatedText text="Cancel" /></Button>
                  <Button onClick={handleAssign} disabled={assigning || assignableUsers.length === 0}>
                    {assigning && <Spinner data-icon="inline-start" />}
                    Assign
                  </Button>
                </div>
              </FieldGroup>
            </section>
          )}
        </div>
      </ResponsiveDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => { if (!o && !removing) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.userRef?.displayName ?? 'this'}'s day off?</AlertDialogTitle>
            <AlertDialogDescription>
              {formatShortDate(day)} goes back to a working day and the request is cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Keep</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removing}
              onClick={(e) => { e.preventDefault(); void handleRemove(); }}
            >
              {removing && <Spinner data-icon="inline-start" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
