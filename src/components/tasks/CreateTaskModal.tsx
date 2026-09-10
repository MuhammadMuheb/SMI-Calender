import { useState } from 'react';
import { Modal, Button, FormInput, Badge } from '../ui';
import { theme } from '../../config/theme';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { useAppData } from '../../context/AppDataContext';

interface Props { open: boolean; onClose: () => void; }

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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;
  const activeUsers = users.filter(u => u.isActive);
  const toggleUser = (id: string) => setAssignedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSubmit = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    if (assignedIds.length === 0) { setError('Assign to at least one person'); return; }
    setSubmitting(true);
    const groupId = assignedIds.length > 1 ? `grp_${Date.now()}` : undefined;
    let allOk = true;
    for (const uid of assignedIds) {
      const u = activeUsers.find(x => x.id === uid);
      if (!u) continue;
      const ok = await createTask({ title: title.trim(), description: description.trim(), category_id: categoryId || undefined, date, assigned_to: uid, assigned_to_name: u.displayName, priority, group_id: groupId });
      if (!ok) allOk = false;
    }
    setSubmitting(false);
    if (allOk) { setSuccess(true); setTimeout(() => { setSuccess(false); resetForm(); onClose(); }, 800); }
    else setError('Failed to create task');
  };

  const resetForm = () => { setTitle(''); setDescription(''); setCategoryId(''); setPriority('normal'); setAssignedIds([]); setDate(selectedDate); setError(''); setSuccess(false); };
  const handleClose = () => { resetForm(); onClose(); };
  const PRIOS = [{v:'low',l:'Low',c:'#666666'},{v:'normal',l:'Normal',c:'#138A52'},{v:'high',l:'High',c:'#F97316'},{v:'urgent',l:'Urgent',c:'#EF4444'}];

  return (
    <Modal open={open} onClose={handleClose} title="New Task" footer={<><Button variant="outline" onClick={handleClose}>Cancel</Button><Button variant="primary" onClick={handleSubmit} disabled={submitting}>{submitting ? '...' : 'Create Task'}</Button></>}>
      <div className="space-y-3">
        <FormInput label="Title" placeholder="What needs to be done?" value={title} onChange={(e) => { setTitle(e.target.value); setError(''); }} />
        <FormInput label="Description (optional)" placeholder="Details..." value={description} onChange={(e) => setDescription(e.target.value)} />
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.gray }}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg text-sm outline-none px-3 py-2" style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}`, color: theme.colors.white, colorScheme: 'dark' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.gray }}>Category</label>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCategoryId('')} className="px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer" style={{ backgroundColor: !categoryId ? theme.colors.primary+'20' : theme.colors.bgCard, color: !categoryId ? theme.colors.primary : theme.colors.grayDark, border: `1px solid ${!categoryId ? theme.colors.primary : theme.colors.border}` }}>None</button>
            {categories.map(cat => (<button key={cat.id} onClick={() => setCategoryId(cat.id)} className="px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer" style={{ backgroundColor: categoryId===cat.id ? cat.color+'20' : theme.colors.bgCard, color: categoryId===cat.id ? cat.color : theme.colors.grayDark, border: `1px solid ${categoryId===cat.id ? cat.color : theme.colors.border}` }}>{cat.name}</button>))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.gray }}>Priority</label>
          <div className="flex gap-1.5">
            {PRIOS.map(p => (<button key={p.v} onClick={() => setPriority(p.v)} className="flex-1 py-1.5 rounded-lg text-[10px] font-medium cursor-pointer" style={{ backgroundColor: priority===p.v ? p.c+'20' : theme.colors.bgCard, color: priority===p.v ? p.c : theme.colors.grayDark, border: `1px solid ${priority===p.v ? p.c : theme.colors.border}` }}>{p.l}</button>))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.gray }}>Assign to {assignedIds.length > 1 && <span style={{ color: theme.colors.primaryLight }}>— Group ({assignedIds.length})</span>}</label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {activeUsers.map(u => { const sel = assignedIds.includes(u.id); return (<button key={u.id} onClick={() => toggleUser(u.id)} className="px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer" style={{ backgroundColor: sel ? theme.colors.primary+'20' : theme.colors.bgCard, color: sel ? theme.colors.primaryLight : theme.colors.grayDark, border: `1px solid ${sel ? theme.colors.primary : theme.colors.border}` }}>{sel && '✓ '}{u.displayName}</button>); })}
          </div>
          <button onClick={() => setAssignedIds([user.id])} className="text-[9px] mt-1 cursor-pointer" style={{ color: theme.colors.primary }}>Assign to myself</button>
        </div>
        {error && <p className="text-xs" style={{ color: theme.colors.danger }}>{error}</p>}
        {success && <Badge color="success">Created!</Badge>}
      </div>
    </Modal>
  );
}
