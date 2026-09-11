import { useState } from 'react';
import { Card, Badge, Icons, Modal, StatBox } from '../../components/ui';
import { theme } from '../../config/theme';
import { alpha } from '../../utils/themeColor';
import { useLeave } from '../../context/LeaveContext';
import { useAppData } from '../../context/AppDataContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { todayStr, formatDateLocal } from '../../utils/dateUtils';
import ManagerRequestQueue from '../ManagerRequestQueue';
import AdminPanel from '../admin/AdminPanel';
import WorkingTodayModal from '../../components/WorkingTodayModal';
import CheckInButton from '../../components/CheckInButton';
import AttendanceSummary from '../../components/AttendanceSummary';
import TomorrowDutyModal from '../../components/TomorrowDutyModal';
import CheckInBoard from '../../components/CheckInBoard';
import AttendanceMonitor from '../../components/AttendanceMonitor';
import ShiftStatusBoard from '../../components/ShiftStatusBoard';

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const { requests, getPendingRequests } = useLeave();
  const { users, jobRoles, roleAssignments } = useAppData();
  const { addNotification } = useNotifications();
  const isDesktop = useIsDesktop();
  const [view, setView] = useState<'dashboard' | 'queue' | 'admin' | 'attendance' | 'checkins' | 'shiftStatus'>('dashboard');

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [showWorkingTodayModal, setShowWorkingTodayModal] = useState(false);

  if (view === 'queue') return <ManagerRequestQueue onBack={() => setView('dashboard')} />;
  if (view === 'admin') return <AdminPanel onBack={() => setView('dashboard')} />;
  if (view === 'checkins') return <CheckInBoard onBack={() => setView('dashboard')} currentUserRole={user?.role ?? 'super_admin'} />;
  if (view === 'shiftStatus') return <ShiftStatusBoard onBack={() => setView('dashboard')} />;
  if (view === 'attendance') return (
    <div className="space-y-3">
      <button onClick={() => setView('dashboard')} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
      <AttendanceSummary currentUserId={user?.id ?? ''} currentUserRole={user?.role ?? 'super_admin'} currentUserJobRoles={user?.jobRole ?? ['Office']} />
    </div>
  );

  const activeStaff = users.filter((u) => u.isActive);
  const totalStaff = activeStaff.length;
  const pendingCount = getPendingRequests().length;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateLocal(tomorrow);
  const tomorrowLabel = tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const approvedTomorrow = requests.filter((r) => r.date === tomorrowStr && r.status === 'approved');
  const offTomorrowIds = new Set(approvedTomorrow.map((r) => r.userId));
  const onDutyTomorrow = activeStaff.filter((u) => !offTomorrowIds.has(u.id));

  const today = todayStr();
  const approvedToday = requests.filter((r) => r.date === today && r.status === 'approved').length;
  const onDutyToday = totalStaff - approvedToday;

  const getUserRoles = (userId: string) => {
    const assigns = roleAssignments.filter((a) => a.userId === userId);
    return assigns.map((a) => {
      const role = jobRoles.find((r) => r.id === a.jobRoleId);
      return role ? { name: role.name, color: role.color, shiftStart: role.shiftStartTime, shiftEnd: role.shiftEndTime, isPrimary: a.isPrimary } : null;
    }).filter(Boolean) as { name: string; color: string; shiftStart: string; shiftEnd: string; isPrimary: boolean }[];
  };

  const handleSendNotifications = (selectedIds: string[], shiftTimes: Record<string, { start: string; end: string }>) => {
    if (!user) return;
    for (const staffId of selectedIds) {
      const staff = activeStaff.find((u) => u.id === staffId);
      if (!staff) continue;
      const t = shiftTimes[staffId] ?? { start: '08:00', end: '17:00' };
      const roles = getUserRoles(staff.id);
      const roleLabel = roles.map((r) => r.name).join(', ') || 'Staff';
      addNotification(
        staff.id, 'daily_absence_summary',
        `Tomorrow's Shift — ${tomorrowLabel}`,
        `You are on duty as ${roleLabel}, ${t.start} – ${t.end}. Please confirm or reject.`,
      );
    }
  };

  const stats = [
    { label: 'Total Staff', value: totalStaff, icon: Icons.users, color: theme.colors.primary, onClick: () => setShowStaffModal(true) },
    { label: 'See You Tomorrow', value: onDutyTomorrow.length, icon: Icons.clock, color: theme.colors.primaryLight, onClick: () => setShowDutyModal(true), sub: tomorrowLabel },
    { label: 'Pending Requests', value: pendingCount, icon: Icons.bell, color: theme.colors.warning, onClick: () => setView('queue') },
    { label: 'Working Today', value: onDutyToday, icon: Icons.calendar, color: theme.colors.secondary, onClick: () => setShowWorkingTodayModal(true) },
  ];

  const offTodayIds = new Set(requests.filter((r) => r.date === today && r.status === 'approved').map((r) => r.userId));
  const workingTodayList = activeStaff.filter((u) => !offTodayIds.has(u.id));
  const offTodayList = activeStaff.filter((u) => offTodayIds.has(u.id));

  // On desktop, Requests Queue and Admin Tools already live in the sidebar —
  // repeating them here would just be clutter, so only list what has no
  // sidebar equivalent yet.
  const quickActions = [
    ...(isDesktop ? [] : [
      { label: 'Approve Requests', action: () => setView('queue'), badge: pendingCount > 0 ? pendingCount : null },
      { label: 'Admin Panel', action: () => setView('admin'), badge: null },
    ]),
    { label: '📋 Shift Responses', action: () => setView('shiftStatus'), badge: null },
    { label: '📍 Check-In Board', action: () => setView('checkins'), badge: null },
    { label: '📊 Attendance Summary', action: () => setView('attendance'), badge: null },
  ];

  return (
    <div className="space-y-4">
      <AttendanceMonitor userRole={user?.role ?? 'staff'} />
      <CheckInButton userId={user?.id ?? ''} userName={user?.displayName ?? ''} userJobRoles={user?.jobRole ?? ['Office']} userRole={user?.role ?? 'super_admin'} />

      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: theme.colors.secondary, color: theme.colors.white }}>
          {user?.displayName[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>{user?.displayName}</p>
          <div className="flex items-center gap-1.5">
            <Badge color="secondary" size="xs">SUPER ADMIN</Badge>
            <span className="text-[9px]" style={{ color: theme.colors.grayDark }}>Show Me Italy</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <StatBox key={i} label={s.label} value={s.value} sub={'sub' in s ? s.sub as string : undefined} color={s.color} icon={s.icon} onClick={s.onClick} />
        ))}
      </div>

      <Card title="Quick Actions" subtitle="Manage your team">
        <div className="space-y-2">
          {quickActions.map((a, i) => (
            <button key={i} onClick={a.action}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all hover:bg-white/5 cursor-pointer"
              style={{ border: `1px solid ${theme.colors.border}` }}>
              <span className="text-xs font-medium" style={{ color: theme.colors.white }}>{a.label}</span>
              <div className="flex items-center gap-1.5">
                {a.badge && <Badge color="warning" size="xs">{a.badge}</Badge>}
                <span style={{ color: theme.colors.grayDark }}>{Icons.chevronRight}</span>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Modal open={showStaffModal} onClose={() => setShowStaffModal(false)} title={`All Staff (${totalStaff})`}>
        <div className="space-y-1.5">
          {activeStaff.map((staff) => {
            const roles = getUserRoles(staff.id);
            return (
              <div key={staff.id} className="flex items-center justify-between py-2 px-3 rounded-lg"
                style={{ backgroundColor: theme.colors.bgCard }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: alpha(theme.colors.primary, '20'), color: theme.colors.primaryLight }}>
                    {staff.displayName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: theme.colors.white }}>{staff.displayName}</p>
                    {roles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {roles.map((r, ri) => (
                          <span key={ri} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: r.color + '20', color: r.color }}>
                            {r.name}{r.isPrimary ? ' ★' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <TomorrowDutyModal
        open={showDutyModal} onClose={() => setShowDutyModal(false)}
        tomorrowLabel={tomorrowLabel} activeStaff={activeStaff}
        offTomorrowIds={offTomorrowIds} approvedTomorrow={approvedTomorrow}
        currentUserJobRoles={user?.jobRole ?? ['Office']} currentUserRole={user?.role ?? 'super_admin'}
        onSendNotifications={handleSendNotifications}
      />

      <WorkingTodayModal
        open={showWorkingTodayModal} onClose={() => setShowWorkingTodayModal(false)}
        title={`Working Today (${workingTodayList.length})`}
        workingList={workingTodayList} offList={offTodayList} offLabel="Off Today"
        currentUserId={user?.id ?? ''} currentUserName={user?.displayName ?? ''}
        getUserRoles={getUserRoles}
      />
    </div>
  );
}
