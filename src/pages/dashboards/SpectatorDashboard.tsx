import { useState } from 'react';
import { Card, Icons } from '../../components/ui';
import { theme } from '../../config/theme';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import AttendanceSummary from '../../components/AttendanceSummary';
import CheckInBoard from '../../components/CheckInBoard';
import ShiftStatusBoard from '../../components/ShiftStatusBoard';
import StaffPage from '../StaffPage';

type View = 'dashboard' | 'attendance' | 'checkins' | 'shiftStatus' | 'allowances';

export default function SpectatorDashboard() {
  const { user } = useAuth();
  const { users } = useAppData();
  const [view, setView] = useState<View>('dashboard');

  if (view === 'checkins')
    return <CheckInBoard onBack={() => setView('dashboard')} currentUserRole={user?.role ?? 'spectator'} />;
  if (view === 'shiftStatus')
    return <ShiftStatusBoard onBack={() => setView('dashboard')} />;
  if (view === 'allowances')
    return (
      <div className="space-y-3">
        <button onClick={() => setView('dashboard')} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
        <StaffPage />
      </div>
    );
  if (view === 'attendance')
    return (
      <div className="space-y-3">
        <button onClick={() => setView('dashboard')} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>&larr; Back</button>
        <AttendanceSummary
          currentUserId={user?.id ?? ''}
          currentUserRole={user?.role ?? 'spectator'}
          currentUserJobRoles={user?.jobRole ?? []}
        />
      </div>
    );

  const tiles: { id: View; label: string; sub: string; icon: React.ReactNode }[] = [
    { id: 'checkins', label: 'Check-In Board', sub: 'Live check-in / out status', icon: Icons.users },
    { id: 'shiftStatus', label: 'Shift Status', sub: 'Who responded to shifts', icon: Icons.calendar },
    { id: 'attendance', label: 'Attendance', sub: 'Hours & attendance summary', icon: Icons.calendar },
    { id: 'allowances', label: 'Leave Allowances', sub: 'Days off & vacation per person (view-only)', icon: Icons.settings },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-base font-bold" style={{ color: theme.colors.white }}>
          Welcome, {user?.displayName}
        </p>
        <p className="text-xs mt-0.5" style={{ color: theme.colors.grayDark }}>
          Spectator &middot; view-only &middot; {users.length} users
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className="text-left rounded-xl p-4 cursor-pointer transition-all"
            style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}
          >
            <span style={{ color: theme.colors.primary }}>{t.icon}</span>
            <p className="text-sm font-semibold mt-2" style={{ color: theme.colors.white }}>{t.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>{t.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
