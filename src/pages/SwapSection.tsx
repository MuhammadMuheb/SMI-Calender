import { Card, Badge, Button } from '../components/ui';
import { theme } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { useSwap } from '../context/SwapContext';

/**
 * Shows incoming swap proposals for the current user.
 * Accept = instant swap. Decline = cancelled.
 */

export default function SwapSection() {
  const { user } = useAuth();
  const { getPendingSwapsForUser, acceptSwap, declineSwap, getSwapsForUser } = useSwap();

  if (!user) return null;

  const pendingIncoming = getPendingSwapsForUser(user.id);
  const allMySwaps = getSwapsForUser(user.id)
    .filter((s) => s.status !== 'pending' || s.proposerId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  if (pendingIncoming.length === 0 && allMySwaps.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Incoming swap proposals */}
      {pendingIncoming.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold" style={{ color: theme.colors.white }}>Swap Requests</h3>
            <Badge color="warning" size="xs">{pendingIncoming.length}</Badge>
          </div>
          {pendingIncoming.map((swap) => (
            <Card key={swap.id}>
              <p className="text-xs font-medium mb-1" style={{ color: theme.colors.white }}>
                {swap.proposerName} wants to swap their day off with you
              </p>
              <p className="text-[10px] mb-2" style={{ color: theme.colors.grayDark }}>
                Date: {new Date(swap.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
                — You would get this day off
              </p>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={() => acceptSwap(swap.id)}>Accept</Button>
                <Button variant="outline" size="sm" onClick={() => declineSwap(swap.id)}>Decline</Button>
              </div>
            </Card>
          ))}
        </>
      )}

      {/* Recent swap activity */}
      {allMySwaps.length > 0 && pendingIncoming.length === 0 && (
        <>
          <h3 className="text-xs font-semibold" style={{ color: theme.colors.white }}>Recent Swaps</h3>
          {allMySwaps.map((swap) => {
            const isProposer = swap.proposerId === user.id;
            const otherName = isProposer ? swap.receiverName : swap.proposerName;
            return (
              <Card key={swap.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs" style={{ color: theme.colors.white }}>
                      Swap with {otherName}
                    </p>
                    <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
                      {new Date(swap.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <Badge
                    color={swap.status === 'accepted' ? 'success' : swap.status === 'declined' ? 'danger' : 'warning'}
                    size="xs"
                  >
                    {swap.status === 'accepted' ? 'Swapped' : swap.status === 'declined' ? 'Declined' : 'Pending'}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
