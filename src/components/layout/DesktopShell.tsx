import type { ReactNode } from 'react';
import { theme } from '../../config/theme';
import type { Role } from '../../config/roles';
import DesktopSidebar from './DesktopSidebar';
import DesktopTopBar from './DesktopTopBar';
import type { TabId } from './BottomNav';

interface DesktopShellProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  role: Role;
  displayName: string;
  pendingCount: number;
  onLogout: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Sidebar + top-bar chrome for the desktop admin console. Mobile never renders this. */
export default function DesktopShell({
  activeTab, onTabChange, role, displayName, pendingCount, onLogout, title, subtitle, children,
}: DesktopShellProps) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: theme.colors.bg }}>
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        role={role}
        displayName={displayName}
        pendingCount={pendingCount}
        onLogout={onLogout}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <DesktopTopBar title={title} subtitle={subtitle} />
        <main className="flex-1 px-8 py-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
