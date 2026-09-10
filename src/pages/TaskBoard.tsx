import { useState, useMemo } from 'react';
import { theme } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { useTasks, type Task } from '../context/TaskContext';
import { Button, Icons } from '../components/ui';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import TaskDetailModal from '../components/tasks/TaskDetailModal';

const PRIO_C: Record<string, string> = { urgent: '#EF4444', high: '#F97316', normal: '#138A52', low: '#666666' };
const COLS: { key: Task['status']; label: string; color: string; icon: string }[] = [
  { key: 'pending', label: 'To Do', color: '#E6A800', icon: '📋' },
  { key: 'in_progress', label: 'In Progress', color: '#3B82F6', icon: '⚡' },
  { key: 'done', label: 'Done', color: '#138A52', icon: '✅' },
  { key: 'missed', label: 'Missed', color: '#B30000', icon: '❌' },
];

export default function TaskBoard() {
  const { user } = useAuth();
  const { tasks, categories, loading, selectedDate, setSelectedDate, completeTask, todayStats } = useTasks();
  const [activeCol, setActiveCol] = useState<Task['status']>('pending');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'my' | 'team'>('my');

  if (!user) return null;
  const isAdmin = user.role === 'super_admin' || user.role === 'manager';

  const filtered = useMemo(() => {
    let t = tasks;
    if (viewMode === 'my') t = t.filter(tk => tk.assigned_to === user.id);
    const po: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    return t.sort((a, b) => { if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1; return (po[a.priority]??2) - (po[b.priority]??2); });
  }, [tasks, viewMode, user.id]);

  const colTasks = useMemo(() => {
    const m: Record<string, Task[]> = {};
    for (const c of COLS) m[c.key] = filtered.filter(t => t.status === c.key);
    return m;
  }, [filtered]);

  const getCatColor = (cid?: string) => categories.find(c => c.id === cid)?.color || theme.colors.grayDark;
  const getCatName = (cid?: string) => categories.find(c => c.id === cid)?.name || '';

  const goDate = (off: number) => {
    const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + off);
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  };
  const dateLabel = new Date(selectedDate+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const renderTask = (task: Task) => {
    const cc = getCatColor(task.category_id); const cn = getCatName(task.category_id); const pc = PRIO_C[task.priority]||'#666';
    return (
      <div key={task.id} role="button" tabIndex={0}
        onClick={() => setSelectedTask(task)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTask(task); } }}
        aria-label={`${task.title}, ${task.status.replace('_', ' ')}${task.assigned_to_name ? `, assigned to ${task.assigned_to_name}` : ''}`}
        className="rounded-xl p-3 mb-2 cursor-pointer transition-all active:scale-[0.98]" style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}`, borderLeft: `3px solid ${pc}` }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {task.is_pinned && <span className="text-[9px]" aria-hidden="true">📌 </span>}
            <span className="text-xs font-medium" style={{ color: theme.colors.white, textDecoration: task.status==='done'?'line-through':'none', opacity: task.status==='done'?0.6:1 }}>{task.title}</span>
            {task.group_id && <span className="text-[9px] ml-1" style={{ color: theme.colors.primaryLight }} aria-hidden="true">👥</span>}
          </div>
          {task.status !== 'done' && task.status !== 'missed' && (
            <button type="button" onClick={(e) => { e.stopPropagation(); completeTask(task.id); }} aria-label={`Mark "${task.title}" complete`} className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer" style={{ border: `2px solid ${theme.colors.primary}` }}>
              <span style={{ color: theme.colors.primary, fontSize: 10 }} aria-hidden="true">✓</span>
            </button>
          )}
          {task.status === 'done' && <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: theme.colors.success }}><span style={{ color: '#fff', fontSize: 10 }}>✓</span></div>}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {cn && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: cc+'20', color: cc }}>{cn}</span>}
          {task.priority !== 'normal' && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: pc+'20', color: pc }}>{task.priority.toUpperCase()}</span>}
          {task.has_checklist && task.checklist_items.length > 0 && <span className="text-[8px]" style={{ color: theme.colors.grayDark }}>☑ {task.checklist_items.filter((i:any)=>i.done).length}/{task.checklist_items.length}</span>}
        </div>
        {viewMode === 'team' && (
          <div className="flex items-center gap-1 mt-1.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold" style={{ backgroundColor: theme.colors.primary+'30', color: theme.colors.primaryLight }}>{task.assigned_to_name[0]?.toUpperCase()}</div>
            <span className="text-[9px]" style={{ color: theme.colors.grayDark }}>{task.assigned_to_name}</span>
          </div>
        )}
        {task.completed_by_name && task.status === 'done' && <p className="text-[8px] mt-1" style={{ color: theme.colors.grayDark }}>Done by {task.completed_by_name}</p>}
        {task.handover_note && <p className="text-[8px] mt-1 italic" style={{ color: theme.colors.warning }}>📝 {task.handover_note}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div><h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Tasks</h2>
          <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>{todayStats.done}/{todayStats.total} done{todayStats.missed > 0 && <span style={{ color: theme.colors.danger }}> · {todayStats.missed} missed</span>}</p>
        </div>
        <Button variant="primary" size="sm" icon={Icons.plus} onClick={() => setShowCreate(true)}>New Task</Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => goDate(-1)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: theme.colors.bgElevated, color: theme.colors.gray }}>‹</button>
          <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="px-2 h-7 rounded-lg text-[10px] font-medium cursor-pointer" style={{ backgroundColor: isToday ? theme.colors.primary : theme.colors.bgElevated, color: isToday ? theme.colors.white : theme.colors.gray }}>{isToday ? 'Today' : dateLabel}</button>
          <button onClick={() => goDate(1)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: theme.colors.bgElevated, color: theme.colors.gray }}>›</button>
        </div>
        {isAdmin && (
          <div className="flex gap-1">
            <button onClick={() => setViewMode('my')} className="px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer" style={{ backgroundColor: viewMode==='my' ? theme.colors.primary : theme.colors.bgElevated, color: viewMode==='my' ? theme.colors.white : theme.colors.grayDark }}>My Tasks</button>
            <button onClick={() => setViewMode('team')} className="px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer" style={{ backgroundColor: viewMode==='team' ? theme.colors.primary : theme.colors.bgElevated, color: viewMode==='team' ? theme.colors.white : theme.colors.grayDark }}>Team</button>
          </div>
        )}
      </div>

      {loading ? <div className="py-8 text-center"><p className="text-xs" style={{ color: theme.colors.grayDark }}>Loading...</p></div> : (
        <>
          {/* MOBILE */}
          <div className="md:hidden">
            <div className="flex gap-1 mb-3">
              {COLS.map(col => (<button key={col.key} onClick={() => setActiveCol(col.key)} className="flex-1 py-1.5 rounded-lg text-[10px] font-medium cursor-pointer" style={{ backgroundColor: activeCol===col.key ? col.color+'20' : theme.colors.bgElevated, color: activeCol===col.key ? col.color : theme.colors.grayDark, border: `1px solid ${activeCol===col.key ? col.color+'50' : theme.colors.border}` }}>{col.icon} {colTasks[col.key].length}</button>))}
            </div>
            {colTasks[activeCol].length === 0 ? <div className="py-8 text-center"><p className="text-xs" style={{ color: theme.colors.grayDark }}>No tasks</p></div> : colTasks[activeCol].map(renderTask)}
          </div>
          {/* DESKTOP */}
          <div className="hidden md:grid md:grid-cols-4 gap-3">
            {COLS.map(col => (
              <div key={col.key}>
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <span className="text-xs">{col.icon}</span>
                  <span className="text-[10px] font-semibold uppercase" style={{ color: col.color }}>{col.label}</span>
                  <span className="text-[10px] px-1.5 rounded-full" style={{ backgroundColor: col.color+'20', color: col.color }}>{colTasks[col.key].length}</span>
                </div>
                <div className="rounded-xl p-2 min-h-[300px]" style={{ backgroundColor: theme.colors.bgElevated+'80' }}>
                  {colTasks[col.key].length === 0 ? <p className="text-[10px] text-center py-6" style={{ color: theme.colors.grayDarker }}>Empty</p> : colTasks[col.key].map(renderTask)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)} />
      <TaskDetailModal task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
