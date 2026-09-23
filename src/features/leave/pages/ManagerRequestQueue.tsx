import { useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, Inbox } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { LeaveStatusBadge, LeaveTypeBadge, formatShortDate } from '@/features/leave/leaveMeta';
import { safeSort } from '@/utils/safeData';
import type { LeaveStatus } from '@/models/leave';
import RequestDetailModal from '@/features/leave/components/RequestDetailModal';

/**
 * Approval queue for managers and super admins. Managers see everyone's
 * requests except their own; super admins see all of them. Tapping a row opens
 * the request with its staffing impact and the approve / decline actions.
 */

type TabValue = LeaveStatus | 'all';

const TABS: { value: TabValue; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Declined' },
  { value: 'all', label: 'All' },
];

const EMPTY_COPY: Record<TabValue, { title: string; description: string }> = {
  pending: { title: 'You’re all caught up', description: 'New time-off requests from your team show up here.' },
  approved: { title: 'No approved requests', description: 'Requests you approve are listed here.' },
  rejected: { title: 'No declined requests', description: 'Requests you decline are listed here.' },
  cancelled: { title: 'No cancelled requests', description: 'Cancelled requests are listed here.' },
  all: { title: 'No requests yet', description: 'When your team asks for time off, the requests show up here.' },
};

interface ManagerRequestQueueProps {
  onBack?: () => void;
}

export default function ManagerRequestQueue({ onBack }: ManagerRequestQueueProps) {
  const { requests, loading, error } = useLeave();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabValue>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isAdmin = user?.role === 'super_admin';

  // Monthly auto-Sundays are never reviewed. Requests with a missing leaveType
  // are kept so they can still be dealt with. Managers don't review their own.
  const allRequests = useMemo(() => safeSort(
    requests.filter((r) => (!r.leaveType || r.leaveType !== 'auto_sunday') && (isAdmin || r.userId !== user?.id)),
    'createdAt',
    true,
  ), [requests, isAdmin, user?.id]);

  const counts = useMemo(() => {
    const c: Record<TabValue, number> = { pending: 0, approved: 0, rejected: 0, cancelled: 0, all: allRequests.length };
    for (const r of allRequests) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [allRequests]);

  const filtered = activeTab === 'all' ? allRequests : allRequests.filter((r) => r.status === activeTab);
  // Look the selection up live so the modal reflects updates from the listener.
  const selectedRequest = selectedId ? requests.find((r) => r.id === selectedId) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave requests"
        description={counts.pending > 0
          ? `${counts.pending} waiting for a decision`
          : 'Approve or decline time off for your team.'}
        onBack={onBack}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Requests aren’t updating</AlertTitle>
          <AlertDescription>Check your connection and refresh the page. ({error})</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="h-9! w-full sm:w-fit">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1">
              {tab.label}
              <span className="text-xs text-muted-foreground tabular-nums">{counts[tab.value]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading && allRequests.length === 0 ? (
        <LoadingState label="Loading requests…" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Inbox} title={EMPTY_COPY[activeTab].title} description={EMPTY_COPY[activeTab].description} />
      ) : (
        <ItemGroup className="gap-2">
          {filtered.map((req) => (
            <div key={req.id} role="listitem">
              <Item variant="outline" asChild className="bg-card hover:bg-accent/60">
                <button
                  type="button"
                  onClick={() => setSelectedId(req.id)}
                  className="min-h-14 text-left"
                >
                  <ItemMedia>
                    <UserAvatar name={req.userRef.displayName} />
                  </ItemMedia>
                  <ItemContent className="min-w-0 gap-1.5">
                    <ItemTitle className="w-full truncate">{req.userRef.displayName}</ItemTitle>
                    <ItemDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-foreground/80 tabular-nums">{formatShortDate(req.date)}</span>
                      <LeaveTypeBadge type={req.leaveType} />
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <LeaveStatusBadge status={req.status} />
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </ItemActions>
                </button>
              </Item>
            </div>
          ))}
        </ItemGroup>
      )}

      <RequestDetailModal
        request={selectedRequest}
        open={!!selectedRequest}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
