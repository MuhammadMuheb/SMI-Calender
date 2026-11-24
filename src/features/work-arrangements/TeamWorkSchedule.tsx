import { useAppData } from '@/app/AppDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkArrangements } from './WorkArrangementsContext';
import { WorkModeBadge } from './WorkModeBadge';
export function TeamWorkSchedule({ date, employee = 'all', department = 'all', mode = 'all' }: { date: string; employee?: string; department?: string; mode?: string }) {
  const { users } = useAppData();
  const { slotsFor, departments, error, loading } = useWorkArrangements();
  const people = users.filter(u => u.role !== 'spectator' && (employee === 'all' || employee === u.id) && (department === 'all' || departments[u.id] === department)).map(u => ({ user: u, slots: slotsFor(u.id, date) })).filter(({ slots }) => mode === 'all' || slots.some(s => s.mode === mode || mode === 'hybrid' && s.hybrid));
  return <Card><CardHeader><CardTitle>Team work modes · {date}</CardTitle></CardHeader><CardContent className="space-y-3">
    {error ? <p role="alert" className="text-destructive">{error}</p> : loading ? <p role="status">Loading schedule…</p> : !people.length ? <p className="text-sm text-muted-foreground">No employees match these filters.</p> : people.map(({ user, slots }) => <div key={user.id} className="space-y-1.5 border-b pb-3 last:border-0">
      <p className="break-words text-sm font-medium">{user.displayName}<span className="ml-2 font-normal text-muted-foreground">{departments[user.id]}</span></p>
      <div className="flex flex-wrap gap-2">{slots[0].mode === slots[1].mode ? <WorkModeBadge mode={slots[0].mode} /> : slots.map(s => <span key={s.portion} className="flex items-center gap-1 text-xs">{s.portion.toUpperCase()} <WorkModeBadge mode={s.mode} /></span>)}{slots.some(s => s.hybrid) && <WorkModeBadge mode="hybrid" />}</div>
      <p className="text-xs text-muted-foreground">{slots[0].mode === 'off' ? slots[0].reason : `${slots[0].shiftStart}–${slots[1].shiftEnd} · ${slots[0].timezone}`}</p>
    </div>)}
  </CardContent></Card>;
}
