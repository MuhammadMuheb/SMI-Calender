import { useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import SuperAdminDashboard from '@/features/dashboard/SuperAdminDashboard';
import ManagerDashboard from '@/features/dashboard/ManagerDashboard';
import StaffDashboard from '@/features/dashboard/StaffDashboard';
import SpectatorDashboard from '@/features/dashboard/SpectatorDashboard';
import CalendarPage from '@/features/calendar/CalendarPage';
import TaskBoard from '@/features/tasks/TaskBoard';
import StaffPage from '@/features/staff/StaffPage';
import SettingsPage from '@/features/settings/SettingsPage';
import ManagerRequestQueue from '@/features/leave/pages/ManagerRequestQueue';
import AdminPanel from '@/features/admin/pages/AdminPanel';
import StaffManagement from '@/features/admin/pages/StaffManagement';
import StaffingRulesPage from '@/features/admin/pages/StaffingRulesPage';
import AutoAssignment from '@/features/admin/pages/AutoAssignment';
import AuditLogPage from '@/features/admin/pages/AuditLogPage';
import CycleManager from '@/features/leave/components/CycleManager';
import { ROLES } from '@/config/roles';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { AppSidebar } from './AppSidebar';
import { MobileTabBar } from './MobileTabBar';
import { NotificationBell } from './NotificationBell';
import { BrandMark } from './BrandMark';
import { NAV_ITEMS, canAccess, type TabId } from './navigation';

export default function AppShell() {
  const { user, logout } = useAuth();
  const { getPendingRequests } = useLeave();
  const [tab, setTab] = useState<TabId>('home');
  const isDesktop = useIsDesktop();

  if (!user) return null;

  const pendingCount = getPendingRequests().filter((r) => r.userId !== user.id).length;

  const dashboards: Record<string, ReactNode> = {
    [ROLES.SUPER_ADMIN]: <SuperAdminDashboard />,
    [ROLES.MANAGER]: <ManagerDashboard />,
    [ROLES.STAFF]: <StaffDashboard />,
    [ROLES.SPECTATOR]: <SpectatorDashboard />,
  };

  const content: Record<TabId, ReactNode> = {
    home: dashboards[user.role],
    tasks: <TaskBoard />,
    calendar: <CalendarPage />,
    staff: <StaffPage />,
    requests: <ManagerRequestQueue />,
    admin: <AdminPanel />,
    staffingRules: <StaffingRulesPage />,
    autoAssign: <AutoAssignment />,
    auditLog: <AuditLogPage />,
    staffManagement: <StaffManagement />,
    settings: <SettingsPage />,
  };
  // A tab the role can't see (e.g. after a role change) falls back to the dashboard.
  const page = canAccess(user.role, tab) ? content[tab] : content.home;
  const title = tab === 'home' ? `Hi, ${user.displayName.split(' ')[0]}` : NAV_ITEMS[tab].label;

  if (isDesktop) {
    return (
      <SidebarProvider>
        <AppSidebar
          role={user.role}
          displayName={user.displayName}
          activeTab={tab}
          onTabChange={setTab}
          pendingCount={pendingCount}
          onLogout={logout}
        />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-1 self-center data-[orientation=vertical]:h-4" />
            <h1 className="truncate text-sm font-medium">{title}</h1>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <NotificationBell />
            </div>
          </header>
          <CycleManager />
          <main key={tab} className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
            {page}
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <div className="min-h-svh bg-background pb-tabbar">
      <header className="sticky top-0 z-30 border-b bg-background/95 pt-safe backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2.5 px-4">
          <BrandMark className="size-7" />
          <h1 className="truncate text-base font-semibold">{title}</h1>
          <div className="ml-auto flex items-center">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
      </header>
      <CycleManager />
      <main key={tab} className="mx-auto w-full max-w-2xl px-4 py-4">
        {page}
      </main>
      <MobileTabBar
        role={user.role}
        displayName={user.displayName}
        activeTab={tab}
        onTabChange={setTab}
        pendingCount={pendingCount}
        onLogout={logout}
      />
    </div>
  );
}
