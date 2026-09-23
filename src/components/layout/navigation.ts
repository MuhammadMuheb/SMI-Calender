import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays, ClipboardList, History, Inbox, LayoutDashboard, Settings, ShieldCheck, Sparkles,
  UserCog, Users, Wrench,
} from 'lucide-react';
import { ROLES, type Role } from '@/config/roles';

export type TabId =
  | 'home' | 'tasks' | 'calendar' | 'staff' | 'settings'
  | 'requests' | 'admin' | 'staffingRules' | 'autoAssign' | 'auditLog' | 'staffManagement';

export interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const EVERYONE: Role[] = [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.STAFF, ROLES.SPECTATOR];
const WORKERS: Role[] = [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.STAFF];
const LEADS: Role[] = [ROLES.SUPER_ADMIN, ROLES.MANAGER];
const ADMIN: Role[] = [ROLES.SUPER_ADMIN];

export const NAV_ITEMS: Record<TabId, NavItem> = {
  home: { id: 'home', label: 'Dashboard', icon: LayoutDashboard, roles: EVERYONE },
  calendar: { id: 'calendar', label: 'Calendar', icon: CalendarDays, roles: EVERYONE },
  tasks: { id: 'tasks', label: 'Tasks', icon: ClipboardList, roles: WORKERS },
  requests: { id: 'requests', label: 'Requests', icon: Inbox, roles: LEADS },
  staff: { id: 'staff', label: 'Team overview', icon: Users, roles: LEADS },
  staffManagement: { id: 'staffManagement', label: 'People', icon: UserCog, roles: ADMIN },
  staffingRules: { id: 'staffingRules', label: 'Staffing rules', icon: ShieldCheck, roles: ADMIN },
  autoAssign: { id: 'autoAssign', label: 'Auto-assign days off', icon: Sparkles, roles: ADMIN },
  auditLog: { id: 'auditLog', label: 'Audit log', icon: History, roles: ADMIN },
  admin: { id: 'admin', label: 'Admin tools', icon: Wrench, roles: ADMIN },
  settings: { id: 'settings', label: 'Settings', icon: Settings, roles: EVERYONE },
};

/** Sidebar grouping on desktop, and the "More" sheet on mobile. */
const GROUPS: { label: string; ids: TabId[] }[] = [
  { label: 'Workspace', ids: ['home', 'calendar', 'tasks'] },
  { label: 'Team', ids: ['requests', 'staff'] },
  { label: 'Administration', ids: ['staffManagement', 'staffingRules', 'autoAssign', 'auditLog', 'admin'] },
];

export function canAccess(role: Role, tab: TabId): boolean {
  return NAV_ITEMS[tab].roles.includes(role);
}

export function navGroupsFor(role: Role): NavGroup[] {
  return GROUPS
    .map((g) => ({ label: g.label, items: g.ids.map((id) => NAV_ITEMS[id]).filter((i) => i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);
}

/** Up to four primary destinations for the mobile tab bar; the rest live under "More". */
export function mobileTabsFor(role: Role): NavItem[] {
  const ids: TabId[] = role === ROLES.SPECTATOR
    ? ['home', 'calendar']
    : role === ROLES.STAFF
      ? ['home', 'calendar', 'tasks']
      : ['home', 'requests', 'calendar', 'staff'];
  return ids.map((id) => NAV_ITEMS[id]);
}

export function mobileOverflowFor(role: Role): NavItem[] {
  const primary = new Set(mobileTabsFor(role).map((t) => t.id));
  const rest = navGroupsFor(role).flatMap((g) => g.items).filter((i) => !primary.has(i.id));
  return [...rest, NAV_ITEMS.settings];
}
