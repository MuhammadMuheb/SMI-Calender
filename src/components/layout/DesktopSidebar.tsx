import type { ReactNode } from 'react';
import { theme } from '../../config/theme';
import { ROLES, ROLE_LABELS, type Role } from '../../config/roles';
import { Icons } from '../ui';
import type { TabId } from './BottomNav';

interface NavItem { id: TabId; label: string; icon: ReactNode; badge?: number; superAdminOnly?: boolean; }

interface DesktopSidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  role: Role;
  displayName: string;
  pendingCount: number;
  onLogout: () => void;
}

/**
 * Persistent left navigation for the desktop console (Manager and Super
 * Admin). Mirrors the mobile bottom-nav destinations plus a couple of
 * power-user shortcuts (Approvals, Admin Tools) that on mobile require
 * drilling in from the Home dashboard — company-wide config tools stay
 * Super Admin only regardless of device.
 */
export default function DesktopSidebar({
  activeTab, onTabChange, role, displayName, pendingCount, onLogout,
}: DesktopSidebarProps) {
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;

  // Capability blueprint: a manager's desktop view is a straight port of what
  // they already have on mobile (dashboard, team, calendar, approvals) — the
  // company-wide config tools (staffing rules, auto-assignment, audit log,
  // user/role management) are super_admin only, on any device.
  const allItems: NavItem[] = [
    { id: 'home', label: 'Dashboard', icon: Icons.home },
    { id: 'staff', label: 'Team Overview', icon: Icons.users },
    { id: 'calendar', label: 'Calendar', icon: Icons.calendar },
    { id: 'requests', label: 'Requests Queue', icon: Icons.bell, badge: pendingCount },
    { id: 'staffingRules', label: 'Staffing Rules', icon: Icons.shield, superAdminOnly: true },
    { id: 'autoAssign', label: 'Auto-Assignment', icon: '\u{1F504}', superAdminOnly: true },
    { id: 'auditLog', label: 'Audit Log', icon: Icons.clock, superAdminOnly: true },
    { id: 'tasks', label: 'Tasks', icon: '\u{1F4CB}' },
    { id: 'admin', label: 'Admin Tools', icon: '\u{1F6E0}\u{FE0F}', superAdminOnly: true },
    { id: 'settings', label: 'Settings', icon: Icons.settings },
  ];
  const items = allItems.filter((item) => !item.superAdminOnly || isSuperAdmin);

  return (
    <aside
      className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0"
      style={{ backgroundColor: theme.colors.bgElevated, borderRight: `1px solid ${theme.colors.border}` }}
    >
      <div className="px-5 py-5" style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
        <p className="text-sm font-bold tracking-wide" style={{ color: theme.colors.white }}>Show Me Italy</p>
        <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>
          Staff Calendar · {isSuperAdmin ? 'Super Admin' : 'Manager'} Console
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {items.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={active ? 'page' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer"
              style={{
                backgroundColor: active ? theme.colors.primary + '18' : 'transparent',
                borderLeft: `3px solid ${active ? theme.colors.primary : 'transparent'}`,
              }}
            >
              <span aria-hidden="true" style={{ color: active ? theme.colors.primary : theme.colors.grayDark }}>
                {item.icon}
              </span>
              <span className="text-xs font-medium flex-1" style={{ color: active ? theme.colors.white : theme.colors.gray }}>
                {item.label}
              </span>
              {!!item.badge && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: theme.colors.warning, color: theme.colors.bg }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-4" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
        <div className="flex items-center gap-2.5 px-2 mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
            style={{ backgroundColor: theme.colors.primary, color: theme.colors.white }}
          >
            {displayName[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: theme.colors.white }}>{displayName}</p>
            <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>{ROLE_LABELS[role]}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Sign out"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer"
          style={{ color: theme.colors.secondary, border: `1px solid ${theme.colors.border}` }}
        >
          <span aria-hidden="true">{Icons.logout}</span> Sign Out
        </button>
      </div>
    </aside>
  );
}
