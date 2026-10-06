import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCheck, ChevronRight, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppData } from '@/app/AppDataContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { LeaveStatusBadge, LeaveTypeBadge, formatShortDate } from '@/features/leave/leaveMeta';
import { safeSort } from '@/utils/safeData';
import type { LeaveStatus } from '@/models/leave';
import RequestDetailModal from '@/features/leave/components/RequestDetailModal';
import { requestStaffingImpact } from '@/features/leave/services/requestStaffingImpact';
import { serverApi } from '@/lib/serverApi';

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
  const { requests, loading, error, approve } = useLeave();
  const { user } = useAuth();
  const { users, staffingRules, roleAssignments, jobRoles, loading: staffingLoading } = useAppData();
  const [activeTab, setActiveTab] = useState<TabValue>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState<boolean | null>(null);
  const [settingError, setSettingError] = useState(false);
  const [savingSetting, setSavingSetting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const busy = useRef(false);

  const isAdmin = user?.role === 'super_admin';

  useEffect(() => {
    let active = true;
    const refresh = () => {
      serverApi<{ autoApprove: boolean }>('leave', { action: 'get-settings' }).then((settings) => {
        if (active) { setAutoApprove(settings.autoApprove); setSettingError(false); }
      }).catch(() => { if (active) setSettingError(true); });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); };
  }, []);

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

  const impacts = useMemo(() => {
    const roleNames = Object.fromEntries(jobRoles.map((r) => [r.id, r.name]));
    return new Map(allRequests.filter((r) => r.status === 'pending').map((r) => [
      r.id, requestStaffingImpact(r, requests, staffingRules, roleAssignments, roleNames).level,
    ]));
  }, [allRequests, requests, staffingRules, roleAssignments, jobRoles]);
  const greenRequests = allRequests.filter((r) => r.status === 'pending' && impacts.get(r.id) === 'safe'
    && users.some((u) => u.id === r.userId && u.isActive)
    && (isAdmin || (user?.role === 'manager' && r.userId !== user.id && r.userRef.role === 'staff')));

  const changeAutoApprove = async (enabled: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setSavingSetting(true);
    try {
      const settings = await serverApi<{ autoApprove: boolean }>('leave', { action: 'set-settings', data: { autoApprove: enabled } });
      setAutoApprove(settings.autoApprove);
      setSettingError(false);
      toast.success(enabled ? 'Auto Approve enabled for new green requests' : 'Auto Approve disabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save Auto Approve');
    } finally { busy.current = false; setSavingSetting(false); }
  };

  const approveAll = async () => {
    if (!user || busy.current || greenRequests.length === 0) return;
    busy.current = true;
    // Oldest first. Each server transaction rechecks coverage after prior approvals.
    const candidates = [...greenRequests].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    setProgress({ done: 0, total: candidates.length });
    let approved = 0;
    let lastReason = '';
    try {
      for (const [index, request] of candidates.entries()) {
        const err = await approve(request.id, { id: user.id, displayName: user.displayName, role: user.role }, '', true);
        if (err) lastReason = err;
        else approved++;
        setProgress({ done: index + 1, total: candidates.length });
      }
      const remaining = candidates.length - approved;
      const message = `${approved} ${approved === 1 ? 'request' : 'requests'} approved`;
      if (remaining > 0) toast.warning(`${message}. ${remaining} not approved: ${lastReason}`);
      else toast.success(message);
    } catch (err) {
      toast.error(`${approved} approved before processing stopped. ${err instanceof Error ? err.message : 'Please refresh and try again.'}`);
    } finally { busy.current = false; setProgress(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave requests"
        description={counts.pending > 0
          ? `${counts.pending} waiting for a decision`
          : 'Approve or decline time off for your team.'}
        onBack={onBack}
        actions={
          <Button onClick={() => void approveAll()} disabled={loading || staffingLoading || !!error || savingSetting || !!progress || greenRequests.length === 0}>
            {progress ? <Spinner /> : <CheckCheck />}
            {progress ? `Approving ${progress.done}/${progress.total}` : `Approve all${!loading && !staffingLoading ? ` (${greenRequests.length})` : ''}`}
          </Button>
        }
      />

      <div className="flex items-start justify-between gap-4 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <label htmlFor="auto-approve" className="text-sm font-medium">Auto Approve</label>
          <p id="auto-approve-description" className="text-sm text-muted-foreground">
            Automatically approve new green requests when staffing stays at or above minimum. Use Approve all for pending green requests.
          </p>
          {!isAdmin && <p className="text-xs text-muted-foreground">A super admin can change this setting.</p>}
          {settingError && <p role="alert" className="text-xs text-destructive">Could not load Auto Approve. Refresh the page to retry.</p>}
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          {savingSetting || (autoApprove === null && !settingError) ? <Spinner /> : null}
          <Switch id="auto-approve" aria-describedby="auto-approve-description" checked={autoApprove === true}
            disabled={!isAdmin || autoApprove === null || settingError || savingSetting || !!progress}
            onCheckedChange={(enabled) => void changeAutoApprove(enabled)} />
        </div>
      </div>

      {progress && <p role="status" className="text-sm text-muted-foreground">Checking staffing and approving requests: {progress.done} of {progress.total}.</p>}

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
                  disabled={!!progress}
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
                      {req.status === 'pending' && !loading && !staffingLoading && !error && (
                        <Badge variant="secondary" className={impacts.get(req.id) === 'safe'
                          ? 'bg-success/12 text-success' : impacts.get(req.id) === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-warning/12 text-warning'}>
                          {impacts.get(req.id) === 'safe' ? 'Enough cover' : impacts.get(req.id) === 'danger' ? 'Below minimum' : 'Needs review'}
                        </Badge>
                      )}
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
