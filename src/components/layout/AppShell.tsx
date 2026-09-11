import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLeave } from '../../context/LeaveContext';
import TopBar from './TopBar';
import BottomNav, { type TabId } from './BottomNav';
import DesktopShell from './DesktopShell';
import SuperAdminDashboard from '../../pages/dashboards/SuperAdminDashboard';
import ManagerDashboard from '../../pages/dashboards/ManagerDashboard';
import StaffDashboard from '../../pages/dashboards/StaffDashboard';
import SpectatorDashboard from '../../pages/dashboards/SpectatorDashboard';
import CalendarPage from '../../pages/CalendarPage';
import TaskBoard from '../../pages/TaskBoard';
import StaffPage from '../../pages/StaffPage';
import SettingsPage from '../../pages/SettingsPage';
import ManagerRequestQueue from '../../pages/ManagerRequestQueue';
import AdminPanel from '../../pages/admin/AdminPanel';
import StaffManagement from '../../pages/admin/StaffManagement';
import StaffingRulesPage from '../../pages/admin/StaffingRulesPage';
import AutoAssignment from '../../pages/admin/AutoAssignment';
import AuditLogPage from '../../pages/admin/AuditLogPage';
import CycleManager from '../CycleManager';
import RoleGuard from '../guards/RoleGuard';
import { ROLES } from '../../config/roles';
import { ROLE_LABELS } from '../../config/roles';
import { theme } from '../../config/theme';
import { useIsDesktop } from '../../hooks/useIsDesktop';

const TAB_TITLES: Record<TabId, string> = {
  home: 'Dashboard',
  tasks: 'Tasks',
  calendar: 'Calendar',
  staff: 'Team Overview',
  settings: 'Settings',
  requests: 'Requests Queue',
  admin: 'Admin Tools',
  staffingRules: 'Staffing Rules',
  autoAssign: 'Auto-Assignment',
  auditLog: 'Audit Log',
  staffManagement: 'Team Management',
};

const DESKTOP_ONLY_TABS: TabId[] = ['requests', 'admin', 'staffingRules', 'autoAssign', 'auditLog', 'staffManagement'];
// Company-wide config tools — Super Admin only, on any device, per the capability blueprint.
const SUPER_ADMIN_ONLY_TABS: TabId[] = ['admin', 'staffingRules', 'autoAssign', 'auditLog', 'staffManagement'];

export default function AppShell() {
  const { user, logout } = useAuth();
  const { getPendingRequests } = useLeave();
  const [tab, setTab] = useState<TabId>('home');
  const isDesktop = useIsDesktop();

  // Desktop console: Manager and Super Admin. Staff and Spectator always get
  // the mobile-first UI, regardless of screen size.
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const isManager = user?.role === ROLES.MANAGER;
  const showDesktopShell = isDesktop && (isSuperAdmin || isManager);

  // 'requests' etc. are desktop-only sidebar destinations — if the window
  // shrinks below the desktop breakpoint while one is active, fall back to
  // Home so mobile's bottom nav isn't left stranded. Separately, the
  // company-wide config tabs are Super Admin only regardless of device.
  useEffect(() => {
    if (!showDesktopShell && DESKTOP_ONLY_TABS.includes(tab)) {
      setTab('home');
    } else if (!isSuperAdmin && SUPER_ADMIN_ONLY_TABS.includes(tab)) {
      setTab('home');
    }
  }, [showDesktopShell, isSuperAdmin, tab]);

  if (!user) return null;

  const dashboardByRole: Record<string, React.ReactNode> = {
    [ROLES.SUPER_ADMIN]: <SuperAdminDashboard />,
    [ROLES.MANAGER]: <ManagerDashboard />,
    [ROLES.STAFF]: <StaffDashboard />,
    [ROLES.SPECTATOR]: <SpectatorDashboard />,
  };

  const tabContent: Record<TabId, React.ReactNode> = {
    home: dashboardByRole[user.role],
    tasks: <TaskBoard />,
    calendar: <CalendarPage />,
    staff: (
      <RoleGuard allowed={[ROLES.SUPER_ADMIN, ROLES.MANAGER]}>
        <StaffPage />
      </RoleGuard>
    ),
    requests: (
      <RoleGuard allowed={[ROLES.SUPER_ADMIN, ROLES.MANAGER]}>
        <ManagerRequestQueue onBack={() => setTab('home')} />
      </RoleGuard>
    ),
    admin: (
      <RoleGuard allowed={[ROLES.SUPER_ADMIN]}>
        <AdminPanel onBack={() => setTab('home')} />
      </RoleGuard>
    ),
    staffingRules: (
      <RoleGuard allowed={[ROLES.SUPER_ADMIN]}>
        <StaffingRulesPage onBack={() => setTab('home')} />
      </RoleGuard>
    ),
    autoAssign: (
      <RoleGuard allowed={[ROLES.SUPER_ADMIN]}>
        <AutoAssignment onBack={() => setTab('home')} />
      </RoleGuard>
    ),
    auditLog: (
      <RoleGuard allowed={[ROLES.SUPER_ADMIN]}>
        <AuditLogPage onBack={() => setTab('home')} />
      </RoleGuard>
    ),
    staffManagement: (
      <RoleGuard allowed={[ROLES.SUPER_ADMIN]}>
        <StaffManagement onBack={() => setTab('home')} />
      </RoleGuard>
    ),
    settings: <SettingsPage />,
  };

  if (showDesktopShell) {
    return (
      <DesktopShell
        activeTab={tab}
        onTabChange={setTab}
        role={user.role}
        displayName={user.displayName}
        pendingCount={getPendingRequests().length}
        onLogout={logout}
        title={TAB_TITLES[tab]}
        subtitle={tab === 'home' ? ROLE_LABELS[user.role] : undefined}
      >
        <CycleManager />
        {tabContent[tab]}
      </DesktopShell>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.bg, paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
      <TopBar
        title={TAB_TITLES[tab]}
        subtitle={tab === 'home' ? ROLE_LABELS[user.role] : undefined}
        onLogout={logout}
      />
      <CycleManager />
      <main className="px-4 py-4 max-w-md md:max-w-2xl lg:max-w-4xl mx-auto">
        {tabContent[tab]}
      </main>
      <BottomNav activeTab={tab} onTabChange={setTab} role={user.role} />
    </div>
  );
}
