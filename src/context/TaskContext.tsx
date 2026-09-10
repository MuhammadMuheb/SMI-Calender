import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useAppData } from './AppDataContext';
import { useLeave } from './LeaveContext';
import { fetchTasksForDate, insertTask, updateTask, completeGroupTasks, markMissedTasks, fetchCategories, fetchTemplates, logActivity, generateDailyTasks, fetchActivity } from '../services/taskService';

export interface Task {
  id: string; template_id?: string; group_id?: string; title: string; description: string;
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
export interface TaskTemplate { id: string; title: string; description: string; category_id?: string; assigned_role?: string; priority: string; recurrence: string; has_checklist: boolean; checklist_items: any[]; depends_on_template?: string; is_active: boolean; created_by: string; created_at: string; }
export interface ActivityItem { id: string; task_id?: string; actor_id: string; actor_name: string; action: string; detail: string; created_at: string; }

interface TaskContextValue {
  tasks: Task[]; categories: TaskCategory[]; templates: TaskTemplate[]; activity: ActivityItem[];
  loading: boolean; selectedDate: string; setSelectedDate: (d: string) => void;
  createTask: (t: { title: string; description?: string; category_id?: string; date: string; assigned_to: string; assigned_to_name: string; priority?: string; group_id?: string; }) => Promise<boolean>;
  moveTask: (id: string, status: Task['status']) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  addHandoverNote: (id: string, note: string) => Promise<void>;
  updateChecklist: (id: string, items: { text: string; done: boolean }[]) => Promise<void>;
  pinTask: (id: string, pinned: boolean) => Promise<void>;
  refreshTasks: () => Promise<void>; refreshActivity: () => Promise<void>;
  getTasksForUser: (userId: string) => Task[];
  todayStats: { total: number; done: number; missed: number; pending: number; inProgress: number };
}

const TaskContext = createContext<TaskContextValue | null>(null);

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { users } = useAppData();
  const { requests } = useLeave();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => { fetchCategories().then(setCategories); fetchTemplates().then(setTemplates); }, []);

  const refreshTasks = useCallback(async () => {
    setLoading(true);
    const data = await fetchTasksForDate(selectedDate);
    setTasks(data as Task[]);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { refreshTasks(); }, [refreshTasks]);

  useEffect(() => {
    if (hasGenerated || !user || !users || users.length === 0) return;
    setHasGenerated(true);
    const today = todayStr();
    markMissedTasks(today);
    const offIds = new Set(requests.filter((r: any) => r.date === today && r.status === 'approved').map((r: any) => r.userId));
    const working = users.filter((u: any) => u.isActive && !offIds.has(u.id)).map((u: any) => ({
      id: u.id, name: u.displayName, role: u.role, jobRoles: (u as any).jobRole || ['Office'],
    }));
    generateDailyTasks(today, working).then(count => { if (count > 0) refreshTasks(); });
  }, [user, users, requests, hasGenerated, refreshTasks]);

  const refreshActivity = useCallback(async () => { setActivity(await fetchActivity(50) as ActivityItem[]); }, []);

  const createTask = useCallback(async (t: { title: string; description?: string; category_id?: string; date: string; assigned_to: string; assigned_to_name: string; priority?: string; group_id?: string; }) => {
    if (!user) return false;
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const ok = await insertTask({ id, title: t.title, description: t.description || '', category_id: t.category_id, date: t.date, assigned_to: t.assigned_to, assigned_to_name: t.assigned_to_name, assigned_by: user.id, assigned_by_name: user.displayName, priority: t.priority || 'normal', group_id: t.group_id });
    if (ok) { await logActivity({ task_id: id, actor_id: user.id, actor_name: user.displayName, action: 'created', detail: `Created "${t.title}" for ${t.assigned_to_name}` }); await refreshTasks(); }
    return ok;
  }, [user, refreshTasks]);

  const moveTask = useCallback(async (id: string, status: Task['status']) => {
    if (!user) return;
    await updateTask(id, { status });
    await logActivity({ task_id: id, actor_id: user.id, actor_name: user.displayName, action: 'status_changed', detail: `Moved to ${status}` });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }, [user]);

  const completeTask = useCallback(async (id: string) => {
    if (!user) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const now = new Date().toISOString();
    await updateTask(id, { status: 'done', completed_at: now, completed_by: user.id, completed_by_name: user.displayName });
    if (task.group_id) {
      await completeGroupTasks(task.group_id, user.id, user.displayName);
      setTasks(prev => prev.map(t => t.group_id === task.group_id ? { ...t, status: 'done', completed_at: now, completed_by: user.id, completed_by_name: user.displayName } : t));
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done', completed_at: now, completed_by: user.id, completed_by_name: user.displayName } : t));
    }
    await logActivity({ task_id: id, actor_id: user.id, actor_name: user.displayName, action: 'completed', detail: `Completed "${task.title}"` });
  }, [user, tasks]);

  const addHandoverNote = useCallback(async (id: string, note: string) => {
    if (!user) return;
    await updateTask(id, { handover_note: note });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, handover_note: note } : t));
    await logActivity({ task_id: id, actor_id: user.id, actor_name: user.displayName, action: 'handover', detail: 'Added handover note' });
  }, [user]);

  const updateChecklist = useCallback(async (id: string, items: { text: string; done: boolean }[]) => {
    const progress = items.length > 0 ? Math.round(items.filter(i => i.done).length / items.length * 100) : 0;
    await updateTask(id, { checklist_items: items, checklist_progress: progress });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, checklist_items: items, checklist_progress: progress } : t));
  }, []);

  const pinTask = useCallback(async (id: string, pinned: boolean) => {
    await updateTask(id, { is_pinned: pinned });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_pinned: pinned } : t));
  }, []);

  const getTasksForUser = useCallback((userId: string) => tasks.filter(t => t.assigned_to === userId), [tasks]);

  const todayStats = useMemo(() => {
    const t = tasks.filter(tk => tk.date === todayStr());
    return { total: t.length, done: t.filter(tk => tk.status === 'done').length, missed: t.filter(tk => tk.status === 'missed').length, pending: t.filter(tk => tk.status === 'pending').length, inProgress: t.filter(tk => tk.status === 'in_progress').length };
  }, [tasks]);

  const value = useMemo(() => ({ tasks, categories, templates, activity, loading, selectedDate, setSelectedDate, createTask, moveTask, completeTask, addHandoverNote, updateChecklist, pinTask, refreshTasks, refreshActivity, getTasksForUser, todayStats }), [tasks, categories, templates, activity, loading, selectedDate, createTask, moveTask, completeTask, addHandoverNote, updateChecklist, pinTask, refreshTasks, refreshActivity, getTasksForUser, todayStats]);

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be inside TaskProvider');
  return ctx;
}
