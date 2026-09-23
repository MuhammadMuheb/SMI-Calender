import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppData } from '@/app/AppDataContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { getDisplayName } from '@/utils/dataValidation';
import { todayStr } from '@/utils/dateUtils';
import { fetchTasksForDate, insertTask, updateTask, completeGroupTasks, markMissedTasks, fetchCategories, fetchTemplates, logActivity, generateDailyTasks, fetchActivity, normalizeTask } from '@/features/tasks/taskService';

/**
 * In-memory task shape. Firestore documents are written in camelCase
 * (see `taskService.ts`); `normalizeTask` maps both camelCase and older
 * snake_case documents into this shape.
 */
export interface Task {
  id: string;
  /** The `id` field stored inside older documents; comments made before the field fix reference it. */
  legacy_id?: string;
  template_id?: string; group_id?: string; title: string; description: string;
  category_id?: string; date: string; assigned_to: string; assigned_to_name: string;
  assigned_by?: string; assigned_by_name?: string;
  status: 'pending' | 'in_progress' | 'done' | 'missed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_pinned: boolean; has_checklist: boolean; checklist_items: { text: string; done: boolean }[];
  checklist_progress: number; depends_on_task?: string; completed_at?: string;
  completed_by?: string; completed_by_name?: string; handover_note: string; notes: string;
  created_at: string; updated_at: string;
}
export interface TaskCategory { id: string; name: string; color: string; sort_order: number; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TaskTemplate { id: string; title: string; description: string; category_id?: string; assigned_role?: string; priority: string; recurrence: string; has_checklist: boolean; checklist_items: any[]; depends_on_template?: string; is_active: boolean; created_by: string; created_at: string; }
export interface ActivityItem { id: string; task_id?: string; actor_id: string; actor_name: string; action: string; detail: string; created_at: string; }

interface TaskContextValue {
  tasks: Task[]; categories: TaskCategory[]; templates: TaskTemplate[]; activity: ActivityItem[];
  loading: boolean; selectedDate: string; setSelectedDate: (d: string) => void;
  createTask: (t: { title: string; description?: string; category_id?: string; date: string; assigned_to: string; assigned_to_name: string; priority?: string; group_id?: string; }) => Promise<boolean>;
  /** Each mutation resolves to false when the Firestore write failed (local state is left unchanged). */
  moveTask: (id: string, status: Task['status']) => Promise<boolean>;
  completeTask: (id: string) => Promise<boolean>;
  addHandoverNote: (id: string, note: string) => Promise<boolean>;
  updateChecklist: (id: string, items: { text: string; done: boolean }[]) => Promise<boolean>;
  pinTask: (id: string, pinned: boolean) => Promise<boolean>;
  refreshTasks: () => Promise<void>; refreshActivity: () => Promise<void>;
  getTasksForUser: (userId: string) => Task[];
  todayStats: { total: number; done: number; missed: number; pending: number; inProgress: number };
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { users } = useAppData();
  const { requests } = useLeave();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => todayStr());
  const hasGenerated = useRef(false);

  useEffect(() => {
    fetchCategories().then((c) => setCategories(c as TaskCategory[]));
    fetchTemplates().then((t) => setTemplates(t as TaskTemplate[]));
  }, []);

  const refreshTasks = useCallback(async () => {
    setLoading(true);
    const data = await fetchTasksForDate(selectedDate);
    setTasks(data.map(normalizeTask));
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    let cancelled = false;
    fetchTasksForDate(selectedDate).then((data) => {
      if (cancelled) return;
      setTasks(data.map(normalizeTask));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedDate]);

  const changeSelectedDate = useCallback((d: string) => {
    if (d === selectedDate) return;
    setLoading(true);
    setSelectedDate(d);
  }, [selectedDate]);

  useEffect(() => {
    if (hasGenerated.current || !user || !users || users.length === 0) return;
    hasGenerated.current = true;
    const today = todayStr();
    markMissedTasks(today);
    const offIds = new Set(requests.filter((r) => r.date === today && r.status === 'approved').map((r) => r.userId));

    // Bulletproof user mapping - NEVER crashes on displayName
    const working = users
      .filter((u) => u?.isActive && !offIds.has(u?.id))
      .map((u) => ({
        id: u?.id ?? 'unknown',
        name: getDisplayName(u) || 'Unknown',
        role: u?.role ?? 'staff',
        jobRoles: Array.isArray(u?.jobRole) ? u.jobRole : ['Office'],
      }))
      .filter(w => w.id && w.id !== 'unknown'); // Filter out invalid entries

    generateDailyTasks(today, working).then(count => { if (count > 0) refreshTasks(); });
  }, [user, users, requests, refreshTasks]);

  const refreshActivity = useCallback(async () => {
    try {
      const data = await fetchActivity(50);
      // Validate activity items have actor_name
      const validated = Array.isArray(data) ? data.map((a: Record<string, unknown>) => ({
        ...a,
        actor_name: getDisplayName(a) || a.actor_name || 'Unknown',
      })) : [];
      setActivity(validated as unknown as ActivityItem[]);
    } catch (err) {
      console.error('Error loading activity:', err);
      setActivity([]);
    }
  }, []);

  const createTask = useCallback(async (t: { title: string; description?: string; category_id?: string; date: string; assigned_to: string; assigned_to_name: string; priority?: string; group_id?: string; }) => {
    if (!user) return false;
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const userName = user.displayName ?? user.username ?? 'Unknown';
    // camelCase, matching generated tasks and every query on the `tasks` collection.
    const ok = await insertTask({
      id,
      title: t.title,
      description: t.description || '',
      categoryId: t.category_id || undefined,
      date: t.date,
      assignedTo: t.assigned_to,
      assignedToName: t.assigned_to_name,
      assignedBy: user.id,
      assignedByName: userName,
      priority: t.priority || 'normal',
      groupId: t.group_id || undefined,
      status: 'pending',
      hasChecklist: false,
      checklistItems: [],
    });
    if (ok) { await logActivity({ task_id: id, actor_id: user.id, actor_name: userName, action: 'created', detail: `Created "${t.title}" for ${t.assigned_to_name}` }); await refreshTasks(); }
    return ok;
  }, [user, refreshTasks]);

  const moveTask = useCallback(async (id: string, status: Task['status']) => {
    if (!user) return false;
    const userName = user.displayName ?? user.username ?? 'Unknown';
    const ok = await updateTask(id, { status });
    if (!ok) return false;
    await logActivity({ task_id: id, actor_id: user.id, actor_name: userName, action: 'status_changed', detail: `Moved to ${status}` });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    return true;
  }, [user]);

  const completeTask = useCallback(async (id: string) => {
    if (!user || !user.id) return false;
    const task = tasks.find(t => t.id === id);
    if (!task) return false;
    const now = new Date().toISOString();
    const userName = user?.displayName ?? user?.username ?? 'Unknown';
    const ok = await updateTask(id, { status: 'done', completedAt: now, completedBy: user.id, completedByName: userName });
    if (!ok) return false;
    if (task.group_id) {
      await completeGroupTasks(task.group_id, user.id, userName);
      setTasks(prev => prev.map(t => t.group_id === task.group_id ? { ...t, status: 'done', completed_at: now, completed_by: user.id, completed_by_name: userName } : t));
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done', completed_at: now, completed_by: user.id, completed_by_name: userName } : t));
    }
    await logActivity({ task_id: id, actor_id: user.id, actor_name: userName, action: 'completed', detail: `Completed "${task.title}"` });
    return true;
  }, [user, tasks]);

  const addHandoverNote = useCallback(async (id: string, note: string) => {
    if (!user) return false;
    const userName = user.displayName ?? user.username ?? 'Unknown';
    const ok = await updateTask(id, { handoverNote: note });
    if (!ok) return false;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, handover_note: note } : t));
    await logActivity({ task_id: id, actor_id: user.id, actor_name: userName, action: 'handover', detail: 'Added handover note' });
    return true;
  }, [user]);

  const updateChecklist = useCallback(async (id: string, items: { text: string; done: boolean }[]) => {
    const progress = items.length > 0 ? Math.round(items.filter(i => i.done).length / items.length * 100) : 0;
    const ok = await updateTask(id, { checklistItems: items, checklistProgress: progress });
    if (!ok) return false;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, checklist_items: items, checklist_progress: progress } : t));
    return true;
  }, []);

  const pinTask = useCallback(async (id: string, pinned: boolean) => {
    const ok = await updateTask(id, { isPinned: pinned });
    if (!ok) return false;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_pinned: pinned } : t));
    return true;
  }, []);

  const getTasksForUser = useCallback((userId: string) => tasks.filter(t => t.assigned_to === userId), [tasks]);

  const todayStats = useMemo(() => {
    const t = tasks.filter(tk => tk.date === todayStr());
    return { total: t.length, done: t.filter(tk => tk.status === 'done').length, missed: t.filter(tk => tk.status === 'missed').length, pending: t.filter(tk => tk.status === 'pending').length, inProgress: t.filter(tk => tk.status === 'in_progress').length };
  }, [tasks]);

  const value = useMemo(() => ({ tasks, categories, templates, activity, loading, selectedDate, setSelectedDate: changeSelectedDate, createTask, moveTask, completeTask, addHandoverNote, updateChecklist, pinTask, refreshTasks, refreshActivity, getTasksForUser, todayStats }), [tasks, categories, templates, activity, loading, selectedDate, changeSelectedDate, createTask, moveTask, completeTask, addHandoverNote, updateChecklist, pinTask, refreshTasks, refreshActivity, getTasksForUser, todayStats]);

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be inside TaskProvider');
  return ctx;
}
