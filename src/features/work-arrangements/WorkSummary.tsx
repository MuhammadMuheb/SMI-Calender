import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/AuthContext';
import { useWorkArrangements } from './WorkArrangementsContext';
import { WorkModeBadge } from './WorkModeBadge';
import { addDays, localParts } from '../../../shared/work-arrangements.mjs';
export function WorkSummary({ onOpen, date }: { onOpen?: () => void; date?: string }) {
  const { user } = useAuth();
  const { slotsFor, policy, arrangements, loading, error } = useWorkArrangements();
  if (!user || user.role === 'spectator') return null;
  const today = date || localParts(new Date(), policy.timezone).date;
  const dates = date ? [date] : [today, addDays(today, 1)];
  const pending = arrangements.filter(a => a.status === 'pending' && (a.userId === user.id || user.role !== 'staff')).length;
  return <Card className="mb-4"><CardHeader><CardTitle>Work arrangements</CardTitle></CardHeader><CardContent className="space-y-3">
    {loading ? <p role="status">Loading your schedule…</p> : error ? <p role="alert" className="text-destructive">{error}</p> : dates.map(day => {
      const slots = slotsFor(user.id, day);
      return <div key={day} className="flex flex-wrap items-center gap-2 text-sm"><span className="min-w-24 font-medium">{day === today && !date ? 'Today' : day}</span>
        {slots[0].mode === slots[1].mode ? <WorkModeBadge mode={slots[0].mode} /> : slots.map(s => <span key={s.portion} className="flex items-center gap-1">{s.portion.toUpperCase()} <WorkModeBadge mode={s.mode} /></span>)}
        <span className="text-muted-foreground">{slots[0].mode === 'off' ? slots[0].reason : `${slots[0].shiftStart}–${slots[1].shiftEnd} · ${slots[0].timezone}`}</span>
      </div>;
    })}
    {pending > 0 && <p className="text-sm">{pending} pending {pending === 1 ? 'request' : 'requests'}</p>}
    {onOpen && <Button variant="outline" onClick={onOpen}>Manage arrangements</Button>}
  </CardContent></Card>;
}
