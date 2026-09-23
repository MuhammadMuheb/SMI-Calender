import { TranslatedText } from '@/i18n/LanguageContext';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, BarChart3, ChevronRight, ClipboardCheck, MapPin, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { useAppData } from '@/app/AppDataContext';
import { useAuth } from '@/features/auth/AuthContext';
import AttendanceSummary from '@/features/attendance/components/AttendanceSummary';
import CheckInBoard from '@/features/attendance/components/CheckInBoard';
import ShiftStatusBoard from '@/features/attendance/components/ShiftStatusBoard';
import StaffPage from '@/features/staff/StaffPage';

type View = 'dashboard' | 'attendance' | 'checkins' | 'shiftStatus' | 'allowances';

export default function SpectatorDashboard() {
  const { user } = useAuth();
  const { users } = useAppData();
  const [view, setView] = useState<View>('dashboard');
  const back = () => setView('dashboard');

  if (view === 'checkins')
    return <CheckInBoard onBack={back} currentUserRole={user?.role ?? 'spectator'} />;
  if (view === 'shiftStatus')
    return <ShiftStatusBoard onBack={back} />;
  if (view === 'allowances')
    return <StaffPage onBack={back} />;
  if (view === 'attendance')
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={back}>
          <ArrowLeft /><TranslatedText text="Back" /></Button>
        <AttendanceSummary
          currentUserId={user?.id ?? ''}
          currentUserRole={user?.role ?? 'spectator'}
          currentUserJobRoles={user?.jobRole ?? []}
        />
      </div>
    );

  const tiles: { id: View; label: string; sub: string; icon: LucideIcon }[] = [
    { id: 'checkins', label: 'Check-in board', sub: 'Who is checked in or out right now', icon: MapPin },
    { id: 'shiftStatus', label: 'Shift responses', sub: 'Who confirmed their shift', icon: ClipboardCheck },
    { id: 'attendance', label: 'Attendance', sub: 'Hours and attendance summary', icon: BarChart3 },
    { id: 'allowances', label: 'Leave allowances', sub: 'Days off and vacation per person', icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        You have view-only access to {users.length} {users.length === 1 ? 'person' : 'people'}.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <Item key={t.id} asChild variant="outline" className="bg-card hover:bg-accent/60">
            <button type="button" onClick={() => setView(t.id)} className="text-left">
              <ItemMedia variant="icon" className="size-9 rounded-lg bg-muted text-muted-foreground">
                <t.icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{t.label}</ItemTitle>
                <ItemDescription>{t.sub}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </ItemActions>
            </button>
          </Item>
        ))}
      </div>
    </div>
  );
}
