import { Check, Coffee, Hourglass, Trophy, X } from 'lucide-react';
import { useNotifications } from '@/features/notifications/NotificationContext';
import { useAppData } from '@/app/AppDataContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Props { onBack: () => void }

interface CoffeeStats {
  userId: string;
  name: string;
  offered: number;
  accepted: number;
  received: number;
  receivedAccepted: number;
}

/** Podium styling for the top three; everyone else gets a plain rank number. */
const PODIUM = [
  'bg-warning/15 text-warning',
  'bg-muted text-foreground',
  'bg-muted text-foreground',
];

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CoffeeLeaderboard({ onBack }: Props) {
  const { notifications } = useNotifications();
  const { users } = useAppData();

  // Compute stats from notifications
  const stats: CoffeeStats[] = users.filter((u) => u.isActive).map((u) => {
    // Coffees this user OFFERED (they created coffee_offer notifications for others)
    const offered = notifications.filter(
      (n) => n.type === 'coffee_offer' && n.entityId === u.id,
    ).length;

    // Of those, how many were accepted
    const accepted = notifications.filter(
      (n) => n.type === 'coffee_offer' && n.entityId === u.id && n.confirmStatus === 'confirmed',
    ).length;

    // Coffees this user RECEIVED
    const received = notifications.filter(
      (n) => n.type === 'coffee_offer' && n.userId === u.id,
    ).length;

    // Of those, how many they accepted
    const receivedAccepted = notifications.filter(
      (n) => n.type === 'coffee_offer' && n.userId === u.id && n.confirmStatus === 'confirmed',
    ).length;

    return { userId: u.id, name: u.displayName, offered, accepted, received, receivedAccepted };
  });

  // Sort by total coffees shared (offered+accepted + received+accepted)
  const sorted = [...stats]
    .filter((s) => s.offered > 0 || s.received > 0)
    .sort((a, b) => (b.accepted + b.receivedAccepted) - (a.accepted + a.receivedAccepted));

  const topShared = sorted.length > 0 ? sorted[0].accepted + sorted[0].receivedAccepted : 0;

  const totalCoffees = notifications.filter(
    (n) => n.type === 'coffee_offer' && n.confirmStatus === 'confirmed',
  ).length;

  const totalOffered = notifications.filter((n) => n.type === 'coffee_offer').length;
  const totalPending = notifications.filter(
    (n) => n.type === 'coffee_offer' && n.confirmStatus === 'pending',
  ).length;

  const recent = notifications
    .filter((n) => n.type === 'coffee_offer' || n.type === 'coffee_response')
    .slice(0, 15);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coffee leaderboard"
        description="Team coffee stats. Who’s buying the most rounds?"
        onBack={onBack}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Offered" value={totalOffered} icon={Coffee} tone="warning" />
        <StatCard label="Accepted" value={totalCoffees} icon={Check} tone="primary" />
        <StatCard label="Pending" value={totalPending} icon={Hourglass} />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Coffee}
          title="No coffees yet"
          description="The team needs to warm up. Offers show up here as soon as someone buys a round."
        />
      ) : (
        <Card className="gap-0 pb-0">
          <CardHeader className="border-b">
            <CardTitle>Rankings</CardTitle>
            <CardDescription>Ranked by coffees shared: offers accepted plus offers they accepted.</CardDescription>
          </CardHeader>
          <ol className="divide-y">
            {sorted.map((s, i) => {
              const shared = s.accepted + s.receivedAccepted;
              return (
                <li key={s.userId} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                      i < 3 ? PODIUM[i] : 'text-muted-foreground',
                    )}
                    aria-label={`Rank ${i + 1}`}
                  >
                    {i === 0 ? <Trophy className="size-4" aria-hidden="true" /> : i + 1}
                  </div>
                  <UserAvatar name={s.name} className="hidden sm:flex" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums">
                        <Coffee className="size-3.5 text-warning" aria-hidden="true" />
                        {shared}
                        <span className="font-normal text-muted-foreground">shared</span>
                      </p>
                    </div>
                    <Progress value={topShared > 0 ? (shared / topShared) * 100 : 0} aria-label={`${shared} coffees shared`} />
                    <p className="text-xs text-muted-foreground">
                      Gave {s.offered} ({s.accepted} accepted) · Got {s.received} ({s.receivedAccepted} accepted)
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {recent.length > 0 && (
        <Card className="gap-0 pb-0">
          <CardHeader className="border-b">
            <CardTitle>Recent coffee activity</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {recent.map((n) => {
                const Icon = n.type === 'coffee_offer' ? Coffee : n.confirmStatus === 'confirmed' ? Check : X;
                return (
                  <li key={n.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{n.title}</p>
                      {n.createdAt && <p className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>}
                    </div>
                    {n.confirmStatus === 'confirmed' && (
                      <Badge variant="secondary" className="border-transparent bg-success/12 text-success">Accepted</Badge>
                    )}
                    {n.confirmStatus === 'rejected' && (
                      <Badge variant="secondary" className="border-transparent bg-muted text-muted-foreground">Passed</Badge>
                    )}
                    {n.confirmStatus === 'pending' && (
                      <Badge variant="secondary" className="border-transparent bg-warning/12 text-warning">Waiting</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
