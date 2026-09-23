import { TranslatedText } from '@/i18n/LanguageContext';
import { useState } from 'react';
import { useLeave } from '@/features/leave/LeaveContext';
import { useAppData } from '@/app/AppDataContext';
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
  const { requests } = useLeave();
  const { users, roleAssignments } = useAppData();
  const [leaveId, setLeaveId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const { proposeSwap } = useSwap();
  const { getPendingSwapsForUser, acceptSwap, declineSwap, getSwapsForUser } = useSwap();

  if (!user) return null;

  const pendingIncoming = getPendingSwapsForUser(user.id);
  const allMySwaps = safeSort(
    getSwapsForUser(user.id)
      .filter((s) => s.status !== 'pending' || s.proposerId === user.id),
    'createdAt',
    true
  ).slice(0, 3);

  const eligible = users.filter(u => u.id !== user.id && roleAssignments.some(a => a.userId === user.id && roleAssignments.some(b => b.userId === u.id && a.jobRoleId === b.jobRoleId)));
  const proposer = <Card className="mb-4"><CardHeader><CardTitle><TranslatedText text="Propose a day swap" /></CardTitle><CardDescription>Give a colleague your day off and work that day instead.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">
    <select aria-label="Day off to transfer" className="rounded border p-2" value={leaveId} onChange={e => setLeaveId(e.target.value)}><option value="">Choose your day off</option>{requests.filter(r => r.userId === user.id && r.status === 'approved' && r.leaveType === 'regular_day_off').map(r => <option key={r.id} value={r.id}>{r.date}</option>)}</select>
    <select aria-label="Colleague" className="rounded border p-2" value={receiverId} onChange={e => setReceiverId(e.target.value)}><option value="">Choose colleague</option>{eligible.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select>
    <Button disabled={!leaveId || !receiverId} onClick={async () => { const error = await proposeSwap(user.id, user.displayName, receiverId, '', '', leaveId, ''); if (error) toast.error(error); else { toast.success('Swap proposed'); setLeaveId(''); } }}><TranslatedText text="Propose swap" /></Button>
  </CardContent></Card>;
  if (pendingIncoming.length === 0 && allMySwaps.length === 0) return proposer;

  // Incoming swap proposals
  if (pendingIncoming.length > 0) {
    return (
      <>{proposer}<Card>
        <CardHeader>
          <CardTitle><TranslatedText text="Swap requests" /></CardTitle>
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
                    onClick={async () => { try { await acceptSwap(swap.id); toast.success('Swap accepted'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to accept'); } }}
                  ><TranslatedText text="Accept" /></Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    onClick={async () => { try { await declineSwap(swap.id); toast.success('Swap declined'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to decline'); } }}
                  ><TranslatedText text="Decline" /></Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </CardContent>
      </Card></>
    );
  }

  // Recent swap activity
  return (
    <>{proposer}<Card>
      <CardHeader>
        <CardTitle><TranslatedText text="Recent swaps" /></CardTitle>
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
    </Card></>
  );
}
