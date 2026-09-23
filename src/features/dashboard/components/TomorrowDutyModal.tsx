import { TranslatedText } from '@/i18n/LanguageContext';
import { useState, useMemo } from 'react';
import { Check, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { cn } from '@/lib/utils';
import type { StaffUser } from '@/models/user';

const CHECK_IN_ROLES = ['Check In'];
const OFFICE_ROLES = ['Office', 'Back Office', 'Back Office Extra'];
const DEFAULT_SHIFT = { start: '08:00', end: '17:00' };

/** Token tint per team role name; unknown roles stay neutral. */
const ROLE_CHIP: Record<string, string> = {
  'Check In': 'bg-info/10 text-info',
  'Back Office': 'bg-warning/10 text-warning',
  'Back Office Extra': 'bg-warning/10 text-warning',
};

interface TomorrowDutyModalProps {
  open: boolean;
  onClose: () => void;
  tomorrowLabel: string;
  activeStaff: StaffUser[];
  offTomorrowIds: Set<string>;
  approvedTomorrow: { id: string; userId: string; userRef: { displayName: string } }[];
  currentUserJobRoles: string[];
  currentUserRole: string; // 'manager' | 'super_admin'
  onSendNotifications: (selectedIds: string[], shiftTimes: Record<string, { start: string; end: string }>) => void;
}

export default function TomorrowDutyModal({
  open, onClose, tomorrowLabel, activeStaff, offTomorrowIds,
  currentUserJobRoles, currentUserRole, onSendNotifications,
}: TomorrowDutyModalProps) {
  const [shiftTimes, setShiftTimes] = useState<Record<string, { start: string; end: string }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pushSent, setPushSent] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // Each time the modal opens, select everyone on duty tomorrow (keeping any
  // times already edited). Done during render so the first paint is correct.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const times: Record<string, { start: string; end: string }> = {};
      const selected = new Set<string>();
      for (const u of activeStaff) {
        if (!offTomorrowIds.has(u.id)) {
          times[u.id] = shiftTimes[u.id] ?? DEFAULT_SHIFT;
          selected.add(u.id);
        }
      }
      setShiftTimes(times);
      setSelectedIds(selected);
      setPushSent(false);
    }
  }

  // Determine if current user is a Check In manager or Office manager
  const isCheckInManager = currentUserJobRoles.some((r) => CHECK_IN_ROLES.includes(r));
  const isSuperAdmin = currentUserRole === 'super_admin';

  // Split staff into teams
  const { checkInTeam, officeTeam } = useMemo(() => {
    const checkIn: StaffUser[] = [];
    const office: StaffUser[] = [];
    const seen = new Set<string>();

    for (const u of activeStaff) {
      const roles = u.jobRole ?? ['Office'];
      const hasCheckIn = roles.some((r) => CHECK_IN_ROLES.includes(r));
      const hasOffice = roles.some((r) => OFFICE_ROLES.includes(r));

      if (hasCheckIn) {
        checkIn.push(u);
        seen.add(u.id);
      }
      if (hasOffice) {
        office.push(u);
        seen.add(u.id);
      }
      // If neither, put in office
      if (!hasCheckIn && !hasOffice && !seen.has(u.id)) {
        office.push(u);
      }
    }

    return { checkInTeam: checkIn, officeTeam: office };
  }, [activeStaff]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInTeam(team: StaffUser[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const working = team.filter((u) => !offTomorrowIds.has(u.id));
      const allSelected = working.every((u) => next.has(u.id));
      if (allSelected) {
        working.forEach((u) => next.delete(u.id));
      } else {
        working.forEach((u) => next.add(u.id));
      }
      return next;
    });
  }

  function setTime(id: string, key: 'start' | 'end', value: string) {
    setShiftTimes((prev) => ({ ...prev, [id]: { ...(prev[id] ?? DEFAULT_SHIFT), [key]: value } }));
  }

  function handleSend() {
    const ids = Array.from(selectedIds);
    onSendNotifications(ids, shiftTimes);
    setPushSent(true);
    toast.success(ids.length === 1 ? 'Shift notice sent to 1 person' : `Shift notices sent to ${ids.length} people`);
  }

  // Super admins and Check In managers see Check In first; office managers see Office first.
  const checkInFirst = isSuperAdmin || isCheckInManager;
  const sections = checkInFirst
    ? [{ label: 'Check-in team', team: checkInTeam }, { label: 'Office team', team: officeTeam }]
    : [{ label: 'Office team', team: officeTeam }, { label: 'Check-in team', team: checkInTeam }];

  function renderTeamSection(label: string, team: StaffUser[]) {
    const allWorking = team.filter((u) => !offTomorrowIds.has(u.id));
    const workingCount = allWorking.length;
    const offCount = team.length - workingCount;
    const allWorkingSelected = allWorking.every((u) => selectedIds.has(u.id));

    return (
      <section key={label} className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className="text-sm font-medium">{label}</h3>
            <span className="text-xs text-muted-foreground">
              {workingCount} on duty{offCount > 0 ? ` · ${offCount} off` : ''}
            </span>
          </div>
          {allWorking.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => selectAllInTeam(team)}>
              {allWorkingSelected ? 'Clear all' : 'Select all'}
            </Button>
          )}
        </div>

        {team.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            No one on this team.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {team.map((staff) => {
              if (!staff || !staff.id) return null;
              const displayName = staff.displayName ?? staff.username ?? 'Unknown';
              const isOff = offTomorrowIds.has(staff.id);
              const isSelected = selectedIds.has(staff.id);
              const t = shiftTimes[staff.id] ?? DEFAULT_SHIFT;
              const roles = staff.jobRole ?? ['Office'];
              const checkboxId = `duty-${label}-${staff.id}`;

              return (
                <li
                  key={staff.id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5',
                    isOff && 'bg-muted/50 opacity-60',
                  )}
                >
                  {isOff ? (
                    <span className="size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Checkbox
                      id={checkboxId}
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(staff.id)}
                      aria-label={`Notify ${displayName}`}
                    />
                  )}
                  <UserAvatar name={displayName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label htmlFor={isOff ? undefined : checkboxId} className="truncate text-sm font-medium">
                        {displayName}
                      </label>
                      {isOff && <Badge variant="secondary"><TranslatedText text="Day off" /></Badge>}
                    </div>
                    {!isOff && roles.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {roles.map((r) => (
                          <Badge
                            key={r}
                            variant="secondary"
                            className={cn('border-transparent font-normal', ROLE_CHIP[r])}
                          >
                            {r}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isOff && (
                    <div className="ml-7 flex w-full items-center gap-1.5 sm:ml-0 sm:w-auto">
                      <Input
                        type="time"
                        value={t.start}
                        onChange={(e) => setTime(staff.id, 'start', e.target.value)}
                        aria-label={`Shift start for ${displayName}`}
                        className="w-28 dark:scheme-dark"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={t.end}
                        onChange={(e) => setTime(staff.id, 'end', e.target.value)}
                        aria-label={`Shift end for ${displayName}`}
                        className="w-28 dark:scheme-dark"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  const totalSelected = selectedIds.size;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title="See you tomorrow"
      description={`${tomorrowLabel} · choose who to notify and set their shift times.`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}><TranslatedText text="Close" /></Button>
          <Button onClick={handleSend} disabled={pushSent || totalSelected === 0}>
            {pushSent ? <Check /> : <Send />}
            {pushSent ? 'Sent' : `Notify ${totalSelected} ${totalSelected === 1 ? 'person' : 'people'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {sections.map((s) => renderTeamSection(s.label, s.team))}
      </div>
    </ResponsiveDialog>
  );
}
