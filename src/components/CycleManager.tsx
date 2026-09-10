import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLeave } from '../context/LeaveContext';
import { useAppData } from '../context/AppDataContext';
import { useNotifications } from '../context/NotificationContext';
import { getCycleInfo, getUnfilledUsers } from '../services/cycleScheduler';
import { runAutoAssignment } from '../services/autoAssignService';
import { insertAuditLog } from '../services/supabaseService';

export default function CycleManager() {
  const { user } = useAuth();
  const { requests, submitRequest } = useLeave();
  const { users, jobRoles, roleAssignments, staffingRules, holidays, specialDays } = useAppData();
  const { addNotification } = useNotifications();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    if (!user || user.role !== 'super_admin') return;
    if (!users || users.length === 0) return;
    if (!requests) return;

    hasRun.current = true;

    try {
      const info = getCycleInfo();
      const lastCycleOpen = Number(localStorage.getItem('smi_last_cycle_open') ?? '-1');
      const lastWarning = Number(localStorage.getItem('smi_last_warning') ?? '-1');
      const lastAutoAssign = Number(localStorage.getItem('smi_last_auto_assign') ?? '-1');

      const nextLabel = `${new Date(info.nextStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(info.nextEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      // 1. New cycle → notify everyone that next cycle is open for requests
      if (lastCycleOpen < info.cycleIndex) {
        setTimeout(() => {
          try {
            for (const u of users.filter(u => u.isActive)) {
              addNotification(u.id, 'new_request_pending', '📅 New Cycle Open!',
                `Next cycle (${nextLabel}) is now open for day-off requests.`);
            }
            localStorage.setItem('smi_last_cycle_open', String(info.cycleIndex));
          } catch (e) { console.error('CycleManager: cycle open notification error', e); }
        }, 2000);
      }

      // 2. Week 3 → warn unfilled users about NEXT cycle
      if (info.week >= 3 && lastWarning < info.cycleIndex) {
        setTimeout(() => {
          try {
            // Check who hasn't filled their days for the NEXT cycle
            const unfilled = getUnfilledUsers(users, requests, info.nextStart, info.nextEnd);
            if (unfilled.length > 0) {
              for (const u of unfilled) {
                addNotification(u.userId, 'new_request_pending', '⚠️ Day-Off Reminder',
                  `You have ${u.remaining} day(s) off not yet requested for next cycle (${nextLabel}). System will auto-assign in the last week.`);
              }
              addNotification(user.id, 'new_request_pending', '⚠️ Unfilled Days',
                `${unfilled.length} people haven't requested all days off for ${nextLabel}.`);
            }
            localStorage.setItem('smi_last_warning', String(info.cycleIndex));
          } catch (e) { console.error('CycleManager: week 3 warning error', e); }
        }, 3000);
      }

      // 3. Last week (week 4) → auto-assign unfilled days for NEXT cycle (future dates)
      if (info.week >= 4 && lastAutoAssign < info.cycleIndex) {
        setTimeout(async () => {
          try {
            const roleNames: Record<string, string> = {};
            for (const r of jobRoles) roleNames[r.id] = r.name;

            // Auto-assign for the NEXT cycle — these are future dates
            const preview = runAutoAssignment(users, requests, staffingRules, roleAssignments,
              holidays, specialDays, roleNames, info.nextStart, info.nextEnd);

            if (preview.totalAssigned > 0) {
              for (const a of preview.assignments) {
                const u = users.find(x => x.id === a.userId);
                if (!u) continue;
                await submitRequest(a.userId,
                  { id: a.userId, displayName: a.userName, role: u.role as 'staff' | 'manager' | 'super_admin' },
                  a.date, 'regular_day_off', 'Auto-assigned (deadline passed)', true);
              }
              const affected = [...new Set(preview.assignments.map(a => a.userId))];
              for (const uid of affected) {
                const days = preview.assignments.filter(a => a.userId === uid).length;
                addNotification(uid, 'new_request_pending', '🔄 Days Auto-Assigned',
                  `System auto-assigned ${days} day(s) off for ${nextLabel} (not requested before deadline).`);
              }
              await insertAuditLog({ actorId: 'system', actorName: 'System',
                action: 'auto_assignment_run', entityType: 'auto_assignment', entityId: 'cycle_deadline',
                description: `Auto-assign for ${nextLabel}: ${preview.totalAssigned} days across ${affected.length} people` });
            }
            localStorage.setItem('smi_last_auto_assign', String(info.cycleIndex));
          } catch (e) { console.error('CycleManager: auto-assign error', e); }
        }, 5000);
      }

    } catch (e) {
      console.error('CycleManager error:', e);
    }
  }, [user, users, requests]);

  return null;
}
