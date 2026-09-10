import { useState, useMemo } from 'react';
import { Button, Badge, Modal } from './ui';
import { theme } from '../config/theme';
import type { StaffUser } from '../models/user';

const CHECK_IN_ROLES = ['Check In'];
const OFFICE_ROLES = ['Office', 'Back Office', 'Back Office Extra'];

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
  open, onClose, tomorrowLabel, activeStaff, offTomorrowIds, approvedTomorrow: _approvedTomorrow,
  currentUserJobRoles, currentUserRole, onSendNotifications,
}: TomorrowDutyModalProps) {
  const [shiftTimes, setShiftTimes] = useState<Record<string, { start: string; end: string }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pushSent, setPushSent] = useState(false);

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

  // Initialize shift times and selection on open
  useState(() => {
    const times: Record<string, { start: string; end: string }> = {};
    const selected = new Set<string>();
    for (const u of activeStaff) {
      if (!offTomorrowIds.has(u.id)) {
        times[u.id] = shiftTimes[u.id] ?? { start: '08:00', end: '17:00' };
        selected.add(u.id);
      }
    }
    setShiftTimes(times);
    setSelectedIds(selected);
  });

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

  function handleSend() {
    const ids = Array.from(selectedIds);
    onSendNotifications(ids, shiftTimes);
    setPushSent(true);
  }

  const c = theme.colors;

  // Determine section order
  let primaryTeam: { label: string; team: StaffUser[] };
  let secondaryTeam: { label: string; team: StaffUser[] };

  if (isSuperAdmin) {
    // Super admin sees Check In first, then Office
    primaryTeam = { label: 'Check In Team', team: checkInTeam };
    secondaryTeam = { label: 'Office Team', team: officeTeam };
  } else if (isCheckInManager) {
    primaryTeam = { label: 'Check In Team', team: checkInTeam };
    secondaryTeam = { label: 'Office Team', team: officeTeam };
  } else {
    primaryTeam = { label: 'Office Team', team: officeTeam };
    secondaryTeam = { label: 'Check In Team', team: checkInTeam };
  }

  function renderTeamSection(label: string, team: StaffUser[]) {
    const workingCount = team.filter((u) => !offTomorrowIds.has(u.id)).length;
    const offCount = team.length - workingCount;
    const allWorking = team.filter((u) => !offTomorrowIds.has(u.id));
    const allWorkingSelected = allWorking.every((u) => selectedIds.has(u.id));

    return (
      <div style={{ marginBottom: '16px' }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: c.primaryLight }}>
              {label}
            </p>
            <span style={{ fontSize: '10px', color: c.grayDark }}>
              {workingCount} on duty{offCount > 0 ? ` · ${offCount} off` : ''}
            </span>
          </div>
          {allWorking.length > 0 && (
            <button
              onClick={() => selectAllInTeam(team)}
              style={{ background: 'none', border: 'none', color: c.primaryLight, fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}
            >
              {allWorkingSelected ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {/* Team members */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {team.map((staff) => {
            const isOff = offTomorrowIds.has(staff.id);
            const isSelected = selectedIds.has(staff.id);
            const t = shiftTimes[staff.id] ?? { start: '08:00', end: '17:00' };
            const roles = staff.jobRole ?? ['Office'];

            return (
              <div
                key={staff.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: isOff ? c.bgCard : c.bgCard,
                  border: `1px solid ${isOff ? c.secondary + '30' : c.border}`,
                  opacity: isOff ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Checkbox (only for working staff) */}
                  {!isOff && (
                    <button
                      onClick={() => toggleSelect(staff.id)}
                      style={{
                        width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                        border: `2px solid ${isSelected ? c.primary : c.grayDarker}`,
                        backgroundColor: isSelected ? c.primary : 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {isSelected && <span style={{ color: c.white, fontSize: '12px', fontWeight: 700 }}>✓</span>}
                    </button>
                  )}
                  {isOff && <div style={{ width: '20px' }} />}

                  {/* Avatar */}
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700,
                    backgroundColor: c.primary + '20', color: c.primaryLight,
                  }}>
                    {staff.displayName[0]?.toUpperCase()}
                  </div>

                  {/* Name + role badges */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: c.white }}>{staff.displayName}</span>
                      {isOff && <Badge color="danger" size="xs">Day Off</Badge>}
                    </div>
                    {!isOff && roles.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                        {roles.map((r) => (
                          <span key={r} style={{
                            fontSize: '9px', padding: '1px 6px', borderRadius: '99px', fontWeight: 500,
                            backgroundColor: r === 'Check In' ? '#0ea5e920' : r === 'Back Office' ? '#f59e0b20' : r === 'Back Office Extra' ? '#f97316 20' : '#6366f120',
                            color: r === 'Check In' ? '#38bdf8' : r === 'Back Office' ? '#fbbf24' : r === 'Back Office Extra' ? '#fb923c' : '#818cf8',
                          }}>
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Shift times (only for working staff) */}
                  {!isOff && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <input
                        type="time" value={t.start}
                        onChange={(e) => setShiftTimes((prev) => ({ ...prev, [staff.id]: { ...prev[staff.id], start: e.target.value } }))}
                        style={{
                          width: '70px', padding: '4px 6px', borderRadius: '6px', fontSize: '11px',
                          backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.white, colorScheme: 'dark',
                          outline: 'none',
                        }}
                      />
                      <input
                        type="time" value={t.end}
                        onChange={(e) => setShiftTimes((prev) => ({ ...prev, [staff.id]: { ...prev[staff.id], end: e.target.value } }))}
                        style={{
                          width: '70px', padding: '4px 6px', borderRadius: '6px', fontSize: '11px',
                          backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.white, colorScheme: 'dark',
                          outline: 'none',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const totalSelected = selectedIds.size;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`See You Tomorrow — ${tomorrowLabel}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={handleSend} disabled={pushSent || totalSelected === 0}>
            {pushSent ? '✓ Sent' : `Notify ${totalSelected} Staff`}
          </Button>
        </>
      }
    >
      {renderTeamSection(primaryTeam.label, primaryTeam.team)}
      {renderTeamSection(secondaryTeam.label, secondaryTeam.team)}
    </Modal>
  );
}
