import { useState, useEffect, useMemo } from 'react';
import { House, Info, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCheckInsBetween, localDayRange, type CheckInData } from '@/features/attendance/services/checkInsService';
import { useAppData } from '@/app/AppDataContext';
import { getDisplayName } from '@/utils/dataValidation';
import { todayStr } from '@/utils/dateUtils';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CheckInRecord {
  id: string;
  userId: string;
  userName: string;
  jobRole: string[];
  locationName: string;
  checkInAt: string;
  checkOutAt: string | null;
  isWfh: boolean;
  autoCheckedOut: boolean;
}

interface CheckInBoardProps {
  onBack: () => void;
  currentUserRole: string; // 'manager' | 'super_admin'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatHours(checkIn: string, checkOut: string | null, now: number) {
  const end = checkOut ? new Date(checkOut).getTime() : now;
  const diff = Math.max(end - new Date(checkIn).getTime(), 0);
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function CheckInBoard({ onBack, currentUserRole }: CheckInBoardProps) {
  const { users } = useAppData();
  const [rawRecords, setRawRecords] = useState<CheckInData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => todayStr());
  const [now, setNow] = useState(() => Date.now());

  const isSuperAdmin = currentUserRole === 'super_admin';
  const isToday = selectedDate === todayStr();

  // Load the selected day; refresh every 30s while viewing today.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const [start, end] = localDayRange(selectedDate);
      fetchCheckInsBetween(start, end)
        .then((data) => {
          if (cancelled) return;
          setRawRecords(data);
          setNow(Date.now());
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setLoading(false);
          toast.error('Couldn’t load check-ins. Check your connection and try again.', { id: 'checkin-board' });
        });
    };
    load();
    if (!isToday) return () => { cancelled = true; };
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedDate, isToday]);

  const records: CheckInRecord[] = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    return rawRecords.map((r) => {
      const user = byId.get(r.userId);
      const nameFromDoc = getDisplayName(r);
      const userName = nameFromDoc !== 'Unknown User' ? nameFromDoc : user ? getDisplayName(user) : 'Unknown';
      const docRoles = (r as unknown as { jobRole?: unknown }).jobRole;
      return {
        id: r.id,
        userId: r.userId,
        userName,
        jobRole: Array.isArray(docRoles) ? docRoles.map(String) : user?.jobRole ?? [],
        locationName: r.locationName || 'Unknown',
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt || null,
        isWfh: r.isWfh || false,
        autoCheckedOut: r.autoCheckedOut || false,
      };
    });
  }, [rawRecords, users]);

  const checkedIn = records.filter((r) => !r.checkOutAt);
  const checkedOut = records.filter((r) => r.checkOutAt);

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-in board"
        description={isToday ? 'Today · updates every 30 seconds' : dateLabel}
        onBack={onBack}
        actions={
          <>
            {isToday && (
              <Badge variant="outline" className="gap-1.5">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                Live
              </Badge>
            )}
            <Input
              type="date"
              aria-label="Date"
              value={selectedDate}
              onChange={(e) => {
                if (!e.target.value) return;
                setSelectedDate(e.target.value);
                setLoading(true);
              }}
              className="h-10 w-auto"
            />
          </>
        }
      />

      {isSuperAdmin && (
        <Alert>
          <Info />
          <AlertTitle>Manual edits aren’t available yet</AlertTitle>
          <AlertDescription>Adding, editing or deleting check-ins by hand will come in a later update.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="On site now" value={checkedIn.length} tone="primary" />
        <StatCard label="Checked out" value={checkedOut.length} />
        <StatCard label="Total" value={records.length} />
      </div>

      {loading ? (
        <LoadingState label="Loading check-ins…" />
      ) : records.length === 0 ? (
        <EmptyState
          icon={Users}
          title={isToday ? 'No check-ins yet today' : 'No check-ins on this day'}
          description={isToday ? 'People appear here as soon as they check in.' : 'Pick another date to see who worked.'}
        />
      ) : (
        <div className="space-y-6">
          {checkedIn.length > 0 && (
            <RecordSection title="On site now" records={checkedIn} now={now} open />
          )}
          {checkedOut.length > 0 && (
            <RecordSection title="Checked out" records={checkedOut} now={now} />
          )}
        </div>
      )}
    </div>
  );
}

function RecordSection({ title, records, now, open = false }: { title: string; records: CheckInRecord[]; now: number; open?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge variant="secondary">{records.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mobile: list rows */}
        <ItemGroup className="gap-1 md:hidden">
          {records.map((r) => (
            <Item key={r.id} role="listitem" size="sm" className="px-0">
              <ItemMedia>
                <UserAvatar name={r.userName} size="sm" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="flex-wrap">
                  {r.userName}
                  <RecordBadges record={r} />
                </ItemTitle>
                <ItemDescription className="flex flex-wrap items-center gap-x-1">
                  {r.isWfh ? <House className="size-3.5" aria-hidden="true" /> : <MapPin className="size-3.5" aria-hidden="true" />}
                  <span>{r.isWfh ? 'Home' : r.locationName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {open ? `In ${formatTime(r.checkInAt)}` : `${formatTime(r.checkInAt)}–${formatTime(r.checkOutAt!)}`}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{formatHours(r.checkInAt, r.checkOutAt, now)}</span>
                </ItemDescription>
                {r.jobRole.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {r.jobRole.map((role) => <Badge key={role} variant="outline">{role}</Badge>)}
                  </div>
                )}
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>

        {/* Desktop: table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar name={r.userName} size="sm" />
                      <span className="font-medium">{r.userName}</span>
                      <RecordBadges record={r} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.jobRole.length > 0
                        ? r.jobRole.map((role) => <Badge key={role} variant="outline">{role}</Badge>)
                        : <span className="text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>{r.isWfh ? 'Home' : r.locationName}</TableCell>
                  <TableCell className="tabular-nums">{formatTime(r.checkInAt)}</TableCell>
                  <TableCell className="tabular-nums">
                    {r.checkOutAt ? formatTime(r.checkOutAt) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatHours(r.checkInAt, r.checkOutAt, now)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function RecordBadges({ record }: { record: CheckInRecord }) {
  return (
    <>
      {record.isWfh && <Badge className="bg-info/15 text-info">WFH</Badge>}
      {record.autoCheckedOut && <Badge className="bg-warning/15 text-warning">Auto checked out</Badge>}
    </>
  );
}
