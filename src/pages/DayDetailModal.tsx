import { useState, useMemo } from 'react';
import { Modal, Badge, Button } from '../components/ui';
import { theme } from '../config/theme';
import { alpha } from '../utils/themeColor';
import { useAuth } from '../context/AuthContext';
import { useLeave } from '../context/LeaveContext';
import { useAppData } from '../context/AppDataContext';
import { useNotifications } from '../context/NotificationContext';
import { LEAVE_TYPE_LABELS } from '../models/leave';
import type { LeaveType } from '../models/leave';

interface DayDetailModalProps { date: string | null; open: boolean; onClose: () => void; }

export default function DayDetailModal({ date, open, onClose }: DayDetailModalProps) {
  const { user } = useAuth();
  const { requests, cancelRequest, directAssign } = useLeave();
  const { holidays, specialDays, users, roleAssignments, schedules } = useAppData();
  const { addNotification } = useNotifications();
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [showMyDays, setShowMyDays] = useState(false);
  const [selectedMyDay, setSelectedMyDay] = useState<string | null>(null);
  const [swapSent, setSwapSent] = useState(false);

  // Super admin assign states
  const [showAssign, setShowAssign] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignType, setAssignType] = useState<LeaveType>('regular_day_off');
  const [assigning, setAssigning] = useState(false);
  const [assignDone, setAssignDone] = useState(false);
  const [assignError, setAssignError] = useState('');

  const myOffDays = useMemo(() => {
    if (!date || !user) return [];
    const month = date.slice(0, 7);
    return requests.filter((r: any) => r.userId === user.id && r.date.startsWith(month) && r.status === 'approved' && r.date !== date)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [requests, user, date]);

  const scheduledGuides = useMemo(() => {
    if (!date || !schedules) return [];
    const daySchedules = schedules.filter((s: any) => s.date === date);
    return [...new Set(daySchedules.map((s: any) => s.guide))].sort();
  }, [date, schedules]);

  if (!date || !user) return null;

  const dayRequests = requests.filter((r) => r.date === date && r.status !== 'cancelled');
  const approvedOff = dayRequests.filter((r) => r.status === 'approved');
  const pending = dayRequests.filter((r) => r.status === 'pending');
  const holiday = holidays.find((h) => h.date === date);
  const special = specialDays.find((s) => s.date === date);
  const amIWorking = !approvedOff.some((r) => r.userId === user.id);
  const myRoleIds = roleAssignments.filter((a) => a.userId === user.id).map((a) => a.jobRoleId);
  const isSuperAdmin = user.role === 'super_admin';
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

  const handleSwapRequest = () => {
    if (!swapTarget || !selectedMyDay) return;
    const target = users.find((u) => u.id === swapTarget);
    if (!target) return;
    const wantDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const offerDate = new Date(selectedMyDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    try {
      addNotification(swapTarget, 'new_request_pending', '🔄 Swap Request',
        `${user.displayName} wants to swap: take your ${wantDate} off, give you ${offerDate} off instead.`);
      const admins = users.filter((u) => (u.role === 'manager' || u.role === 'super_admin') && u.id !== user.id);
      for (const admin of admins) {
        addNotification(admin.id, 'new_request_pending', '🔄 Swap Request',
          `${user.displayName} → ${target.displayName}: ${wantDate} ↔ ${offerDate}`);
      }
    } catch (e) { console.error('Swap notification error:', e); }
    setSwapSent(true);
    setTimeout(() => { setSwapSent(false); setSwapTarget(null); setSelectedMyDay(null); setShowMyDays(false); }, 2000);
  };

  const handleAssign = async () => {
    if (!assignUserId) { setAssignError('Select a person'); return; }
    setAssigning(true); setAssignError('');
    const targetUser = users.find(u => u.id === assignUserId);
    if (!targetUser) { setAssignError('User not found'); setAssigning(false); return; }
    const err = await directAssign(targetUser.id, targetUser.displayName, targetUser.role as 'staff' | 'manager' | 'super_admin', date, assignType, user.displayName);
    setAssigning(false);
    if (err) { setAssignError(err); return; }
    setAssignDone(true);
    setTimeout(() => { setAssignDone(false); setShowAssign(false); setAssignUserId(''); setAssignType('regular_day_off'); }, 1200);
  };

  const handleClose = () => { setSwapTarget(null); setShowMyDays(false); setSelectedMyDay(null); setSwapSent(false); setShowAssign(false); setAssignUserId(''); setAssignError(''); setAssignDone(false); onClose(); };
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const LEAVE_TYPES: { type: LeaveType; label: string }[] = [
    { type: 'regular_day_off', label: 'Day Off' },
    { type: 'paid_vacation', label: 'Vacation' },
    { type: 'sick_day', label: 'Sick Day' },
  ];

  return (
    <Modal open={open} onClose={handleClose} title={dateLabel}>
      {holiday && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg"
          style={{ backgroundColor: alpha(theme.colors.secondary, '15'), border: `1px solid ${alpha(theme.colors.secondary, '30')}` }}>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.secondary }} />
          <span className="text-xs font-medium" style={{ color: theme.colors.secondary }}>{holiday.name}</span>
        </div>
      )}
      {special && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg"
          style={{ backgroundColor: alpha(theme.colors.warning, '15'), border: `1px solid ${alpha(theme.colors.warning, '30')}` }}>
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: theme.colors.warning }} />
          <span className="text-xs font-medium" style={{ color: theme.colors.warning }}>{special.name}</span>
        </div>
      )}

      {scheduledGuides.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.colors.grayDark }}>📍 Tour Guides Scheduled ({scheduledGuides.length})</p>
          <div className="space-y-1.5">
            {scheduledGuides.map((guide: string) => (
              <div key={guide} className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ backgroundColor: alpha(theme.colors.primary, '10'), border: `1px solid ${alpha(theme.colors.primary, '20')}` }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: alpha(theme.colors.primary, '30'), color: theme.colors.primaryLight }}>
                  {guide[0]?.toUpperCase()}
                </div>
                <p className="text-xs font-medium" style={{ color: theme.colors.white }}>{guide}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvedOff.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.colors.grayDark }}>Off This Day ({approvedOff.length})</p>
          <div className="space-y-1.5">
            {approvedOff.map((r) => {
              const canSwapWith = swappableOff.some((s) => s.userId === r.userId);
              return (
                <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ backgroundColor: theme.colors.bgCard }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: alpha(theme.colors.primary, '20'), color: theme.colors.primaryLight}}>
                      {r.userRef.displayName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: theme.colors.white }}>
                        {r.userRef.displayName}{r.userId === user.id && <span style={{ color: theme.colors.primary }}> (You)</span>}
                      </p>
                      <p className="text-[9px]" style={{ color: theme.colors.grayDark }}>
                        {canSeeLeaveTypeOf(r) ? LEAVE_TYPE_LABELS[r.leaveType] : 'Off'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge color="success" size="xs">Off</Badge>
                    {isSuperAdmin && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); cancelRequest(r.id); }}
                        aria-label={`Remove ${r.userRef.displayName}'s day off`}
                        className="px-1.5 py-1 rounded text-[9px] font-bold cursor-pointer"
                        style={{ backgroundColor: alpha(theme.colors.danger, '20'), color: theme.colors.danger }}><span aria-hidden="true">🗑</span></button>
                    )}
                    {canSwapWith && (
                      <button onClick={() => { setSwapTarget(r.userId); setShowMyDays(true); }}
                        className="px-2 py-1 rounded text-[9px] font-bold cursor-pointer"
                        style={{ backgroundColor: alpha(theme.colors.primary, '20'), color: theme.colors.primaryLight}}>🔄 Swap</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showMyDays && swapTarget && (
        <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.primary}40` }}>
          <p className="text-[10px] font-semibold mb-2" style={{ color: theme.colors.primaryLight }}>Which of your off days to offer in exchange?</p>
          {myOffDays.length === 0 ? (
            <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>No off days this month to offer</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {myOffDays.map((d) => (
                <button key={d.id} onClick={() => setSelectedMyDay(d.date)}
                  className="w-full text-left px-2 py-1.5 rounded cursor-pointer"
                  style={{ backgroundColor: selectedMyDay === d.date ? alpha(theme.colors.primary, '20') : 'transparent',
                    border: `1px solid ${selectedMyDay === d.date ? theme.colors.primary : theme.colors.border}` }}>
                  <p className="text-[10px] font-medium" style={{ color: theme.colors.white }}>
                    {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => { setShowMyDays(false); setSwapTarget(null); setSelectedMyDay(null); }}>Cancel</Button>
            {swapSent ? <Badge color="success">Sent ✓</Badge> : (
              <Button variant="primary" size="sm" onClick={handleSwapRequest} disabled={!selectedMyDay}>Send Swap Request</Button>
            )}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.colors.grayDark }}>Pending ({pending.length})</p>
          {pending.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ backgroundColor: theme.colors.bgCard }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: alpha(theme.colors.warning, '20'), color: theme.colors.warning }}>{r.userRef.displayName[0]?.toUpperCase()}</div>
                <p className="text-xs" style={{ color: theme.colors.white }}>{r.userRef.displayName}</p>
              </div>
              <Badge color="warning" size="xs">Pending</Badge>
            </div>
          ))}
        </div>
      )}

      {scheduledGuides.length === 0 && approvedOff.length === 0 && pending.length === 0 && !holiday && !special && (
        <div className="h-16 flex items-center justify-center rounded-lg" style={{ border: `1px dashed ${theme.colors.border}` }}>
          <p className="text-xs" style={{ color: theme.colors.grayDark }}>Everyone is working this day</p>
        </div>
      )}

      {/* Super Admin: Quick Assign Day Off */}
      {isSuperAdmin && !showAssign && (
        <button onClick={() => setShowAssign(true)}
          className="w-full mt-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer"
          style={{ backgroundColor: alpha(theme.colors.primary, '15'), color: theme.colors.primaryLight, border: `1px solid ${alpha(theme.colors.primary, '30')}` }}>
          + Assign Day Off
        </button>
      )}

      {isSuperAdmin && showAssign && (
        <div className="mt-3 p-3 rounded-xl space-y-3" style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.primary}40` }}>
          <p className="text-[10px] font-semibold" style={{ color: theme.colors.primaryLight }}>Assign Day Off for {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>

          <div>
            <label className="block text-[9px] uppercase mb-1" style={{ color: theme.colors.grayDark }}>Person</label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {assignableUsers.map(u => (
                <button key={u.id} onClick={() => setAssignUserId(u.id)}
                  className="px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer"
                  style={{ backgroundColor: assignUserId === u.id ? alpha(theme.colors.primary, '20') : theme.colors.bgElevated,
                    color: assignUserId === u.id ? theme.colors.primaryLight : theme.colors.grayDark,
                    border: `1px solid ${assignUserId === u.id ? theme.colors.primary : theme.colors.border}` }}>
                  {assignUserId === u.id && '✓ '}{u.displayName}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[9px] uppercase mb-1" style={{ color: theme.colors.grayDark }}>Type</label>
            <div className="flex gap-1.5">
              {LEAVE_TYPES.map(lt => (
                <button key={lt.type} onClick={() => setAssignType(lt.type)}
                  className="flex-1 py-1 rounded-lg text-[10px] font-medium cursor-pointer"
                  style={{ backgroundColor: assignType === lt.type ? alpha(theme.colors.primary, '20') : theme.colors.bgElevated,
                    color: assignType === lt.type ? theme.colors.primaryLight : theme.colors.grayDark,
                    border: `1px solid ${assignType === lt.type ? theme.colors.primary : theme.colors.border}` }}>
                  {lt.label}
                </button>
              ))}
            </div>
          </div>

          {assignError && <p className="text-[10px]" style={{ color: theme.colors.danger }}>{assignError}</p>}
          {assignDone && <Badge color="success">Assigned!</Badge>}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowAssign(false); setAssignUserId(''); setAssignError(''); }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleAssign} disabled={assigning}>
              {assigning ? '...' : 'Assign'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
