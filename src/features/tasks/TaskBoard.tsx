import { TranslatedText } from '@/i18n/LanguageContext';
import { useState, useMemo } from 'react';
import {
  CheckCircle2, ChevronLeft, ChevronRight, Circle, CircleDot, ClipboardList, ListChecks, Pin, Plus, StickyNote, Users, XCircle,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthContext';
import { useTasks, type Task, type TaskCategory } from '@/features/tasks/TaskContext';
import CreateTaskModal from '@/features/tasks/components/CreateTaskModal';
import TaskDetailModal from '@/features/tasks/components/TaskDetailModal';
import { formatDateLocal, todayStr } from '@/utils/dateUtils';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

const STATUS_META: Record<Task['status'], { label: string; icon: LucideIcon; iconClass: string }> = {
  pending: { label: 'To do', icon: Circle, iconClass: 'text-muted-foreground' },
  in_progress: { label: 'In progress', icon: CircleDot, iconClass: 'text-info' },
  done: { label: 'Done', icon: CheckCircle2, iconClass: 'text-success' },
  missed: { label: 'Missed', icon: XCircle, iconClass: 'text-destructive' },
};
const STATUS_ORDER: Task['status'][] = ['pending', 'in_progress', 'done', 'missed'];

const PRIORITY_META: Record<Task['priority'], { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
  high: { label: 'High', className: 'bg-warning/15 text-warning' },
  normal: { label: 'Normal', className: 'bg-secondary text-secondary-foreground' },
  low: { label: 'Low', className: 'bg-muted text-muted-foreground' },
};
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

interface TaskGroup { key: string; label: string; icon?: LucideIcon; iconClass?: string; color?: string; tasks: Task[] }

export default function TaskBoard() {
  const { user } = useAuth();
  const { tasks, categories, loading, selectedDate, setSelectedDate, completeTask } = useTasks();
  const [createKey, setCreateKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'my' | 'team'>('my');
  const [groupBy, setGroupBy] = useState<'status' | 'category'>('status');
  const [completing, setCompleting] = useState<Set<string>>(() => new Set());

  const userId = user?.id;
  const isAdmin = user?.role === 'super_admin' || user?.role === 'manager';
  const effectiveView = isAdmin ? viewMode : 'my';

  const filtered = useMemo(() => {
    const t = effectiveView === 'my' ? tasks.filter(tk => tk.assigned_to === userId) : [...tasks];
    return t.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
    });
  }, [tasks, effectiveView, userId]);

  const groups: TaskGroup[] = useMemo(() => {
    if (groupBy === 'status') {
      return STATUS_ORDER
        .map((s) => ({ key: s, label: STATUS_META[s].label, icon: STATUS_META[s].icon, iconClass: STATUS_META[s].iconClass, tasks: filtered.filter(t => t.status === s) }))
        .filter((g) => g.tasks.length > 0);
    }
    const known = new Set(categories.map(c => c.id));
    const byCategory: TaskGroup[] = categories.map((c) => ({
      key: c.id, label: c.name, color: c.color, tasks: filtered.filter(t => t.category_id === c.id),
    }));
    byCategory.push({ key: '__none', label: 'No category', tasks: filtered.filter(t => !t.category_id || !known.has(t.category_id)) });
    return byCategory.filter((g) => g.tasks.length > 0);
  }, [filtered, groupBy, categories]);

  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) ?? null : null;

  if (!user) return null;

  const categoryById = new Map(categories.map(c => [c.id, c]));
  const doneCount = filtered.filter(t => t.status === 'done').length;
  const missedCount = filtered.filter(t => t.status === 'missed').length;

  const goDate = (off: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + off);
    setSelectedDate(formatDateLocal(d));
  };
  const isToday = selectedDate === todayStr();
  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const handleComplete = async (task: Task) => {
    setCompleting(prev => new Set(prev).add(task.id));
    const ok = await completeTask(task.id);
    setCompleting(prev => { const next = new Set(prev); next.delete(task.id); return next; });
    if (ok) toast.success(task.group_id ? 'Task completed for the whole group' : 'Task completed');
    else toast.error('Couldn’t complete the task. Check your connection and try again.');
  };

  const openTask = (task: Task) => { setSelectedTaskId(task.id); setDetailOpen(true); };

  const summary = filtered.length === 0
    ? (isToday ? 'Nothing planned for today' : `Nothing planned for ${dateLabel}`)
    : `${doneCount} of ${filtered.length} done${missedCount > 0 ? ` · ${missedCount} missed` : ''}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description={summary}
        actions={isAdmin && (
          <Button size="lg" className="h-10" onClick={() => { setCreateKey(k => k + 1); setShowCreate(true); }}>
            <Plus />
            New task
          </Button>
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonGroup aria-label="Date">
          <Button variant="outline" size="icon-lg" className="size-10" onClick={() => goDate(-1)} aria-label="Previous day">
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-10 min-w-28"
            onClick={() => setSelectedDate(todayStr())}
            aria-label={isToday ? 'Today' : `${dateLabel}, go to today`}
          >
            {isToday ? 'Today' : dateLabel}
          </Button>
          <Button variant="outline" size="icon-lg" className="size-10" onClick={() => goDate(1)} aria-label="Next day">
            <ChevronRight />
          </Button>
        </ButtonGroup>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'my' | 'team')}>
              <TabsList className="h-10!">
                <TabsTrigger value="my">My tasks</TabsTrigger>
                <TabsTrigger value="team"><TranslatedText text="Team" /></TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={groupBy}
            onValueChange={(v) => { if (v) setGroupBy(v as 'status' | 'category'); }}
            aria-label="Group tasks by"
          >
            <ToggleGroupItem value="status" className="h-10"><TranslatedText text="Status" /></ToggleGroupItem>
            <ToggleGroupItem value="category" className="h-10">Category</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading tasks…" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={isToday ? 'No tasks today' : 'No tasks on this day'}
          description={
            effectiveView === 'my'
              ? (isAdmin ? 'Nothing is assigned to you. Switch to Team to see everyone’s tasks.' : 'Nothing is assigned to you for this day.')
              : 'No one has tasks for this day.'
          }
          action={isAdmin ? (
            <Button onClick={() => { setCreateKey(k => k + 1); setShowCreate(true); }}>
              <Plus />
              New task
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => {
            const Icon = g.icon;
            return (
              <Card key={g.key} size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {Icon && <Icon className={cn('size-4', g.iconClass)} aria-hidden="true" />}
                    {g.color && <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />}
                    {g.label}
                    <Badge variant="secondary">{g.tasks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div role="list" className="-mx-1 flex flex-col">
                    {g.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        category={task.category_id ? categoryById.get(task.category_id) : undefined}
                        showAssignee={effectiveView === 'team'}
                        showStatus={groupBy === 'category'}
                        showCategory={groupBy === 'status'}
                        completing={completing.has(task.id)}
                        onComplete={handleComplete}
                        onOpen={openTask}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {isAdmin && <CreateTaskModal key={createKey} open={showCreate} onClose={() => setShowCreate(false)} />}
      <TaskDetailModal key={selectedTaskId ?? "none"} task={selectedTask} open={detailOpen && !!selectedTask} onClose={() => setDetailOpen(false)} />
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  category?: TaskCategory;
  showAssignee: boolean;
  showStatus: boolean;
  showCategory: boolean;
  completing: boolean;
  onComplete: (task: Task) => void;
  onOpen: (task: Task) => void;
}

function TaskRow({ task, category, showAssignee, showStatus, showCategory, completing, onComplete, onOpen }: TaskRowProps) {
  const done = task.status === 'done';
  const closed = done || task.status === 'missed';
  const checklistDone = task.checklist_items.filter(i => i.done).length;
  const StatusIcon = STATUS_META[task.status].icon;

  return (
    <div role="listitem" className="flex items-start gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-muted/60">
      <div className="flex h-10 shrink-0 items-center pl-2">
        <Checkbox
          checked={done || completing}
          disabled={closed || completing}
          onCheckedChange={(checked) => { if (checked) onComplete(task); }}
          aria-label={`Mark “${task.title}” as done`}
        />
      </div>
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="flex min-h-10 min-w-0 flex-1 items-start gap-2 rounded-md py-2 pr-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {task.is_pinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" aria-label="Pinned" />}
            <span className={cn('text-sm font-medium', closed && 'text-muted-foreground', done && 'line-through')}>
              {task.title}
            </span>
            {task.group_id && <Users className="size-3.5 shrink-0 text-muted-foreground" aria-label="Group task" />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {showStatus && task.status !== 'pending' && (
              <span className="inline-flex items-center gap-1">
                <StatusIcon className={cn('size-3.5', STATUS_META[task.status].iconClass)} aria-hidden="true" />
                {STATUS_META[task.status].label}
              </span>
            )}
            {showCategory && category && (
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
                {category.name}
              </span>
            )}
            {task.priority !== 'normal' && (
              <Badge className={PRIORITY_META[task.priority].className}>{PRIORITY_META[task.priority].label}</Badge>
            )}
            {task.has_checklist && task.checklist_items.length > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <ListChecks className="size-3.5" aria-hidden="true" />
                {checklistDone}/{task.checklist_items.length}
              </span>
            )}
            {showAssignee && <span>{task.assigned_to_name}</span>}
            {done && task.completed_by_name && <span>Done by {task.completed_by_name}</span>}
          </div>
          {task.handover_note && (
            <p className="mt-1 flex items-start gap-1 text-xs text-warning">
              <StickyNote className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span className="line-clamp-2">{task.handover_note}</span>
            </p>
          )}
        </div>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </div>
  );
}
