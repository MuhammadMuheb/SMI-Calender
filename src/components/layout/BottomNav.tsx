import type { ReactNode } from 'react';
import { theme } from '../../config/theme';
import { ROLES, type Role } from '../../config/roles';
import { Icons } from '../ui';

export type TabId =
  | 'home' | 'tasks' | 'calendar' | 'staff' | 'settings'
  | 'requests' | 'admin' | 'staffingRules' | 'autoAssign' | 'auditLog';

interface Tab { id: TabId; icon: ReactNode; label: string; }

interface BottomNavProps { activeTab: TabId; onTabChange: (tab: TabId) => void; role: Role; }

export default function BottomNav({ activeTab, onTabChange, role }: BottomNavProps) {
  const tabs: Tab[] = role === ROLES.SPECTATOR
    ? [
        { id: 'home', icon: Icons.home, label: 'Home' },
        { id: 'calendar', icon: Icons.calendar, label: 'Calendar' },
        { id: 'settings', icon: Icons.settings, label: 'Settings' },
      ]
    : [
        { id: 'home', icon: Icons.home, label: 'Home' },
        { id: 'tasks', icon: '\u{1F4CB}', label: 'Tasks' },
        { id: 'calendar', icon: Icons.calendar, label: 'Calendar' },
        ...(role !== ROLES.STAFF ? [{ id: 'staff' as TabId, icon: Icons.users, label: 'Staff' }] : []),
        { id: 'settings', icon: Icons.settings, label: 'Settings' },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]"
      style={{ backgroundColor: theme.colors.bgElevated, borderTop: `1px solid ${theme.colors.border}` }}>
      <div className="flex items-center justify-around max-w-md mx-auto h-14">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => onTabChange(t.id)}
              aria-label={t.label} aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center gap-0.5 px-3 py-1 transition-all cursor-pointer">
              <span aria-hidden="true" className="transition-colors" style={{ color: active ? theme.colors.primary : theme.colors.grayDark }}>{t.icon}</span>
              <span className="text-[10px] font-medium" style={{ color: active ? theme.colors.primary : theme.colors.grayDark }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
