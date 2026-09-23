import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bell, ChevronRight, Coffee, FileUp, History, MapPin, Palmtree, ShieldCheck, Sparkles, Star, Tags,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { ROLES } from '@/config/roles';
import { PageHeader } from '@/components/shared/PageHeader';
import RoleManagement from '@/features/admin/pages/RoleManagement';
import StaffingRulesPage from '@/features/admin/pages/StaffingRulesPage';
import SpecialDayEditor from '@/features/admin/pages/SpecialDayEditor';
import VacationAdjustment from '@/features/admin/pages/VacationAdjustment';
import NotificationSettingsPage from '@/features/admin/pages/NotificationSettingsPage';
import AutoAssignment from '@/features/admin/pages/AutoAssignment';
import AuditLogPage from '@/features/admin/pages/AuditLogPage';
import CoffeeLeaderboard from '@/features/admin/pages/CoffeeLeaderboard';
import LocationManager from '@/features/attendance/components/LocationManager';
import ScheduleImport from '@/features/admin/pages/ScheduleImport';

type AdminView = 'menu' | 'roles' | 'staffing' | 'special' | 'vacation' | 'notifications' | 'auto' | 'audit' | 'coffee' | 'locations' | 'schedules';

interface MenuItem {
  id: Exclude<AdminView, 'menu'>;
  label: string;
  description: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'roles', label: 'Job roles', description: 'Positions, colors and shift times, including hidden roles.', icon: Tags, superAdminOnly: true },
  { id: 'staffing', label: 'Staffing rules', description: 'Minimum coverage per job role for each day.', icon: ShieldCheck, superAdminOnly: true },
  { id: 'locations', label: 'Check-in locations', description: 'GPS check-in locations and who can use them.', icon: MapPin, superAdminOnly: true },
  { id: 'schedules', label: 'Import schedules', description: 'Import tour guide schedules from a PDF.', icon: FileUp, superAdminOnly: true },
  { id: 'special', label: 'Special days', description: 'Add days that use up or add to leave balances.', icon: Star },
  { id: 'vacation', label: 'Leave allowances', description: 'Adjust vacation balances and day-off allowances.', icon: Palmtree },
  { id: 'notifications', label: 'Notifications', description: 'Daily reminder time and which alerts are sent.', icon: Bell },
  { id: 'auto', label: 'Auto-assign days off', description: 'Fill the remaining day-off slots automatically.', icon: Sparkles, superAdminOnly: true },
  { id: 'audit', label: 'Audit log', description: 'Every change made in the system, and who made it.', icon: History, superAdminOnly: true },
  { id: 'coffee', label: 'Coffee leaderboard', description: 'See who makes the most coffee runs.', icon: Coffee },
];

interface AdminPanelProps {
  onBack?: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const { user } = useAuth();
  const [view, setView] = useState<AdminView>('menu');

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const visibleItems = MENU_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin);
  const backToMenu = () => setView('menu');

  const views: Record<Exclude<AdminView, 'menu'>, ReactNode> = {
    roles: <RoleManagement onBack={backToMenu} />,
    staffing: <StaffingRulesPage onBack={backToMenu} />,
    schedules: <ScheduleImport onBack={backToMenu} />,
    special: <SpecialDayEditor onBack={backToMenu} />,
    vacation: <VacationAdjustment onBack={backToMenu} />,
    notifications: <NotificationSettingsPage onBack={backToMenu} />,
    auto: <AutoAssignment onBack={backToMenu} />,
    audit: <AuditLogPage onBack={backToMenu} />,
    coffee: <CoffeeLeaderboard onBack={backToMenu} />,
    locations: (
      <div className="space-y-6">
        <PageHeader
          title="Check-in locations"
          description="GPS check-in locations and who can use them."
          onBack={backToMenu}
        />
        <LocationManager />
      </div>
    ),
  };

  if (view !== 'menu') return <>{views[view]}</>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin tools"
        description="Settings and maintenance for the whole team."
        onBack={onBack}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className="group flex min-h-16 items-start gap-3 rounded-xl border bg-card p-4 text-left text-card-foreground transition-colors hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{item.description}</span>
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
