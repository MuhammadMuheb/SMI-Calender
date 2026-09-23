import { useMemo, useState, type FormEvent } from 'react';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import {
  Eye, EyeOff, MoreHorizontal, Pencil, Star, Trash2, UserPlus, Users,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAppData } from '@/app/AppDataContext';
import { useAuth } from '@/features/auth/AuthContext';
import { ROLES, ROLE_LABELS, type Role } from '@/config/roles';
import { getDisplayName } from '@/utils/safeFallbacks';
import type { StaffUser } from '@/models/user';
import type { JobRole, StaffRoleAssignment } from '@/models/jobRole';
import DeleteUserConfirmationModal from '@/features/admin/components/DeleteUserConfirmationModal';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const ROLE_OPTIONS: Role[] = [ROLES.STAFF, ROLES.MANAGER, ROLES.SUPER_ADMIN, ROLES.SPECTATOR];

const ROLE_HINTS: Record<Role, string> = {
  [ROLES.STAFF]: 'Requests time off and sees their own schedule.',
  [ROLES.MANAGER]: 'Approves requests and manages the team calendar.',
  [ROLES.SUPER_ADMIN]: 'Full access, including people, roles and settings.',
  [ROLES.SPECTATOR]: 'Can view the calendar but not make changes.',
};

type UserJobRole = StaffRoleAssignment & { roleName: string; roleColor?: string };

/**
 * Checks Firestore directly, because the app's user list only holds active
 * accounts. User docs are keyed by username, so creating a user whose username
 * belongs to an archived account would overwrite that account.
 */
async function usernameExistsInFirestore(username: string): Promise<boolean> {
  const byId = await getDoc(doc(db, 'users', username));
  if (byId.exists()) return true;
  const byField = await getDocs(query(collection(db, 'users'), where('username', '==', username), limit(1)));
  return !byField.empty;
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === ROLES.SPECTATOR ? 'outline' : 'secondary'}>
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={cn('border-transparent', active ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground')}
    >
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

function JobRoleChips({ roles }: { roles: UserJobRole[] }) {
  if (roles.length === 0) return <span className="text-sm text-muted-foreground">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={r.id} variant="outline" className="gap-1.5">
          <span
            className={cn('size-2 shrink-0 rounded-full', !r.roleColor && 'bg-muted-foreground')}
            style={r.roleColor ? { backgroundColor: r.roleColor } : undefined}
            aria-hidden="true"
          />
          {r.roleName}
          {r.isPrimary && (
            <>
              <Star data-icon="inline-end" className="fill-current text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">(primary)</span>
            </>
          )}
        </Badge>
      ))}
    </div>
  );
}

function RowActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Archive or delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface Props { onBack?: () => void }

export default function StaffManagement({ onBack }: Props) {
  const { user } = useAuth();
  const {
    users, addUser, updateUser, deleteUserWithDataHandling,
    jobRoles, roleAssignments, assignRole, removeRoleAssignment,
  } = useAppData();

  const [showAdd, setShowAdd] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StaffUser | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPin, setFormPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [formRole, setFormRole] = useState<Role>(ROLES.STAFF);
  const [formJobRoles, setFormJobRoles] = useState<Set<string>>(new Set());
  const [formPrimaryRole, setFormPrimaryRole] = useState<string>('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState('');

  const actorName = user?.displayName ?? 'Admin';
  const isEditing = !!editingStaff;
  const formOpen = showAdd || isEditing;

  const sortedUsers = useMemo(
    () => (users || [])
      .filter((u): u is StaffUser => !!u && !!u.id)
      .slice()
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b))),
    [users],
  );

  const resetForm = () => {
    setFormName(''); setFormUsername(''); setFormPin(''); setShowPin(false);
    setFormRole(ROLES.STAFF); setFormJobRoles(new Set());
    setFormPrimaryRole(''); setFormActive(true); setFormError('');
  };

  const closeForm = () => {
    if (saving) return;
    setShowAdd(false);
    setEditingStaff(null);
    resetForm();
  };

  const toggleJobRole = (roleId: string) => {
    const next = new Set(formJobRoles);
    if (next.has(roleId)) {
      next.delete(roleId);
      if (formPrimaryRole === roleId) setFormPrimaryRole('');
    } else {
      next.add(roleId);
      if (next.size === 1) setFormPrimaryRole(roleId);
    }
    setFormJobRoles(next);
  };

  const openAdd = () => {
    resetForm();
    setEditingStaff(null);
    setShowAdd(true);
  };

  const openEdit = (staff: StaffUser) => {
    setShowAdd(false);
    setEditingStaff(staff);
    setFormName(staff.displayName);
    setFormUsername(staff.username);
    setFormPin('');
    setShowPin(false);
    setFormRole(staff.role);
    setFormActive(staff.isActive);
    const assigned = roleAssignments.filter((a) => a.userId === staff.id);
    setFormJobRoles(new Set(assigned.map((a) => a.jobRoleId)));
    setFormPrimaryRole(assigned.find((a) => a.isPrimary)?.jobRoleId ?? '');
    setFormError('');
  };

  const handleAdd = async () => {
    const name = formName.trim();
    const username = formUsername.trim().toLowerCase();
    if (!name || !username) { setFormError('Enter a name and a username.'); return; }
    if (/[\s/]/.test(username)) { setFormError('Usernames can’t contain spaces or slashes.'); return; }
    if (formPin.length < 4) { setFormError('The PIN needs at least 4 digits.'); return; }
    if (users.some((u) => u.username.toLowerCase() === username)) {
      setFormError('That username is already taken. Choose a different one.'); return;
    }

    setSaving(true);
    setFormError('');
    try {
      let taken: boolean;
      try {
        taken = await usernameExistsInFirestore(username);
      } catch {
        setFormError('Couldn’t check whether that username is free. Check your connection and try again.');
        return;
      }
      if (taken) {
        setFormError('That username belongs to an archived account. Choose a different one.');
        return;
      }

      const newId = await addUser({
        username,
        displayName: name,
        pin: formPin,
        role: formRole,
        isActive: true,
      }, actorName);

      // Sequential so each assignment gets its own timestamp-based id.
      for (const roleId of formJobRoles) {
        await assignRole(newId, roleId, roleId === formPrimaryRole, actorName);
      }

      toast.success(`${name} added`);
      setShowAdd(false);
      resetForm();
    } catch {
      toast.error(`Couldn’t add ${name}. Try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingStaff) return;
    const name = formName.trim();
    if (!name) { setFormError('Enter a name.'); return; }
    if (formPin && formPin.length < 4) { setFormError('The new PIN needs at least 4 digits.'); return; }

    setSaving(true);
    setFormError('');
    try {
      const updates: Partial<StaffUser> = {
        displayName: name,
        role: formRole,
        isActive: formActive,
      };
      if (formPin) updates.pin = formPin;
      await updateUser(editingStaff.id, updates, actorName);

      const currentAssignments = roleAssignments.filter((a) => a.userId === editingStaff.id);
      for (const a of currentAssignments) {
        if (!formJobRoles.has(a.jobRoleId)) await removeRoleAssignment(a.id, actorName);
      }
      for (const roleId of formJobRoles) {
        const existing = currentAssignments.find((a) => a.jobRoleId === roleId);
        if (!existing) await assignRole(editingStaff.id, roleId, roleId === formPrimaryRole, actorName);
      }

      toast.success('Changes saved');
      setEditingStaff(null);
      resetForm();
    } catch {
      toast.error(`Couldn’t save changes to ${name}. Try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (isEditing) void handleEditSave();
    else void handleAdd();
  };

  const handleDelete = async (staff: StaffUser, mode: 'hard_delete' | 'soft_delete') => {
    setDeleteErrorMsg('');
    try {
      await deleteUserWithDataHandling(staff.id, mode, actorName);
      toast.success(mode === 'hard_delete' ? `${staff.displayName} deleted` : `${staff.displayName} archived`);
      setConfirmDelete(null);
    } catch (err) {
      const reason = err instanceof Error && err.message ? ` ${err.message}` : '';
      const message = `Couldn’t ${mode === 'hard_delete' ? 'delete' : 'archive'} ${staff.displayName}.${reason}`;
      setDeleteErrorMsg(message);
      toast.error(message);
    }
  };

  const getJobRoleNames = (userId: string): UserJobRole[] => {
    const userAssignments = roleAssignments.filter((a) => a.userId === userId);
    // Deduplicate by jobRoleId; prefer the primary assignment when there are several.
    const uniqueRoles = new Map<string, StaffRoleAssignment>();
    for (const a of userAssignments) {
      const existing = uniqueRoles.get(a.jobRoleId);
      if (!existing || (a.isPrimary && !existing.isPrimary)) uniqueRoles.set(a.jobRoleId, a);
    }

    return Array.from(uniqueRoles.values()).map((a) => {
      const role: JobRole | undefined = jobRoles.find((r) => r.id === a.jobRoleId);
      return { ...a, roleName: role?.name ?? a.jobRoleId, roleColor: role?.color };
    });
  };

  const form = (
    <form id="staff-form" onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="staff-name">Name</FieldLabel>
          <Input
            id="staff-name"
            placeholder="Full name"
            autoComplete="off"
            value={formName}
            onChange={(e) => { setFormName(e.target.value); setFormError(''); }}
            className="h-10"
          />
        </Field>

        <Field data-disabled={isEditing ? true : undefined}>
          <FieldLabel htmlFor="staff-username">Username</FieldLabel>
          <Input
            id="staff-username"
            placeholder="Used to sign in"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={formUsername}
            disabled={isEditing}
            onChange={(e) => { setFormUsername(e.target.value); setFormError(''); }}
            className="h-10"
          />
          {isEditing && <FieldDescription>Usernames can’t be changed.</FieldDescription>}
        </Field>

        <Field>
          <FieldLabel htmlFor="staff-pin">{isEditing ? 'New PIN' : 'PIN'}</FieldLabel>
          <div className="relative">
            <Input
              id="staff-pin"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="new-password"
              placeholder={isEditing ? 'Leave blank to keep the current PIN' : '4–6 digits'}
              value={formPin}
              onChange={(e) => { setFormPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setFormError(''); }}
              className={cn('h-10 pr-10', formPin && 'tracking-[0.3em]')}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowPin((v) => !v)}
              aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              aria-pressed={showPin}
            >
              {showPin ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <FieldDescription>
            {isEditing ? 'Only fill this in to reset their PIN. 4–6 digits.' : 'They use this with their username to sign in.'}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="staff-role">Permission level</FieldLabel>
          <Select value={formRole} onValueChange={(v) => setFormRole(v as Role)}>
            <SelectTrigger id="staff-role" className="w-full data-[size=default]:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{ROLE_HINTS[formRole]}</FieldDescription>
        </Field>

        {isEditing && (
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="staff-active">Active</FieldLabel>
              <FieldDescription>Inactive people can’t sign in.</FieldDescription>
            </FieldContent>
            <Switch id="staff-active" checked={formActive} onCheckedChange={setFormActive} />
          </Field>
        )}

        {jobRoles.length > 0 && (
          <FieldSet>
            <FieldLegend variant="label">Job roles</FieldLegend>
            <FieldDescription>Optional. The positions they work; mark one as their primary role.</FieldDescription>
            <div className="divide-y rounded-lg border">
              {jobRoles.map((jr) => {
                const selected = formJobRoles.has(jr.id);
                const isPrimary = formPrimaryRole === jr.id;
                const checkboxId = `staff-jobrole-${jr.id}`;
                return (
                  <div key={jr.id} className="flex min-h-11 items-center gap-3 px-3 py-1.5">
                    <Checkbox id={checkboxId} checked={selected} onCheckedChange={() => toggleJobRole(jr.id)} />
                    <label htmlFor={checkboxId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: jr.color }} aria-hidden="true" />
                      <span className="truncate">{jr.name}</span>
                    </label>
                    {selected && (
                      <Button
                        type="button"
                        size="xs"
                        variant={isPrimary ? 'secondary' : 'ghost'}
                        onClick={() => setFormPrimaryRole(jr.id)}
                        aria-pressed={isPrimary}
                        className={cn(!isPrimary && 'text-muted-foreground')}
                      >
                        <Star data-icon="inline-start" className={cn(isPrimary && 'fill-current')} />
                        {isPrimary ? 'Primary' : 'Make primary'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </FieldSet>
        )}

        {formError && <FieldError>{formError}</FieldError>}
      </FieldGroup>
    </form>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description={`${sortedUsers.length} ${sortedUsers.length === 1 ? 'person' : 'people'} · accounts, permissions and job roles`}
        onBack={onBack}
        actions={(
          <Button onClick={openAdd}>
            <UserPlus data-icon="inline-start" />
            Add person
          </Button>
        )}
      />

      {sortedUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No people yet"
          description="Add the first person so they can sign in and request time off."
          action={(
            <Button onClick={openAdd}>
              <UserPlus data-icon="inline-start" />
              Add person
            </Button>
          )}
        />
      ) : (
        <>
          {/* Desktop: table */}
          <Card className="hidden py-0 md:flex">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Permission</TableHead>
                  <TableHead>Job roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12 pr-4"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((staff) => {
                  const displayName = getDisplayName(staff);
                  return (
                    <TableRow key={staff.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={displayName} />
                          <span className="font-medium">{displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{staff.username}</TableCell>
                      <TableCell><RoleBadge role={staff.role} /></TableCell>
                      <TableCell className="whitespace-normal"><JobRoleChips roles={getJobRoleNames(staff.id)} /></TableCell>
                      <TableCell><StatusBadge active={staff.isActive} /></TableCell>
                      <TableCell className="pr-4 text-right">
                        <RowActions name={displayName} onEdit={() => openEdit(staff)} onDelete={() => setConfirmDelete(staff)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: stacked rows */}
          <Card className="gap-0 divide-y py-0 md:hidden">
            {sortedUsers.map((staff) => {
              const displayName = getDisplayName(staff);
              return (
                <div key={staff.id} className="flex items-start gap-3 p-4">
                  <UserAvatar name={displayName} className="mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div>
                      <p className="truncate font-medium">{displayName}</p>
                      <p className="truncate text-sm text-muted-foreground">{staff.username}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <RoleBadge role={staff.role} />
                      <StatusBadge active={staff.isActive} />
                    </div>
                    <JobRoleChips roles={getJobRoleNames(staff.id)} />
                  </div>
                  <RowActions name={displayName} onEdit={() => openEdit(staff)} onDelete={() => setConfirmDelete(staff)} />
                </div>
              );
            })}
          </Card>
        </>
      )}

      <ResponsiveDialog
        open={formOpen}
        onOpenChange={(open) => { if (!open) closeForm(); }}
        title={isEditing ? `Edit ${editingStaff?.displayName ?? 'person'}` : 'Add person'}
        description={isEditing ? undefined : 'Create an account they can sign in with.'}
        footer={(
          <>
            <Button variant="outline" size="lg" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button type="submit" form="staff-form" size="lg" disabled={saving}>
              {saving && <Spinner />}
              {isEditing ? 'Save changes' : 'Add person'}
            </Button>
          </>
        )}
      >
        {form}
      </ResponsiveDialog>

      <DeleteUserConfirmationModal
        open={!!confirmDelete}
        user={confirmDelete}
        onClose={() => { setConfirmDelete(null); setDeleteErrorMsg(''); }}
        onConfirm={(mode) => (confirmDelete ? handleDelete(confirmDelete, mode) : Promise.resolve())}
        error={deleteErrorMsg}
      />
    </div>
  );
}
