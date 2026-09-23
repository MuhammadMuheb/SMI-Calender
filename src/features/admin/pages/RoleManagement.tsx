import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { EyeOff, Plus, Tags, Trash2 } from 'lucide-react';
import { useAppData } from '@/app/AppDataContext';
import { useAuth } from '@/features/auth/AuthContext';
import type { JobRole } from '@/models/jobRole';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Default swatch for a new job role (the brand green). Stored as data on the role.
const DEFAULT_ROLE_COLOR = '#138A52';

function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn('inline-block size-3 shrink-0 rounded-full ring-1 ring-foreground/10', className)}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

interface Props { onBack: () => void }

export default function RoleManagement({ onBack }: Props) {
  const { user } = useAuth();
  const { jobRoles, roleAssignments, addJobRole, updateJobRole, deleteJobRole } = useAppData();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<JobRole | null>(null);

  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(DEFAULT_ROLE_COLOR);
  const [formHidden, setFormHidden] = useState(false);
  const [formStart, setFormStart] = useState('08:00');
  const [formEnd, setFormEnd] = useState('17:00');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const actorName = user?.displayName ?? 'Admin';

  const resetForm = () => {
    setFormName(''); setFormColor(DEFAULT_ROLE_COLOR); setFormHidden(false);
    setFormStart('08:00'); setFormEnd('17:00'); setFormError('');
  };

  const closeAdd = () => {
    if (saving) return;
    setShowAdd(false);
    resetForm();
  };

  const peopleIn = (roleId: string) =>
    new Set(roleAssignments.filter((a) => a.jobRoleId === roleId).map((a) => a.userId)).size;

  const handleAdd = async (e?: FormEvent) => {
    e?.preventDefault();
    const name = formName.trim();
    if (!name) { setFormError('Enter a name for the job role.'); return; }
    setSaving(true);
    try {
      await addJobRole({
        name, color: formColor, isHidden: formHidden,
        shiftStartTime: formStart, shiftEndTime: formEnd,
      }, actorName);
      toast.success(`${name} added`);
      setShowAdd(false);
      resetForm();
    } catch {
      toast.error(`Couldn’t add ${name}. Try again.`);
    } finally {
      setSaving(false);
    }
  };

  const toggleHidden = async (role: JobRole) => {
    try {
      await updateJobRole(role.id, { isHidden: !role.isHidden }, actorName);
      toast.success(role.isHidden ? `${role.name} is visible again` : `${role.name} is now hidden`);
    } catch {
      toast.error(`Couldn’t update ${role.name}. Try again.`);
    }
  };

  const handleDelete = async (role: JobRole) => {
    setConfirmDelete(null);
    try {
      await deleteJobRole(role.id, actorName);
      toast.success(`${role.name} deleted`);
    } catch {
      toast.error(`Couldn’t delete ${role.name}. Try again.`);
    }
  };

  const confirmCount = confirmDelete ? peopleIn(confirmDelete.id) : 0;

  const addButton = (
    <Button onClick={() => { resetForm(); setShowAdd(true); }}>
      <Plus data-icon="inline-start" />
      Add job role
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job roles"
        description="The positions people work, with their colors and default shift times."
        onBack={onBack}
        actions={addButton}
      />

      {jobRoles.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No job roles yet"
          description="Add job roles like Guide or Check-in, then assign them to people and set staffing rules."
          action={addButton}
        />
      ) : (
        <>
          {/* Desktop: table */}
          <Card className="hidden py-0 md:flex">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Job role</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>People</TableHead>
                  <TableHead>Hidden</TableHead>
                  <TableHead className="w-12 pr-4"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2.5">
                        <Swatch color={role.color} />
                        <span className="font-medium">{role.name}</span>
                        {role.isHidden && (
                          <Badge variant="outline" className="text-muted-foreground">
                            <EyeOff data-icon="inline-start" />
                            Hidden
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {role.shiftStartTime}–{role.shiftEndTime}
                    </TableCell>
                    <TableCell className="tabular-nums">{peopleIn(role.id)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={role.isHidden}
                        onCheckedChange={() => toggleHidden(role)}
                        aria-label={`Hide ${role.name}`}
                      />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDelete(role)}
                        aria-label={`Delete ${role.name}`}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: stacked rows */}
          <Card className="gap-0 divide-y py-0 md:hidden">
            {jobRoles.map((role) => {
              const count = peopleIn(role.id);
              return (
                <div key={role.id} className="flex items-start gap-3 p-4">
                  <Swatch color={role.color} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium">{role.name}</p>
                      {role.isHidden && (
                        <Badge variant="outline" className="text-muted-foreground">
                          <EyeOff data-icon="inline-start" />
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {role.shiftStartTime}–{role.shiftEndTime} · {count} {count === 1 ? 'person' : 'people'}
                    </p>
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <Switch checked={role.isHidden} onCheckedChange={() => toggleHidden(role)} />
                      Hidden
                    </label>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirmDelete(role)}
                    aria-label={`Delete ${role.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <p className="text-sm text-muted-foreground">
        Hidden roles only appear here. Managers and staff can’t see them, but they still count in staffing calculations.
      </p>

      <ResponsiveDialog
        open={showAdd}
        onOpenChange={(open) => { if (!open) closeAdd(); }}
        title="Add job role"
        description="People with this role can be assigned to its shifts."
        footer={(
          <>
            <Button variant="outline" size="lg" onClick={closeAdd} disabled={saving}>Cancel</Button>
            <Button type="submit" form="job-role-form" size="lg" disabled={saving}>Add job role</Button>
          </>
        )}
      >
        <form id="job-role-form" onSubmit={handleAdd} noValidate>
          <FieldGroup>
            <Field data-invalid={formError ? true : undefined}>
              <FieldLabel htmlFor="role-name">Name</FieldLabel>
              <Input
                id="role-name"
                placeholder="For example, Guide"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); setFormError(''); }}
                aria-invalid={formError ? true : undefined}
                className="h-10"
              />
              {formError && <FieldError>{formError}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="role-color">Color</FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  id="role-color"
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-input bg-transparent p-1"
                />
                <span className="font-mono text-sm text-muted-foreground uppercase">{formColor}</span>
              </div>
              <FieldDescription>Used for this role’s dots and badges on the calendar.</FieldDescription>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="role-start">Shift starts</FieldLabel>
                <Input id="role-start" type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="h-10" />
              </Field>
              <Field>
                <FieldLabel htmlFor="role-end">Shift ends</FieldLabel>
                <Input id="role-end" type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="h-10" />
              </Field>
            </div>

            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="role-hidden">Hidden role</FieldLabel>
                <FieldDescription>Only super admins can see it. It still counts in staffing.</FieldDescription>
              </FieldContent>
              <Switch id="role-hidden" checked={formHidden} onCheckedChange={setFormHidden} />
            </Field>
          </FieldGroup>
        </form>
      </ResponsiveDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCount > 0
                ? `This also removes the role from ${confirmCount} ${confirmCount === 1 ? 'person' : 'people'}. This can’t be undone.`
                : 'This also removes any staff assignments for this role. This can’t be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { if (confirmDelete) void handleDelete(confirmDelete); }}>
              Delete role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
