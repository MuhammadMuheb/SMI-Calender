import { supabase } from '../lib/supabase';

export async function fetchTasksForDate(date: string) {
  const { data, error } = await supabase.from('tasks').select('*').eq('date', date)
    .order('priority').order('created_at');
  if (error) console.error('fetchTasksForDate:', error);
  return data || [];
}

export async function fetchTasksForUser(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase.from('tasks').select('*').eq('assigned_to', userId)
    .gte('date', startDate).lte('date', endDate).order('date', { ascending: false }).order('priority');
  if (error) console.error('fetchTasksForUser:', error);
  return data || [];
}

export async function fetchAllTasks(startDate: string, endDate: string) {
  const { data, error } = await supabase.from('tasks').select('*')
    .gte('date', startDate).lte('date', endDate).order('date', { ascending: false }).order('priority');
  if (error) console.error('fetchAllTasks:', error);
  return data || [];
}

export async function insertTask(task: Record<string, any>) {
  const { error } = await supabase.from('tasks').insert(task);
  if (error) console.error('insertTask:', error);
  return !error;
}

export async function updateTask(id: string, updates: Record<string, any>) {
  const { error } = await supabase.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) console.error('updateTask:', error);
  return !error;
}

export async function completeGroupTasks(groupId: string, completedBy: string, completedByName: string) {
  const now = new Date().toISOString();
  const { error } = await supabase.from('tasks').update({
    status: 'done', completed_at: now, completed_by: completedBy,
    completed_by_name: completedByName, updated_at: now,
  }).eq('group_id', groupId).neq('status', 'done');
  if (error) console.error('completeGroupTasks:', error);
  return !error;
}

export async function markMissedTasks(beforeDate: string) {
  const { error } = await supabase.from('tasks').update({
    status: 'missed', updated_at: new Date().toISOString(),
  }).lt('date', beforeDate).in('status', ['pending', 'in_progress']);
  if (error) console.error('markMissedTasks:', error);
}

export async function fetchTemplates() {
  const { data, error } = await supabase.from('task_templates').select('*').order('created_at');
  if (error) console.error('fetchTemplates:', error);
  return data || [];
}

export async function insertTemplate(t: Record<string, any>) {
  const { error } = await supabase.from('task_templates').insert(t);
  if (error) console.error('insertTemplate:', error);
  return !error;
}

export async function updateTemplate(id: string, updates: Record<string, any>) {
  const { error } = await supabase.from('task_templates').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) console.error('updateTemplate:', error);
  return !error;
}

export async function fetchCategories() {
  const { data, error } = await supabase.from('task_categories').select('*').order('sort_order');
  if (error) console.error('fetchCategories:', error);
  return data || [];
}

export async function fetchComments(taskId: string) {
  const { data, error } = await supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at');
  if (error) console.error('fetchComments:', error);
  return data || [];
}

export async function insertComment(c: Record<string, any>) {
  const { error } = await supabase.from('task_comments').insert(c);
  if (error) console.error('insertComment:', error);
  return !error;
}

export async function addReaction(commentId: string, reaction: string) {
  await supabase.from('task_comments').update({ reaction }).eq('id', commentId);
}

export async function fetchActivity(limit = 50) {
  const { data, error } = await supabase.from('task_activity').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) console.error('fetchActivity:', error);
  return data || [];
}

export async function logActivity(a: Record<string, any>) {
  await supabase.from('task_activity').insert({ id: `act_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, ...a });
}

export async function fetchAttachments(taskId: string) {
  const { data, error } = await supabase.from('task_attachments').select('*').eq('task_id', taskId).order('created_at');
  if (error) console.error('fetchAttachments:', error);
  return data || [];
}

export async function insertAttachment(a: Record<string, any>) {
  const { error } = await supabase.from('task_attachments').insert(a);
  if (error) console.error('insertAttachment:', error);
  return !error;
}

export async function generateDailyTasks(
  date: string,
  workingUsers: { id: string; name: string; role: string; jobRoles: string[] }[],
) {
  const templates = await fetchTemplates();
  const active = templates.filter((t: any) => t.is_active);
  const dow = new Date(date + 'T00:00:00').getDay();
  const dayNames = ['sun','mon','tue','wed','thu','fri','sat'];
  const dayName = dayNames[dow];
  const dom = new Date(date + 'T00:00:00').getDate();
  const existing = await fetchTasksForDate(date);
  const existKeys = new Set(existing.map((t: any) => `${t.template_id}_${t.assigned_to}`));
  const toInsert: any[] = [];
  for (const tmpl of active) {
    let gen = false;
    if (tmpl.recurrence === 'daily') gen = true;
    else if (tmpl.recurrence === 'weekdays') gen = dow >= 1 && dow <= 5;
    else if (tmpl.recurrence === `weekly_${dayName}`) gen = true;
    else if (tmpl.recurrence === 'monthly' && dom === 1) gen = true;
    if (!gen) continue;
    const targets = workingUsers.filter(u => !tmpl.assigned_role || u.jobRoles.includes(tmpl.assigned_role));
    for (const u of targets) {
      if (existKeys.has(`${tmpl.id}_${u.id}`)) continue;
      toInsert.push({
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        template_id: tmpl.id, title: tmpl.title, description: tmpl.description || '',
        category_id: tmpl.category_id, date, assigned_to: u.id, assigned_to_name: u.name,
        assigned_by: 'system', assigned_by_name: 'Auto-generated',
        priority: tmpl.priority || 'normal', has_checklist: tmpl.has_checklist || false,
        checklist_items: tmpl.checklist_items || [], status: 'pending',
      });
    }
  }
  if (toInsert.length > 0) {
    const { error } = await supabase.from('tasks').insert(toInsert);
    if (error) console.error('generateDailyTasks:', error);
  }
  return toInsert.length;
}
