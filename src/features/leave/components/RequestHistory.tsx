import { TranslatedText } from '@/i18n/LanguageContext';
import { useMemo, useState } from 'react';
import { CalendarClock, Inbox, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuth } from '@/features/auth/AuthContext';
import { useLeave } from '@/features/leave/LeaveContext';
import BalanceRing from '@/features/leave/components/BalanceRing';
import MoveDayOffModal from '@/features/leave/components/MoveDayOffModal';
import RequestFormModal from '@/features/leave/components/RequestFormModal';
import { LeaveStatusBadge, LeaveTypeBadge, formatShortDate } from '@/features/leave/leaveMeta';
import { displayStaffNote } from '@/features/leave/requestNotes';
import { safeSort } from '@/utils/safeData';
import type { LeaveStatus, LeaveRequest } from '@/models/leave';

type StatusTab = LeaveStatus | 'all';

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Declined' },
];

const EMPTY_COPY: Record<StatusTab, string> = {
  pending: 'No requests waiting for a decision.',
  all: 'You haven’t asked for time off yet.',
  approved: 'No approved requests yet.',
  rejected: 'None of your requests were declined.',
  cancelled: 'No cancelled requests.',
};

interface RequestHistoryProps { onBack: () => void; }

export default function RequestHistory({ onBack }: RequestHistoryProps) {
  const { user } = useAuth();
  const { getUserRequests, cancelRequest, getBalance } = useLeave();
  const [view, setView] = useState<'requests' | 'balance'>('requests');
  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [moveRequest, setMoveRequest] = useState<LeaveRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const userId = user?.id ?? '';
  const allRequests = useMemo(() => safeSort(
    getUserRequests(userId).filter((r) => r.leaveType !== 'auto_sunday'),
    'createdAt',
    true,
  ), [getUserRequests, userId]);

  if (!user) return null;

  const countFor = (tab: StatusTab) => (tab === 'all' ? allRequests.length : allRequests.filter((r) => r.status === tab).length);
  const filtered = activeTab === 'all' ? allRequests : allRequests.filter((r) => r.status === activeTab);
  const balance = getBalance(user.id);

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const err = await cancelRequest(cancelTarget.id);
    setCancelling(false);
    if (err) { toast.error(err); return; }
    toast.success('Request cancelled');
    setCancelTarget(null);
  };

  const requestButton = (
    <Button size="lg" onClick={() => setShowRequestForm(true)}>
      <Plus data-icon="inline-start" /><TranslatedText text="Request time off" /></Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My time off"
        description="Your requests and what you have left."
        onBack={onBack}
        actions={requestButton}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as 'requests' | 'balance')} className="gap-4">
        <TabsList className="h-9! w-full sm:w-fit">
          <TabsTrigger value="requests"><TranslatedText text="Requests" /></TabsTrigger>
          <TabsTrigger value="balance">Balance</TabsTrigger>
        </TabsList>

        <TabsContent value="balance">
          <Card>
            <CardHeader>
              <CardTitle>Leave balance</CardTitle>
              <CardDescription>Regular days reset each cycle. Vacation accrues and rolls over.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <BalanceRing
                label="Regular days off"
                sublabel="days"
                remaining={balance.regularDaysRemaining}
                total={balance.regularDaysAllowed}
                tone="day-off"
                hint={`${balance.regularDaysUsed} used this cycle`}
              />
              <BalanceRing
                label="Paid vacation"
                sublabel="days"
                remaining={balance.vacationDaysRemaining}
                total={balance.vacationDaysTotal}
                tone="vacation"
                hint={`${balance.vacationDaysUsed} used`}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTab)}>
            <TabsList variant="line" className="w-full justify-start overflow-x-auto sm:w-fit">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="flex-none gap-1">
                  {tab.label}
                  <span className="text-xs text-muted-foreground tabular-nums">{countFor(tab.value)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {filtered.length === 0 ? (
            <EmptyState
              icon={activeTab === 'pending' ? CalendarClock : Inbox}
              title={activeTab === 'all' ? 'No requests yet' : 'Nothing here'}
              description={EMPTY_COPY[activeTab]}
              action={activeTab === 'all' ? requestButton : undefined}
            />
          ) : (
            <ItemGroup className="gap-2">
              {filtered.map((req) => {
                const note = displayStaffNote(req.staffNote);
                const canMove = req.status === 'approved' && !req.staffNote?.includes('Fixed schedule');
                return (
                  <Item key={req.id} role="listitem" variant="outline" className="items-start bg-card">
                    <ItemContent className="min-w-0 gap-1.5">
                      <ItemTitle className="w-full">
                        {formatShortDate(req.date)}
                        <span className="font-normal text-muted-foreground tabular-nums">{req.date.slice(0, 4)}</span>
                      </ItemTitle>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <LeaveTypeBadge type={req.leaveType} />
                        <LeaveStatusBadge status={req.status} />
                        {req.isOverridden && <Badge variant="outline">Overridden</Badge>}
                      </div>
                      {note && <ItemDescription>“{note}”</ItemDescription>}
                      {req.approverNote && (
                        <ItemDescription>Manager: {req.approverNote}</ItemDescription>
                      )}
                    </ItemContent>
                    {(req.status === 'pending' || canMove) && (
                      <ItemActions>
                        {req.status === 'pending' && (
                          <Button variant="outline" onClick={() => setCancelTarget(req)}><TranslatedText text="Cancel" /></Button>
                        )}
                        {canMove && (
                          <Button variant="outline" onClick={() => setMoveRequest(req)}>Move</Button>
                        )}
                      </ItemActions>
                    )}
                  </Item>
                );
              })}
            </ItemGroup>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o && !cancelling) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget
                ? `Your request for ${formatShortDate(cancelTarget.date)} is withdrawn. You can send a new one any time.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep request</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelling}
              onClick={(e) => { e.preventDefault(); void confirmCancel(); }}
            >
              {cancelling && <Spinner />}
              Cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MoveDayOffModal request={moveRequest} open={!!moveRequest} onClose={() => setMoveRequest(null)} />
      <RequestFormModal open={showRequestForm} onClose={() => setShowRequestForm(false)} />
    </div>
  );
}
