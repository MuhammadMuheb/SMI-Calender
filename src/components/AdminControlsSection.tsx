import { useState } from 'react';
import { theme } from '../config/theme';
import { alpha } from '../utils/themeColor';
import StaffManagement from '../pages/admin/StaffManagement';
import StaffingRulesPage from '../pages/admin/StaffingRulesPage';
import AutoAssignment from '../pages/admin/AutoAssignment';
import AuditLogPage from '../pages/admin/AuditLogPage';
import VacationAdjustment from '../pages/admin/VacationAdjustment';

type AdminView = 'menu' | 'team' | 'staffing' | 'auto' | 'audit' | 'vacation';

interface AdminMenuItem {
  id: Exclude<AdminView, 'menu'>;
  label: string;
  icon: string;
  description: string;
}

const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
  { id: 'team', label: 'Team Management', icon: '👥', description: 'Manage staff members' },
  { id: 'staffing', label: 'Staffing Rules', icon: '📊', description: 'Set minimum coverage' },
  { id: 'auto', label: 'Auto-Assignment', icon: '⚡', description: 'Fill day-off slots' },
  { id: 'audit', label: 'Audit Log', icon: '📋', description: 'View all actions' },
  { id: 'vacation', label: 'Vacation Adjustments', icon: '🏖️', description: 'Adjust balances' },
];

export default function AdminControlsSection() {
  const [currentView, setCurrentView] = useState<AdminView>('menu');
  const [expanded, setExpanded] = useState(false);

  const handleBack = () => setCurrentView('menu');

  const renderFullPageView = () => {
    switch (currentView) {
      case 'team':
        return (
          <div className="space-y-3">
            <BackButton label="Team Management" onBack={handleBack} />
            <StaffManagement onBack={handleBack} />
          </div>
        );
      case 'staffing':
        return (
          <div className="space-y-3">
            <BackButton label="Staffing Rules" onBack={handleBack} />
            <StaffingRulesPage onBack={handleBack} />
          </div>
        );
      case 'auto':
        return (
          <div className="space-y-3">
            <BackButton label="Auto-Assignment" onBack={handleBack} />
            <AutoAssignment onBack={handleBack} />
          </div>
        );
      case 'audit':
        return (
          <div className="space-y-3">
            <BackButton label="Audit Log" onBack={handleBack} />
            <AuditLogPage onBack={handleBack} />
          </div>
        );
      case 'vacation':
        return (
          <div className="space-y-3">
            <BackButton label="Vacation Adjustments" onBack={handleBack} />
            <VacationAdjustment onBack={handleBack} />
          </div>
        );
      default:
        return null;
    }
  };

  // Show full-page view when admin feature is selected
  if (currentView !== 'menu') {
    return <>{renderFullPageView()}</>;
  }

  // Show Management Console menu
  return (
    <div className="space-y-2">
      {/* Management Console Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer"
        style={{
          backgroundColor: alpha(theme.colors.primary, '10'),
          border: `1px solid ${alpha(theme.colors.primary, '20')}`,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>🛠️</span>
          <span className="text-xs font-semibold" style={{ color: theme.colors.white }}>
            Management Console
          </span>
          <Badge color="primary" size="xs">
            {ADMIN_MENU_ITEMS.length}
          </Badge>
        </div>
        <span
          style={{
            color: theme.colors.grayDark,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
            fontSize: 16,
          }}
        >
          ▼
        </span>
      </button>

      {/* Menu Items */}
      {expanded && (
        <div className="space-y-1 pl-1">
          {ADMIN_MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors"
              style={{
                backgroundColor: alpha(theme.colors.primary, '5'),
                border: `1px solid ${alpha(theme.colors.primary, '10')}`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = alpha(
                  theme.colors.primary,
                  '15'
                );
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = alpha(
                  theme.colors.primary,
                  '5'
                );
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <div className="flex-1 text-left">
                <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>
                  {item.label}
                </p>
                <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
                  {item.description}
                </p>
              </div>
              <span style={{ color: theme.colors.grayDark, fontSize: 14 }}>›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface BadgeProps {
  color: 'primary' | 'secondary' | 'success' | 'danger' | 'gray';
  size?: 'xs' | 'sm' | 'md';
  children: React.ReactNode;
}

function Badge({ color, size = 'sm', children }: BadgeProps) {
  const colors: Record<string, { bg: string; text: string }> = {
    primary: { bg: theme.colors.primary, text: theme.colors.white },
    secondary: { bg: theme.colors.secondary, text: theme.colors.white },
    success: { bg: theme.colors.success, text: theme.colors.white },
    danger: { bg: theme.colors.danger, text: theme.colors.white },
    gray: { bg: theme.colors.bgElevated, text: theme.colors.white },
  };

  const sizes: Record<string, string> = {
    xs: 'px-1.5 py-0.5 text-[8px]',
    sm: 'px-2 py-1 text-[10px]',
    md: 'px-3 py-1.5 text-xs',
  };

  const c = colors[color];
  return (
    <span
      className={`rounded-full font-semibold ${sizes[size]}`}
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {children}
    </span>
  );
}

interface BackButtonProps {
  label: string;
  onBack: () => void;
}

function BackButton({ label, onBack }: BackButtonProps) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1 px-3 py-2 rounded-lg cursor-pointer transition-colors"
        style={{
          backgroundColor: alpha(theme.colors.primary, '10'),
          border: `1px solid ${alpha(theme.colors.primary, '20')}`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = alpha(
            theme.colors.primary,
            '20'
          );
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = alpha(
            theme.colors.primary,
            '10'
          );
        }}
      >
        <span style={{ color: theme.colors.primary, fontSize: 14 }}>←</span>
        <span className="text-xs font-semibold" style={{ color: theme.colors.primary }}>
          Back
        </span>
      </button>
      <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>
        {label}
      </h2>
    </div>
  );
}
