import { TranslatedText } from '@/i18n/LanguageContext';
import { useState, type FormEvent } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppData } from '@/app/AppDataContext';
import { useAuth } from '@/features/auth/AuthContext';
import { todayStr } from '@/utils/dateUtils';
import { formatShortDate } from '@/features/leave/leaveMeta';
import type { SpecialDay } from '@/models/holiday';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle,
} from '@/components/ui/field';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface Props { onBack: () => void }

function formatDayDate(date: string): string {
  const year = date.slice(0, 4);
  const short = formatShortDate(date);
  return year === String(new Date().getFullYear()) ? short : `${short}, ${year}`;
}

function ImpactBadge({ consumes }: { consumes: boolean }) {
  return consumes
    ? <Badge variant="secondary" className="border-transparent bg-warning/12 text-warning">Uses balance</Badge>
    : <Badge variant="secondary" className="border-transparent bg-success/12 text-success">Extra day off</Badge>;
}

export default function SpecialDayEditor({ onBack }: Props) {
  const { user } = useAuth();
  const { specialDays, addSpecialDay, deleteSpecialDay } = useAppData();
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formConsumes, setFormConsumes] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<SpecialDay | null>(null);
  const [deleting, setDeleting] = useState(false);

  const resetForm = () => { setFormName(''); setFormDate(''); setFormConsumes(false); setFormError(''); };

  const handleAdd = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!formName.trim() || !formDate) { setFormError('Enter a name and pick a date.'); return; }
    setSaving(true);
    try {
      // The context types this as void, but the implementation is async.
      await Promise.resolve(addSpecialDay({
        name: formName.trim(), date: formDate, consumesBalance: formConsumes,
        appliesToAll: true, appliesTo: [], createdBy: user?.id ?? '',
      }, user?.displayName ?? 'Admin'));
      toast.success(`${formName.trim()} added`);
      resetForm();
      setShowAdd(false);
    } catch {
      toast.error('Couldn’t add the special day. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await Promise.resolve(deleteSpecialDay(toDelete.id, user?.displayName ?? 'Admin'));
      toast.success(`${toDelete.name} deleted`);
      setToDelete(null);
    } catch {
      toast.error('Couldn’t delete the special day. Check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  };

  const sortedDays = [...specialDays].sort((a, b) => a.date.localeCompare(b.date));
  const today = todayStr();

  const addButton = (
    <Button onClick={() => setShowAdd(true)}>
      <Plus data-icon="inline-start" />
      Add special day
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Special days"
        description="Company-wide days off, like team days. Choose whether each one uses up staff balance."
        onBack={onBack}
        actions={sortedDays.length > 0 ? addButton : undefined}
      />

      {sortedDays.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No special days yet"
          description="Add a special day to give the whole team a day off."
          action={addButton}
        />
      ) : (
        <>
          {/* Desktop: table */}
          <Card className="hidden gap-0 py-0 md:flex">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4"><TranslatedText text="Name" /></TableHead>
                  <TableHead><TranslatedText text="Date" /></TableHead>
                  <TableHead>Balance impact</TableHead>
                  <TableHead className="w-16 pr-4"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDays.map((day) => {
                  const past = day.date < today;
                  return (
                    <TableRow key={day.id} className={cn(past && 'text-muted-foreground')}>
                      <TableCell className="pl-4 font-medium">
                        {day.name}
                        {past && <span className="ml-2 text-xs font-normal">Past</span>}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatDayDate(day.date)}</TableCell>
                      <TableCell><ImpactBadge consumes={day.consumesBalance} /></TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setToDelete(day)}
                          aria-label={`Delete ${day.name}`}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: stacked rows */}
          <Card className="gap-0 divide-y py-0 md:hidden">
            {sortedDays.map((day) => {
              const past = day.date < today;
              return (
                <div key={day.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className={cn('truncate text-sm font-medium', past && 'text-muted-foreground')}>{day.name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDayDate(day.date)}{past ? ' · Past' : ''}
                      </span>
                      <ImpactBadge consumes={day.consumesBalance} />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setToDelete(day)}
                    aria-label={`Delete ${day.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <ResponsiveDialog
        open={showAdd}
        onOpenChange={(o) => { if (!saving) { setShowAdd(o); if (!o) setFormError(''); } }}
        title="Add special day"
        description="Everyone gets this day off."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={saving}><TranslatedText text="Cancel" /></Button>
            <Button type="submit" form="special-day-form" disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              Add special day
            </Button>
          </>
        }
      >
        <form id="special-day-form" onSubmit={handleAdd} noValidate>
          <FieldGroup>
            <Field data-invalid={formError && !formName.trim() ? true : undefined}>
              <FieldLabel htmlFor="special-day-name"><TranslatedText text="Name" /></FieldLabel>
              <Input
                id="special-day-name"
                placeholder="e.g. Company team day"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); setFormError(''); }}
                aria-invalid={formError && !formName.trim() ? true : undefined}
                className="h-9"
              />
            </Field>
            <Field data-invalid={formError && !formDate ? true : undefined}>
              <FieldLabel htmlFor="special-day-date"><TranslatedText text="Date" /></FieldLabel>
              <Input
                id="special-day-date"
                type="date"
                value={formDate}
                min={todayStr()}
                onChange={(e) => { setFormDate(e.target.value); setFormError(''); }}
                aria-invalid={formError && !formDate ? true : undefined}
                className="h-9"
              />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Balance impact</FieldLegend>
              <RadioGroup
                value={formConsumes ? 'consumes' : 'extra'}
                onValueChange={(v) => setFormConsumes(v === 'consumes')}
              >
                <FieldLabel htmlFor="impact-extra">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Extra day off</FieldTitle>
                      <FieldDescription>A gift day. It doesn’t use any balance.</FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value="extra" id="impact-extra" />
                  </Field>
                </FieldLabel>
                <FieldLabel htmlFor="impact-consumes">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Uses balance</FieldTitle>
                      <FieldDescription>Takes 1 regular day off from each person’s balance.</FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value="consumes" id="impact-consumes" />
                  </Field>
                </FieldLabel>
              </RadioGroup>
            </FieldSet>
            {formError && <FieldError>{formError}</FieldError>}
          </FieldGroup>
        </form>
      </ResponsiveDialog>

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => { if (!o && !deleting) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? `${formatDayDate(toDelete.date)} will no longer be a special day for the team. ` : ''}
              This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}><TranslatedText text="Cancel" /></AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
            >
              {deleting && <Spinner data-icon="inline-start" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
