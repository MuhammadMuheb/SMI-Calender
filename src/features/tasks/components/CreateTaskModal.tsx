import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthContext';
import { useTasks } from '@/features/tasks/TaskContext';
import { useAppData } from '@/app/AppDataContext';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface Props { open: boolean; onClose: () => void; }

const PRIOS = [
  { v: 'low', l: 'Low' },
  { v: 'normal', l: 'Normal' },
  { v: 'high', l: 'High' },
  { v: 'urgent', l: 'Urgent' },
];
const NO_CATEGORY = '__none';

/**
 * Form state is initialised on mount; the parent remounts it (via `key`) each time
 * it opens so the date follows the board's selected day.
 */
export default function CreateTaskModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const { createTask, categories, selectedDate } = useTasks();
  const { users } = useAppData();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('normal');
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [date, setDate] = useState(selectedDate);
  const [errors, setErrors] = useState<{ title?: string; assignees?: string; date?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const activeUsers = useMemo(
    () => users
      .filter(u => u.isActive)
      .sort((a, b) => (a.displayName ?? a.username ?? '').localeCompare(b.displayName ?? b.username ?? '')),
    [users],
  );

  if (!user) return null;

  const toggleUser = (id: string) => {
    setAssignedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setErrors(e => ({ ...e, assignees: undefined }));
  };

  const handleSubmit = async () => {
    const nextErrors: typeof errors = {};
    if (!title.trim()) nextErrors.title = 'Give the task a title.';
    if (!date) nextErrors.date = 'Pick a date.';
    if (assignedIds.length === 0) nextErrors.assignees = 'Assign it to at least one person.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const groupId = assignedIds.length > 1 ? `grp_${Date.now()}` : undefined;
    let created = 0;
    let failed = 0;
    for (const uid of assignedIds) {
      const u = activeUsers.find(x => x.id === uid);
      if (!u) continue;
      const displayName = u.displayName ?? u.username ?? 'Unknown';
      const ok = await createTask({ title: title.trim(), description: description.trim(), category_id: categoryId || undefined, date, assigned_to: uid, assigned_to_name: displayName, priority, group_id: groupId });
      if (ok) created++; else failed++;
    }
    setSubmitting(false);

    if (failed === 0) {
      toast.success(created > 1 ? `${created} tasks created` : 'Task created');
      onClose();
    } else if (created > 0) {
      toast.error(`Created ${created} of ${created + failed} tasks. Check the board and try again for the rest.`);
      onClose();
    } else {
      toast.error('Couldn’t create the task. Check your connection and try again.');
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => { if (!o && !submitting) onClose(); }}
      title="New task"
      description="Assign a one-off task for a specific day."
      footer={
        <>
          <Button variant="outline" size="lg" className="h-10" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="lg" className="h-10" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Spinner />}
            {submitting ? 'Creating…' : 'Create task'}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <Field data-invalid={errors.title ? true : undefined}>
          <FieldLabel htmlFor="task-title">Title</FieldLabel>
          <Input
            id="task-title"
            placeholder="What needs to be done?"
            value={title}
            aria-invalid={!!errors.title}
            onChange={(e) => { setTitle(e.target.value); setErrors(er => ({ ...er, title: undefined })); }}
            className="h-10"
          />
          <FieldError>{errors.title}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="task-description">Description</FieldLabel>
          <Textarea
            id="task-description"
            placeholder="Optional details"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field>

        <Field data-invalid={errors.date ? true : undefined}>
          <FieldLabel htmlFor="task-date">Date</FieldLabel>
          <Input
            id="task-date"
            type="date"
            value={date}
            aria-invalid={!!errors.date}
            onChange={(e) => { setDate(e.target.value); setErrors(er => ({ ...er, date: undefined })); }}
            className="h-10"
          />
          <FieldError>{errors.date}</FieldError>
        </Field>

        {categories.length > 0 && (
          <FieldSet>
            <FieldLegend variant="label">Category</FieldLegend>
            <ToggleGroup
              type="single"
              variant="outline"
              value={categoryId || NO_CATEGORY}
              onValueChange={(v) => { if (v) setCategoryId(v === NO_CATEGORY ? '' : v); }}
              className="w-full flex-wrap"
              aria-label="Category"
            >
              <ToggleGroupItem value={NO_CATEGORY} className="h-10">None</ToggleGroupItem>
              {categories.map(cat => (
                <ToggleGroupItem key={cat.id} value={cat.id} className="h-10">
                  <span className="size-2 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden="true" />
                  {cat.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>
        )}

        <FieldSet>
          <FieldLegend variant="label">Priority</FieldLegend>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={priority}
            onValueChange={(v) => { if (v) setPriority(v); }}
            className="w-full"
            aria-label="Priority"
          >
            {PRIOS.map(p => (
              <ToggleGroupItem key={p.v} value={p.v} className="h-10 flex-1">{p.l}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FieldSet>

        <FieldSet data-invalid={errors.assignees ? true : undefined}>
          <div className="flex items-center justify-between gap-2">
            <FieldLegend variant="label" className="mb-0">
              Assign to
            </FieldLegend>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0"
              onClick={() => { setAssignedIds([user.id]); setErrors(e => ({ ...e, assignees: undefined })); }}
            >
              Assign to me
            </Button>
          </div>
          {assignedIds.length > 1 && (
            <FieldDescription>
              {assignedIds.length} people selected. This is a group task: when one person completes it, it’s done for everyone.
            </FieldDescription>
          )}
          <div className="max-h-56 overflow-y-auto rounded-lg border">
            {activeUsers.map(u => {
              const displayName = u.displayName ?? u.username ?? 'Unknown';
              const checkboxId = `assign-${u.id}`;
              return (
                <label
                  key={u.id}
                  htmlFor={checkboxId}
                  className="flex min-h-10 cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/60"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={assignedIds.includes(u.id)}
                    onCheckedChange={() => toggleUser(u.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{displayName}</span>
                  {u.jobRole && u.jobRole.length > 0 && (
                    <span className="truncate text-xs text-muted-foreground">{u.jobRole.join(', ')}</span>
                  )}
                </label>
              );
            })}
          </div>
          <FieldError>{errors.assignees}</FieldError>
        </FieldSet>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
