import { useState } from 'react';
import { Card, Icons } from '../../components/ui';
import { theme } from '../../config/theme';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../config/roles';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';
import StaffingRulesPage from './StaffingRulesPage';
import SpecialDayEditor from './SpecialDayEditor';
import VacationAdjustment from './VacationAdjustment';
import NotificationSettingsPage from './NotificationSettingsPage';
import AutoAssignment from './AutoAssignment';
import AuditLogPage from './AuditLogPage';
import CoffeeLeaderboard from './CoffeeLeaderboard';
import LocationManager from '../../components/LocationManager';

type AdminView = 'menu' | 'users' | 'roles' | 'staffing' | 'special' | 'vacation' | 'notifications' | 'auto' | 'audit' | 'coffee' | 'locations';

interface MenuItem { id: AdminView; label: string; description: string; superAdminOnly?: boolean }

const MENU_ITEMS: MenuItem[] = [
  { id: 'users', label: 'User Management', description: 'Create, edit, delete staff members', superAdminOnly: true },
  { id: 'roles', label: 'Role Management', description: 'Job roles including hidden roles', superAdminOnly: true },
  { id: 'staffing', label: 'Staffing Rules', description: 'Minimum coverage per role per day', superAdminOnly: true },
  { id: 'locations', label: '📍 Check-In Locations', description: 'Manage GPS check-in locations and role access', superAdminOnly: true },
  { id: 'special', label: 'Special Days', description: 'Create special days (consume or extra)' },
  { id: 'vacation', label: 'Vacation Adjustments', description: 'Manually adjust staff balances' },
  { id: 'notifications', label: 'Notification Settings', description: 'Daily reminder time and toggles' },
  { id: 'auto', label: 'Auto-Assignment', description: 'Fill remaining day-off slots automatically', superAdminOnly: true },
  { id: 'audit', label: 'Audit Log', description: 'View all system actions and changes', superAdminOnly: true },
  { id: 'coffee', label: '☕ Coffee Leaderboard', description: 'Who is the coffee champ?' },
];

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const { user } = useAuth();
  const [view, setView] = useState<AdminView>('menu');

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  const visibleItems = MENU_ITEMS.filter((item) =>
    !item.superAdminOnly || isSuperAdmin,
  );

  const views: Record<AdminView, React.ReactNode> = {
    menu: null,
    users: <UserManagement onBack={() => setView('menu')} />,
    roles: <RoleManagement onBack={() => setView('menu')} />,
    staffing: <StaffingRulesPage onBack={() => setView('menu')} />,
    special: <SpecialDayEditor onBack={() => setView('menu')} />,
    vacation: <VacationAdjustment onBack={() => setView('menu')} />,
    notifications: <NotificationSettingsPage onBack={() => setView('menu')} />,
    auto: <AutoAssignment onBack={() => setView('menu')} />,
    audit: <AuditLogPage onBack={() => setView('menu')} />,
    coffee: <CoffeeLeaderboard onBack={() => setView('menu')} />,
    locations: (
      <div className="space-y-3">
        <button onClick={() => setView('menu')} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
        <LocationManager />
      </div>
    ),
  };

  if (view !== 'menu') return <>{views[view]}</>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>
          ← Back
        </button>
        <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Admin Panel</h2>
      </div>

      <div className="space-y-2">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className="w-full text-left cursor-pointer"
          >
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>{item.label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>{item.description}</p>
                </div>
                <span style={{ color: theme.colors.grayDark }}>{Icons.chevronRight}</span>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
