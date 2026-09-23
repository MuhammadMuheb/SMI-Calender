import { useEffect, useMemo, useState } from 'react';
import { ScrollText, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchAuditLog } from '@/features/auth/authService';
import type { AuditAction, AuditEntity } from '@/models/audit';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Props { onBack?: () => void }

/** Shape of an entry as read from Firestore (older in-memory entries used `timestamp`). */
interface AuditRow {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  createdAt?: string;
  timestamp?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

type Tone = 'success' | 'destructive' | 'warning' | 'primary' | 'neutral';

const ACTION_TONES: Partial<Record<AuditAction, Tone>> = {
  user_created: 'success', user_deleted: 'destructive', leave_requested: 'primary',
  leave_approved: 'success', leave_rejected: 'destructive', leave_overridden: 'warning',
  balance_adjusted: 'warning', auto_assignment_run: 'primary',
  staffing_rule_created: 'primary', staffing_rule_deleted: 'destructive',
  special_day_created: 'primary', special_day_deleted: 'destructive',
  notification_setting_changed: 'neutral',
};

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success/12 text-success',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/12 text-warning',
  primary: 'bg-primary/10 text-primary',
  neutral: 'bg-muted text-muted-foreground',
};

const ACTION_OPTIONS: AuditAction[] = [
  'user_created', 'user_updated', 'user_deleted',
  'leave_requested', 'leave_approved', 'leave_rejected', 'leave_overridden',
  'balance_adjusted', 'auto_assignment_run',
  'staffing_rule_created', 'staffing_rule_updated', 'staffing_rule_deleted',
  'special_day_created', 'special_day_deleted', 'notification_setting_changed',
];

const ENTITY_OPTIONS: AuditEntity[] = [
  'user', 'leave_request', 'balance', 'staffing_rule',
  'special_day', 'holiday', 'auto_assignment', 'notification_setting',
];

const ALL = '__all__';

/** "leave_approved" -> "Leave approved" */
function humanize(value: string): string {
  const s = value.replace(/_/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : 'Unknown';
}

function entryTime(e: AuditRow): string | undefined {
  return e.createdAt ?? e.timestamp;
}

function absoluteTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function relativeTime(iso: string | undefined): string {
  if (!iso) return 'Unknown time';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown time';
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return 'Just now';
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), 'day');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ActionBadge({ action }: { action: string }) {
  const tone = ACTION_TONES[action as AuditAction] ?? 'neutral';
  return (
    <Badge variant="secondary" className={cn('border-transparent', TONE_CLASS[tone])}>
      {humanize(action)}
    </Badge>
  );
}

function ChangeValues({ entry }: { entry: AuditRow }) {
  if (!entry.oldValue && !entry.newValue) return null;
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {entry.oldValue && (
        <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs">
          <p className="font-medium text-destructive">Before</p>
          <p className="break-all text-muted-foreground">{entry.oldValue}</p>
        </div>
      )}
      {entry.newValue && (
        <div className="rounded-md bg-success/10 px-2 py-1.5 text-xs">
          <p className="font-medium text-success">After</p>
          <p className="break-all text-muted-foreground">{entry.newValue}</p>
        </div>
      )}
    </div>
  );
}

export default function AuditLogPage({ onBack }: Props) {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>(ALL);
  const [filterEntity, setFilterEntity] = useState<string>(ALL);

  useEffect(() => {
    let active = true;
    fetchAuditLog()
      .then((data) => { if (active) setLogs(data as AuditRow[]); })
      .catch(() => toast.error('Couldn’t load the audit log. Refresh the page to try again.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Include any actions/entities present in the data that aren't in the known lists.
  const actionOptions = useMemo(() => {
    const extra = logs.map((l) => l.action).filter((a) => a && !ACTION_OPTIONS.includes(a as AuditAction));
    return [...ACTION_OPTIONS, ...new Set(extra)];
  }, [logs]);

  const entityOptions = useMemo(() => {
    const extra = logs.map((l) => l.entityType).filter((e) => e && !ENTITY_OPTIONS.includes(e as AuditEntity));
    return [...ENTITY_OPTIONS, ...new Set(extra)];
  }, [logs]);

  const query = search.trim().toLowerCase();
  const filtered = logs.filter((e) => {
    if (filterAction !== ALL && e.action !== filterAction) return false;
    if (filterEntity !== ALL && e.entityType !== filterEntity) return false;
    if (query) {
      const haystack = `${e.description} ${e.actorName} ${humanize(e.action)} ${e.entityType}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const hasFilters = filterAction !== ALL || filterEntity !== ALL || query.length > 0;
  const clearFilters = () => { setFilterAction(ALL); setFilterEntity(ALL); setSearch(''); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description={loading ? 'Every important change, newest first.' : `${filtered.length} of ${logs.length} entries, newest first.`}
        onBack={onBack}
      />

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative md:max-w-xs md:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search descriptions or people"
            aria-label="Search audit log"
            className="pl-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-full md:w-52" aria-label="Filter by action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All actions</SelectItem>
              {actionOptions.map((a) => <SelectItem key={a} value={a}>{humanize(a)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-full md:w-44" aria-label="Filter by record type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All records</SelectItem>
              {entityOptions.map((e) => <SelectItem key={e} value={e}>{humanize(e)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters} className="self-start md:self-auto">
            <X data-icon="inline-start" />
            Clear filters
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState label="Loading audit log…" />
      ) : filtered.length === 0 ? (
        logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Nothing logged yet"
            description="Changes to people, requests and settings will show up here."
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No matching entries"
            description="Try a different search or clear the filters."
            action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        )
      ) : (
        <>
          {/* Desktop: table */}
          <Card className="hidden gap-0 py-0 md:flex">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36 pl-4">Time</TableHead>
                  <TableHead className="w-48">By</TableHead>
                  <TableHead className="w-48">Action</TableHead>
                  <TableHead className="pr-4">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => {
                  const iso = entryTime(entry);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-4 align-top text-muted-foreground" title={absoluteTime(iso)}>
                        {relativeTime(iso)}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={entry.actorName} size="sm" />
                          <span className="truncate">{entry.actorName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top"><ActionBadge action={entry.action} /></TableCell>
                      <TableCell className="pr-4 align-top whitespace-normal">
                        <p>{entry.description}</p>
                        {entry.entityType && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{humanize(entry.entityType)}</p>
                        )}
                        <ChangeValues entry={entry} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: stacked rows */}
          <Card className="gap-0 divide-y py-0 md:hidden">
            {filtered.map((entry) => {
              const iso = entryTime(entry);
              return (
                <div key={entry.id} className="space-y-1.5 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <ActionBadge action={entry.action} />
                    <span className="shrink-0 text-xs text-muted-foreground" title={absoluteTime(iso)}>
                      {relativeTime(iso)}
                    </span>
                  </div>
                  <p className="text-sm">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actorName}
                    {entry.entityType ? ` · ${humanize(entry.entityType)}` : ''}
                  </p>
                  <ChangeValues entry={entry} />
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}
