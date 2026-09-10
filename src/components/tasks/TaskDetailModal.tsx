import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Badge } from '../ui';
import { theme } from '../../config/theme';
import { useAuth } from '../../context/AuthContext';
import { useTasks, type Task } from '../../context/TaskContext';
import { fetchComments, insertComment } from '../../services/taskService';

interface Props { task: Task | null; open: boolean; onClose: () => void; }
const PRIO_C: Record<string, string> = { urgent: '#EF4444', high: '#F97316', normal: '#138A52', low: '#666666' };
const STAT: Record<string, { l: string; c: string }> = { pending: { l: 'To Do', c: '#E6A800' }, in_progress: { l: 'In Progress', c: '#3B82F6' }, done: { l: 'Done', c: '#138A52' }, missed: { l: 'Missed', c: '#B30000' } };

export default function TaskDetailModal({ task, open, onClose }: Props) {
  const { user } = useAuth();
  const { completeTask, moveTask, addHandoverNote, updateChecklist, pinTask, categories } = useTasks();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [handover, setHandover] = useState('');
  const [showHandover, setShowHandover] = useState(false);

  const loadComments = useCallback(async () => { if (task) setComments(await fetchComments(task.id)); }, [task]);
  useEffect(() => { if (task && open) loadComments(); }, [task, open, loadComments]);

  if (!task || !user) return null;
  const st = STAT[task.status] || STAT.pending;
  const cat = categories.find(c => c.id === task.category_id);
  const pc = PRIO_C[task.priority] || '#666';
  const canAct = task.status !== 'done' && task.status !== 'missed';

  const handleComment = async () => {
    if (!newComment.trim()) return;
    await insertComment({ id: `cmt_${Date.now()}`, task_id: task.id, user_id: user.id, user_name: user.displayName, body: newComment.trim() });
    setNewComment(''); loadComments();
  };

  const handleHandover = async () => {
    if (!handover.trim()) return;
    await addHandoverNote(task.id, handover.trim());
    setShowHandover(false); setHandover('');
  };

  const toggleCheck = async (idx: number) => {
    const items = [...(task.checklist_items || [])];
    items[idx] = { ...items[idx], done: !items[idx].done };
    await updateChecklist(task.id, items);
  };

  return (
    <Modal open={open} onClose={onClose} title="Task Details" footer={canAct ? (
      <div className="flex gap-2 w-full">
        {task.status === 'pending' && <Button variant="outline" size="sm" onClick={() => moveTask(task.id, 'in_progress')}>⚡ Start</Button>}
        <Button variant="primary" size="sm" onClick={() => { completeTask(task.id); onClose(); }}>✅ Complete</Button>
      </div>
    ) : undefined}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge color={task.status === 'done' ? 'success' : task.status === 'missed' ? 'danger' : 'warning'} size="xs">{st.l}</Badge>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: pc+'20', color: pc }}>{task.priority.toUpperCase()}</span>
        {cat && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: cat.color+'20', color: cat.color }}>{cat.name}</span>}
        {task.group_id && <span className="text-[9px]" style={{ color: theme.colors.primaryLight }}>👥 Group</span>}
        {task.is_pinned && <span className="text-[9px]">📌</span>}
      </div>

      <h3 className="text-sm font-bold mb-1" style={{ color: theme.colors.white }}>{task.title}</h3>
      {task.description && <p className="text-[10px] mb-3" style={{ color: theme.colors.gray }}>{task.description}</p>}

      <div className="space-y-1 mb-3">
        <MR l="Assigned to" v={task.assigned_to_name} />
        {task.assigned_by_name && <MR l="Assigned by" v={task.assigned_by_name} />}
        <MR l="Date" v={new Date(task.date+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} />
        {task.completed_by_name && <MR l="Completed by" v={task.completed_by_name} />}
        {task.completed_at && <MR l="Completed at" v={new Date(task.completed_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} />}
      </div>

      {task.has_checklist && task.checklist_items.length > 0 && (
        <div className="mb-3 p-2 rounded-lg" style={{ backgroundColor: theme.colors.bgElevated }}>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold" style={{ color: theme.colors.gray }}>Checklist</p>
            <span className="text-[9px]" style={{ color: theme.colors.primaryLight }}>{task.checklist_items.filter((i:any)=>i.done).length}/{task.checklist_items.length}</span>
          </div>
          <div className="w-full h-1 rounded-full mb-2" style={{ backgroundColor: theme.colors.border }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${task.checklist_progress||0}%`, backgroundColor: theme.colors.primary }} />
          </div>
          {task.checklist_items.map((item:any, i:number) => (
            <button key={i} onClick={() => canAct && toggleCheck(i)} className="flex items-center gap-2 w-full text-left py-1 cursor-pointer">
              <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ border: `1.5px solid ${item.done ? theme.colors.primary : theme.colors.grayDark}`, backgroundColor: item.done ? theme.colors.primary : 'transparent' }}>
                {item.done && <span style={{ color: '#fff', fontSize: 8 }}>✓</span>}
              </div>
              <span className="text-[10px]" style={{ color: item.done ? theme.colors.grayDark : theme.colors.white, textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
            </button>
          ))}
        </div>
      )}

      {task.handover_note && (
        <div className="mb-3 p-2 rounded-lg" style={{ backgroundColor: theme.colors.warning+'10', border: `1px solid ${theme.colors.warning}30` }}>
          <p className="text-[9px] font-semibold mb-0.5" style={{ color: theme.colors.warning }}>📝 Handover</p>
          <p className="text-[10px]" style={{ color: theme.colors.gray }}>{task.handover_note}</p>
        </div>
      )}

      {canAct && !showHandover && <button onClick={() => setShowHandover(true)} className="text-[10px] mb-3 cursor-pointer block" style={{ color: theme.colors.warning }}>+ Add handover note</button>}
      {showHandover && (
        <div className="mb-3 space-y-1.5">
          <textarea value={handover} onChange={(e) => setHandover(e.target.value)} placeholder="Why wasn't this done?" className="w-full rounded-lg text-[10px] outline-none px-3 py-2 resize-none" rows={2} style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}`, color: theme.colors.white }} />
          <div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => setShowHandover(false)}>Cancel</Button><Button variant="primary" size="sm" onClick={handleHandover}>Save</Button></div>
        </div>
      )}

      {canAct && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button onClick={() => pinTask(task.id, !task.is_pinned)} className="px-2 py-1 rounded-lg text-[9px] cursor-pointer" style={{ backgroundColor: theme.colors.bgElevated, color: theme.colors.gray, border: `1px solid ${theme.colors.border}` }}>{task.is_pinned ? '📌 Unpin' : '📌 Pin'}</button>
          {task.status === 'in_progress' && <button onClick={() => moveTask(task.id, 'pending')} className="px-2 py-1 rounded-lg text-[9px] cursor-pointer" style={{ backgroundColor: theme.colors.bgElevated, color: theme.colors.gray, border: `1px solid ${theme.colors.border}` }}>← Back to To Do</button>}
        </div>
      )}

      <div className="border-t pt-3" style={{ borderColor: theme.colors.border }}>
        <p className="text-[10px] font-semibold mb-2" style={{ color: theme.colors.gray }}>Comments ({comments.length})</p>
        <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
          {comments.map((c:any) => (
            <div key={c.id} className="p-2 rounded-lg" style={{ backgroundColor: theme.colors.bgElevated }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold" style={{ color: theme.colors.primaryLight }}>{c.user_name}</span>
                <span className="text-[8px]" style={{ color: theme.colors.grayDarker }}>{new Date(c.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
              </div>
              <p className="text-[10px]" style={{ color: theme.colors.white }}>{c.body}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." onKeyDown={(e) => e.key==='Enter' && handleComment()} className="flex-1 rounded-lg text-[10px] outline-none px-3 py-2" style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}`, color: theme.colors.white }} />
          <Button variant="primary" size="sm" onClick={handleComment} disabled={!newComment.trim()}>Send</Button>
        </div>
      </div>
    </Modal>
  );
}

function MR({ l, v }: { l: string; v: string }) {
  return <div className="flex justify-between"><span className="text-[9px] uppercase" style={{ color: theme.colors.grayDark }}>{l}</span><span className="text-[10px]" style={{ color: theme.colors.white }}>{v}</span></div>;
}
