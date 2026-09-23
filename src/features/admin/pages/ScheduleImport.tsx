import { useMemo, useState } from 'react';
import { Database, Eye, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAppData } from '@/app/AppDataContext';
import { augustSchedules, septemberSchedules } from '@/data/scheduleData';
import { formatShortDate } from '@/features/leave/leaveMeta';
import type { Schedule } from '@/models/schedule';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ScheduleImportProps {
  onBack: () => void;
}

type ImportMonth = 8 | 9;

const SOURCES: Record<ImportMonth, { label: string; data: Schedule[] }> = {
  8: { label: 'August 2026', data: augustSchedules },
  9: { label: 'September 2026', data: septemberSchedules },
};

const scheduleKey = (s: Schedule) => `${s.date}:${s.guide}`;

export default function ScheduleImport({ onBack }: ScheduleImportProps) {
  const { schedules, seedSchedules } = useAppData();
  const [importing, setImporting] = useState<ImportMonth | null>(null);
  const [previewMonth, setPreviewMonth] = useState<ImportMonth | null>(null);
  const [confirmMonth, setConfirmMonth] = useState<ImportMonth | null>(null);

  const currentCount = schedules.length;
  const existingSet = useMemo(() => new Set(schedules.map(scheduleKey)), [schedules]);

  const pendingFor = (month: ImportMonth) => SOURCES[month].data.filter((s) => !existingSet.has(scheduleKey(s)));

  const handleImport = async (month: ImportMonth) => {
    const source = SOURCES[month];
    setImporting(month);
    try {
      const toImport = source.data.filter((s) => !existingSet.has(scheduleKey(s)));
      const skipped = source.data.length - toImport.length;
      if (toImport.length > 0) {
        await seedSchedules(toImport);
        toast.success(`Imported ${toImport.length} entries for ${source.label}`, {
          description: skipped > 0 ? `Skipped ${skipped} already in the database.` : undefined,
        });
      } else {
        toast.success(`${source.label} is already imported`);
      }
      setPreviewMonth(null);
    } catch {
      toast.error(`Couldn’t import ${source.label}`, { description: 'Check your connection and try again.' });
    } finally {
      setImporting(null);
      setConfirmMonth(null);
    }
  };

  const preview = previewMonth ? SOURCES[previewMonth].data : [];
  const confirmPending = confirmMonth ? pendingFor(confirmMonth).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule import"
        description="Load guide schedules extracted from the monthly PDFs. Entries already in the database are skipped."
        onBack={onBack}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Schedules in database" value={currentCount} icon={Database} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {([8, 9] as ImportMonth[]).map((month) => {
          const source = SOURCES[month];
          const pending = pendingFor(month).length;
          const busy = importing === month;
          return (
            <Card key={month}>
              <CardHeader>
                <CardTitle>{source.label}</CardTitle>
                <CardDescription>
                  {source.data.length} entries extracted from PDF
                  {pending < source.data.length && ` · ${source.data.length - pending} already imported`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pending === 0 ? (
                  <Badge variant="secondary" className="border-transparent bg-success/12 text-success">Fully imported</Badge>
                ) : (
                  <Badge variant="secondary" className="border-transparent bg-primary/10 text-primary">{pending} new</Badge>
                )}
              </CardContent>
              <CardFooter className="gap-2 border-t">
                <Button
                  variant={previewMonth === month ? 'secondary' : 'outline'}
                  onClick={() => setPreviewMonth(previewMonth === month ? null : month)}
                  disabled={importing !== null}
                >
                  <Eye data-icon="inline-start" />
                  {previewMonth === month ? 'Hide preview' : 'Preview'}
                </Button>
                <Button onClick={() => setConfirmMonth(month)} disabled={importing !== null || pending === 0}>
                  {busy ? <Spinner data-icon="inline-start" /> : <FileDown data-icon="inline-start" />}
                  {busy ? 'Importing…' : 'Import'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {previewMonth && preview.length > 0 && (
        <Card className="gap-0 pb-0">
          <CardHeader className="border-b">
            <CardTitle>Preview: {SOURCES[previewMonth].label}</CardTitle>
            <CardDescription>{preview.length} entries</CardDescription>
          </CardHeader>
          <div className="max-h-112 overflow-y-auto">
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Guide</TableHead>
                    <TableHead className="pr-4 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="pl-4 tabular-nums">{formatShortDate(s.date)}</TableCell>
                      <TableCell className="font-medium">{s.guide}</TableCell>
                      <TableCell className="pr-4 text-right"><StatusBadge exists={existingSet.has(scheduleKey(s))} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden">
              {preview.map((s, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.guide}</p>
                    <p className="text-xs text-muted-foreground">{formatShortDate(s.date)}</p>
                  </div>
                  <StatusBadge exists={existingSet.has(scheduleKey(s))} />
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <AlertDialog open={confirmMonth !== null} onOpenChange={(o) => { if (!o && importing === null) setConfirmMonth(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Import {confirmPending} {confirmPending === 1 ? 'entry' : 'entries'} for {confirmMonth ? SOURCES[confirmMonth].label : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              These guide schedules are added to the database for everyone. Entries that already exist are skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={importing !== null}
              onClick={(e) => { e.preventDefault(); if (confirmMonth) void handleImport(confirmMonth); }}
            >
              {importing !== null && <Spinner data-icon="inline-start" />}
              {importing !== null ? 'Importing…' : 'Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ exists }: { exists: boolean }) {
  return exists
    ? <Badge variant="secondary" className="border-transparent bg-muted text-muted-foreground">Already imported</Badge>
    : <Badge variant="secondary" className="border-transparent bg-primary/10 text-primary">New</Badge>;
}
