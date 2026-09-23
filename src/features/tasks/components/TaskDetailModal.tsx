import { TranslatedText } from '@/i18n/LanguageContext';
import { useState, useEffect, type ReactNode } from 'react';
import {
  CheckCircle2, Circle, CircleDot, Pin, PinOff, Play, Send, StickyNote, Undo2, Users, XCircle, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthContext';
import { useTasks, type Task } from '@/features/tasks/TaskContext';
import { fetchComments, insertComment, type TaskComment } from '@/features/tasks/taskService';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Props { task: Task | null; open: boolean; onClose: () => void; }

const STATUS: Record<Task['status'], { label: string; icon: LucideIcon; className: string }> = {
  pending: { label: 'To do', icon: Circle, className: 'bg-secondary text-secondary-foreground' },
  in_progress: { label: 'In progress', icon: CircleDot, className: 'bg-info/15 text-info' },
  done: { label: 'Done', icon: CheckCircle2, className: 'bg-success/15 text-success' },
  missed: { label: 'Missed', icon: XCircle, className: 'bg-destructive/10 text-destructive' },
};
const PRIORITY: Record<Task['priority'], { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
  high: { label: 'High priority', className: 'bg-warning/15 text-warning' },
  normal: { label: 'Normal priority', className: 'bg-secondary text-secondary-foreground' },
  low: { label: 'Low priority', className: 'bg-muted text-muted-foreground' },
};

const SAVE_ERROR = 'Couldn’t save that change. Check your connection and try again.';

export default function TaskDetailModal({ task, open, onClose }: Props) {
  const { user } = useAuth();
  const { completeTask, moveTask, addHandoverNote, updateChecklist, pinTask, categories } = useTasks();
  const [comments, setComments] = useState<{ taskId: string; items: TaskComment[] } | null>(null);
  const [reloadComments, setReloadComments] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [handover, setHandover] = useState('');
  const [showHandover, setShowHandover] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const taskId = task?.id;
  const legacyId = task?.legacy_id;

  useEffect(() => {
    if (!taskId || !open) return;
    let cancelled = false;
    fetchComments(taskId, legacyId)
      .then((items) => { if (!cancelled) setComments({ taskId, items }); })
      .catch(() => {
        if (cancelled) return;
        setComments({ taskId, items: [] });
        toast.error('Couldn’t load comments.', { id: 'task-comments' });
      });
    return () => { cancelled = true; };
  }, [taskId, legacyId, open, reloadComments]);

  if (!task || !user) return null;

  const status = STATUS[task.status] ?? STATUS.pending;
  const StatusIcon = status.icon;
  const cat = categories.find(c => c.id === task.category_id);
  const canAct = task.status !== 'done' && task.status !== 'missed';
  const taskComments = comments?.taskId === task.id ? comments.items : null;
  const checklistDone = task.checklist_items.filter(i => i.done).length;

  const run = async (key: string, action: () => Promise<boolean>, success?: string) => {
    setBusy(key);
    const ok = await action();
    setBusy(null);
    if (ok && success) toast.success(success);
    if (!ok) toast.error(SAVE_ERROR);
    return ok;
  };

  const handleComment = async () => {
    const body = newComment.trim();
    if (!body) return;
    setSendingComment(true);
    const ok = await insertComment({
      taskId: task.id,
      userId: user.id ?? 'unknown',
      userName: user.displayName ?? user.username ?? 'Unknown',
      body,
    });
    setSendingComment(false);
    if (!ok) { toast.error('Couldn’t post your comment. Try again.'); return; }
    setNewComment('');
    setReloadComments(n => n + 1);
  };

  const handleHandover = async () => {
    if (!handover.trim()) return;
    const ok = await run('handover', () => addHandoverNote(task.id, handover.trim()), 'Handover note saved');
    if (ok) { setShowHandover(false); setHandover(''); }
  };

  const toggleCheck = (idx: number) => {
    const items = [...(task.checklist_items || [])];
    items[idx] = { ...items[idx], done: !items[idx].done };
    run(`check-${idx}`, () => updateChecklist(task.id, items));
  };

  const handleComplete = async () => {
    const ok = await run('complete', () => completeTask(task.id), task.group_id ? 'Task completed for the whole group' : 'Task completed');
    if (ok) onClose();
  };

  const dateLabel = new Date(task.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title={task.title}
      description={dateLabel}
      footer={canAct ? (
        <>
          {task.status === 'pending' && (
            <Button variant="outline" size="lg" className="h-10" disabled={busy !== null} onClick={() => run('start', () => moveTask(task.id, 'in_progress'), 'Task started')}>
              {busy === 'start' ? <Spinner /> : <Play />}
              Start
            </Button>
          )}
          <Button size="lg" className="h-10" disabled={busy !== null} onClick={handleComplete}>
            {busy === 'complete' ? <Spinner /> : <CheckCircle2 />}
            Mark as done
          </Button>
        </>
      ) : undefined}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={status.className}><StatusIcon />{status.label}</Badge>
          {task.priority !== 'normal' && <Badge className={PRIORITY[task.priority].className}>{PRIORITY[task.priority].label}</Badge>}
          {cat && (
            <Badge variant="outline">
              <span className="size-2 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden="true" />
              {cat.name}
            </Badge>
          )}
          {task.group_id && <Badge variant="outline"><Users />Group task</Badge>}
          {task.is_pinned && <Badge variant="outline"><Pin />Pinned</Badge>}
        </div>

        {task.description && <p className="text-sm whitespace-pre-line text-muted-foreground">{task.description}</p>}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <MetaRow label="Assigned to">{task.assigned_to_name}</MetaRow>
          {task.assigned_by_name && <MetaRow label="Assigned by">{task.assigned_by_name}</MetaRow>}
          {task.completed_by_name && <MetaRow label="Completed by">{task.completed_by_name}</MetaRow>}
          {task.completed_at && (
            <MetaRow label="Completed at">
              {new Date(task.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </MetaRow>
          )}
        </dl>

        {task.has_checklist && task.checklist_items.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <h3 className="font-medium">Checklist</h3>
              <span className="text-muted-foreground tabular-nums">{checklistDone}/{task.checklist_items.length}</span>
            </div>
            <Progress value={task.checklist_progress || 0} aria-label="Checklist progress" />
            <div className="flex flex-col">
              {task.checklist_items.map((item, i) => {
                const id = `check-${task.id}-${i}`;
                return (
                  <label key={i} htmlFor={id} className={cn('flex min-h-10 items-center gap-3 rounded-md px-1 text-sm', canAct && 'cursor-pointer hover:bg-muted/60')}>
                    <Checkbox
                      id={id}
                      checked={item.done}
                      disabled={!canAct || busy !== null}
                      onCheckedChange={() => toggleCheck(i)}
                    />
                    <span className={cn(item.done && 'text-muted-foreground line-through')}>{item.text}</span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {task.handover_note && (
          <section className="rounded-lg bg-warning/10 p-3 text-sm">
            <h3 className="flex items-center gap-1.5 font-medium text-warning">
              <StickyNote className="size-4" aria-hidden="true" />
              Handover note
            </h3>
            <p className="mt-1 whitespace-pre-line">{task.handover_note}</p>
          </section>
        )}

        {showHandover && (
          <section className="space-y-2">
            <label htmlFor="handover-note" className="text-sm font-medium">Handover note</label>
            <Textarea
              id="handover-note"
              value={handover}
              onChange={(e) => setHandover(e.target.value)}
              placeholder="What’s left to do, or why it wasn’t done"
              rows={2}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setShowHandover(false); setHandover(''); }}><TranslatedText text="Cancel" /></Button>
              <Button onClick={handleHandover} disabled={!handover.trim() || busy !== null}>
                {busy === 'handover' && <Spinner />}
                Save note
              </Button>
            </div>
          </section>
        )}

        {canAct && !showHandover && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowHandover(true)}>
              <StickyNote />
              {task.handover_note ? 'Replace handover note' : 'Add handover note'}
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() => run('pin', () => pinTask(task.id, !task.is_pinned), task.is_pinned ? 'Task unpinned' : 'Task pinned')}
            >
              {task.is_pinned ? <PinOff /> : <Pin />}
              {task.is_pinned ? 'Unpin' : 'Pin'}
            </Button>
            {task.status === 'in_progress' && (
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() => run('back', () => moveTask(task.id, 'pending'), 'Moved back to to do')}
              >
                <Undo2 />
                Move back to to do
              </Button>
            )}
          </div>
        )}

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-medium">
            Comments{taskComments && taskComments.length > 0 ? ` (${taskComments.length})` : ''}
          </h3>
          {taskComments === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading comments…</p>
          ) : taskComments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="max-h-60 space-y-3 overflow-y-auto">
              {taskComments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <UserAvatar name={c.userName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{c.userName}</span>
                      {c.createdAt && (
                        <> · {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                      )}
                    </p>
                    <p className="text-sm whitespace-pre-line">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); handleComment(); }}
          >
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment"
              aria-label="Add a comment"
              className="h-10 flex-1"
            />
            <Button type="submit" size="icon-lg" className="size-10" disabled={!newComment.trim() || sendingComment} aria-label="Send comment">
              {sendingComment ? <Spinner /> : <Send />}
            </Button>
          </form>
        </section>
      </div>
    </ResponsiveDialog>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}
