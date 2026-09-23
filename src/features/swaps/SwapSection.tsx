import { toast } from 'sonner';
import { ArrowLeftRight } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { useAuth } from '@/features/auth/AuthContext';
import { useSwap } from '@/features/swaps/SwapContext';
import { safeSort } from '@/utils/safeData';
import { cn } from '@/lib/utils';

/**
 * Shows incoming swap proposals for the current user.
 * Accept = instant swap. Decline = cancelled.
 */

function formatSwapDate(date: string, withWeekday = false) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    ...(withWeekday ? { weekday: 'short' } : {}),
    month: 'short',
    day: 'numeric',
  });
}

const STATUS_META = {
  accepted: { label: 'Swapped', className: 'border-success/30 text-success' },
  declined: { label: 'Declined', className: 'border-destructive/30 text-destructive' },
  pending: { label: 'Pending', className: 'border-warning/30 text-warning' },
} as const;

export default function SwapSection() {
  const { user } = useAuth();
  const { getPendingSwapsForUser, acceptSwap, declineSwap, getSwapsForUser } = useSwap();

  if (!user) return null;

  const pendingIncoming = getPendingSwapsForUser(user.id);
  const allMySwaps = safeSort(
    getSwapsForUser(user.id)
      .filter((s) => s.status !== 'pending' || s.proposerId === user.id),
    'createdAt',
    true
  ).slice(0, 3);

  if (pendingIncoming.length === 0 && allMySwaps.length === 0) return null;

  // Incoming swap proposals
  if (pendingIncoming.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Swap requests</CardTitle>
          <CardDescription>Colleagues who want to swap their day off with you.</CardDescription>
          <CardAction>
            <Badge variant="outline" className="border-warning/30 text-warning tabular-nums">
              {pendingIncoming.length}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ItemGroup className="gap-2">
            {pendingIncoming.map((swap) => (
              <Item key={swap.id} variant="outline">
                <ItemMedia variant="icon" className="size-8 rounded-full bg-muted">
                  <ArrowLeftRight className="text-muted-foreground" />
                </ItemMedia>
                <ItemContent className="min-w-40">
                  <ItemTitle className="line-clamp-2">
                    {swap.proposerName} wants to swap days off
                  </ItemTitle>
                  <ItemDescription>
                    You would get {formatSwapDate(swap.date, true)} off.
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="flex-1 sm:flex-none"
                    onClick={() => { acceptSwap(swap.id); toast.success('Swap accepted'); }}
                  >
                    Accept
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    onClick={() => { declineSwap(swap.id); toast.success('Swap declined'); }}
                  >
                    Decline
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>
    );
  }

  // Recent swap activity
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent swaps</CardTitle>
      </CardHeader>
      <CardContent>
        <ItemGroup className="gap-1">
          {allMySwaps.map((swap) => {
            const isProposer = swap.proposerId === user.id;
            const otherName = isProposer ? swap.receiverName : swap.proposerName;
            const meta = STATUS_META[swap.status as keyof typeof STATUS_META] ?? STATUS_META.pending;
            return (
              <Item key={swap.id} size="sm" className="px-0">
                <ItemMedia variant="icon" className="size-8 rounded-full bg-muted">
                  <ArrowLeftRight className="text-muted-foreground" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Swap with {otherName}</ItemTitle>
                  <ItemDescription>{formatSwapDate(swap.date)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="outline" className={cn(meta.className)}>{meta.label}</Badge>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
