import {
  collection, getDocs, query, where, orderBy, addDoc, doc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Task } from '@/features/tasks/TaskContext';

/*
 * Field naming: task documents are written in camelCase (groupId, categoryId,
 * assignedTo, assignedToName, …). Older manually created tasks were written in
 * snake_case (group_id, category_id, assigned_to, …), so reads go through
 * `normalizeTask`, which accepts both spellings (camelCase wins when both exist).
 *
 * The task `id` is always the Firestore document id. Task docs also store their
 * own `id` field (e.g. "task_123_ab"); that is kept as `legacyId` because comments
 * written before this fix point at it.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawDoc = Record<string, any>;

function pick(raw: RawDoc, camel: string, snake: string): unknown {
  return raw[camel] !== undefined ? raw[camel] : raw[snake];
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** Map a Firestore task document (either spelling) to the app's `Task` shape. */
export function normalizeTask(raw: RawDoc): Task {
  const items = pick(raw, 'checklistItems', 'checklist_items');
  const checklistItems: Task['checklist_items'] = Array.isArray(items)
    ? items.map((i: RawDoc) => ({ text: String(i?.text ?? ''), done: !!i?.done }))
    : [];
  const storedProgress = pick(raw, 'checklistProgress', 'checklist_progress');
  const progress = typeof storedProgress === 'number'
    ? storedProgress
    : checklistItems.length > 0 ? Math.round(checklistItems.filter(i => i.done).length / checklistItems.length * 100) : 0;
  const status = raw.status;
  const priority = raw.priority;
  return {
    id: String(raw.id),
    legacy_id: asString(raw.legacyId),
    template_id: asString(pick(raw, 'templateId', 'template_id')),
    group_id: asString(pick(raw, 'groupId', 'group_id')),
    title: String(raw.title ?? 'Task'),
    description: String(raw.description ?? ''),
    category_id: asString(pick(raw, 'categoryId', 'category_id')),
    date: String(raw.date ?? ''),
    assigned_to: String(pick(raw, 'assignedTo', 'assigned_to') ?? ''),
    assigned_to_name: String(pick(raw, 'assignedToName', 'assigned_to_name') ?? 'Unknown'),
    assigned_by: asString(pick(raw, 'assignedBy', 'assigned_by')),
    assigned_by_name: asString(pick(raw, 'assignedByName', 'assigned_by_name')),
    status: status === 'in_progress' || status === 'done' || status === 'missed' ? status : 'pending',
    priority: priority === 'low' || priority === 'high' || priority === 'urgent' ? priority : 'normal',
    is_pinned: !!pick(raw, 'isPinned', 'is_pinned'),
    has_checklist: !!pick(raw, 'hasChecklist', 'has_checklist') || checklistItems.length > 0,
    checklist_items: checklistItems,
    checklist_progress: progress,
    depends_on_task: asString(pick(raw, 'dependsOnTask', 'depends_on_task')),
    completed_at: asString(pick(raw, 'completedAt', 'completed_at')),
    completed_by: asString(pick(raw, 'completedBy', 'completed_by')),
    completed_by_name: asString(pick(raw, 'completedByName', 'completed_by_name')),
    handover_note: String(pick(raw, 'handoverNote', 'handover_note') ?? ''),
    notes: String(raw.notes ?? ''),
    created_at: String(pick(raw, 'createdAt', 'created_at') ?? ''),
    updated_at: String(pick(raw, 'updatedAt', 'updated_at') ?? ''),
  };
}

/** Raw task data with the Firestore document id as `id` (the stored `id` field is kept as `legacyId`). */
function taskDoc(d: { id: string; data: () => RawDoc }): RawDoc {
  const data = d.data();
  return { ...data, id: d.id, legacyId: data.id };
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
function priorityRank(p: unknown): number {
  return typeof p === 'string' && p in PRIORITY_RANK ? PRIORITY_RANK[p] : 2;
}

function byDateThenPriority(a: RawDoc, b: RawDoc) {
  const dateDiff = String(b.date || '').localeCompare(String(a.date || ''));
  if (dateDiff !== 0) return dateDiff;
  return priorityRank(a.priority) - priorityRank(b.priority);
}

export async function fetchTasksForDate(date: string): Promise<RawDoc[]> {
  try {
    const q = query(
      collection(db, 'tasks'),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    // Sort in memory to avoid composite index requirement
    return snapshot.docs
      .map(taskDoc)
      .sort((a, b) => {
        const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return String(a.createdAt || a.created_at || '').localeCompare(String(b.createdAt || b.created_at || ''));
      });
  } catch (error) {
    console.error('fetchTasksForDate:', error);
    return [];
  }
}

export async function fetchTasksForUser(userId: string, startDate: string, endDate: string): Promise<RawDoc[]> {
  try {
    // Query both spellings: older manual tasks used `assigned_to`.
    const [camel, legacy] = await Promise.all([
      getDocs(query(collection(db, 'tasks'), where('assignedTo', '==', userId))),
      getDocs(query(collection(db, 'tasks'), where('assigned_to', '==', userId))),
    ]);
    const byId = new Map<string, RawDoc>();
    for (const d of [...camel.docs, ...legacy.docs]) byId.set(d.id, taskDoc(d));
    // Filter and sort in memory to avoid composite index requirement
    return Array.from(byId.values())
      .filter((task) => task.date >= startDate && task.date <= endDate)
      .sort(byDateThenPriority);
  } catch (error) {
    console.error('fetchTasksForUser:', error);
    return [];
  }
}

export async function fetchAllTasks(startDate: string, endDate: string): Promise<RawDoc[]> {
  try {
    const q = query(
      collection(db, 'tasks')
    );
    const snapshot = await getDocs(q);
    // Filter and sort in memory to avoid composite index requirement
    return snapshot.docs
      .map(taskDoc)
      .filter((task) => task.date >= startDate && task.date <= endDate)
      .sort(byDateThenPriority);
  } catch (error) {
    console.error('fetchAllTasks:', error);
    return [];
  }
}

/** Drop `undefined` values — Firestore rejects them in writes. */
function withoutUndefined(obj: RawDoc): RawDoc {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function insertTask(task: RawDoc) {
  try {
    await addDoc(collection(db, 'tasks'), withoutUndefined({
      ...task,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    return true;
  } catch (error) {
    console.error('insertTask:', error);
    return false;
  }
}

export async function updateTask(id: string, updates: RawDoc) {
  try {
    const taskRef = doc(db, 'tasks', id);
    await updateDoc(taskRef, withoutUndefined({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
    return true;
  } catch (error) {
    console.error('updateTask:', error);
    return false;
  }
}

export async function completeGroupTasks(groupId: string, completedBy: string, completedByName: string) {
  try {
    // Equality-only queries (no composite index needed); both spellings for older tasks.
    const [camel, legacy] = await Promise.all([
      getDocs(query(collection(db, 'tasks'), where('groupId', '==', groupId))),
      getDocs(query(collection(db, 'tasks'), where('group_id', '==', groupId))),
    ]);
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    const seen = new Set<string>();

    for (const docSnap of [...camel.docs, ...legacy.docs]) {
      if (seen.has(docSnap.id) || docSnap.data().status === 'done') continue;
      seen.add(docSnap.id);
      batch.update(docSnap.ref, {
        status: 'done',
        completedAt: now,
        completedBy,
        completedByName,
        updatedAt: now,
      });
    }

    if (seen.size > 0) await batch.commit();
    return true;
  } catch (error) {
    console.error('completeGroupTasks:', error);
    return false;
  }
}

export async function markMissedTasks(beforeDate: string) {
  try {
    // Fetch all tasks and filter in memory to avoid composite index requirement
    const q = query(collection(db, 'tasks'));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    let count = 0;

    snapshot.docs
      .filter((docSnap) => {
        const data = docSnap.data();
        return data.date < beforeDate && ['pending', 'in_progress'].includes(data.status);
      })
      .forEach(docSnap => {
        count++;
        batch.update(docSnap.ref, {
          status: 'missed',
          updatedAt: now,
        });
      });

    if (count > 0) await batch.commit();
  } catch (error) {
    console.error('markMissedTasks:', error);
  }
}

export async function fetchTemplates(): Promise<RawDoc[]> {
  try {
    const q = query(collection(db, 'task_templates'), orderBy('createdAt'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('fetchTemplates:', error);
    return [];
  }
}

export async function insertTemplate(t: RawDoc) {
  try {
    await addDoc(collection(db, 'task_templates'), {
      ...t,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('insertTemplate:', error);
    return false;
  }
}

export async function updateTemplate(id: string, updates: RawDoc) {
  try {
    const ref = doc(db, 'task_templates', id);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('updateTemplate:', error);
    return false;
  }
}

export async function fetchCategories(): Promise<RawDoc[]> {
  try {
    const q = query(collection(db, 'task_categories'), orderBy('sortOrder'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('fetchCategories:', error);
    return [];
  }
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
}

/**
 * Comments for a task. Pass the Firestore id and, if the task has one, its legacy
 * stored id (older comments point at that). Reads both `taskId` and the older
 * `task_id` field. Sorted in memory to avoid a composite index.
 * Throws on failure.
 */
export async function fetchComments(taskId: string, legacyId?: string): Promise<TaskComment[]> {
  const ids = Array.from(new Set([taskId, legacyId].filter((x): x is string => !!x)));
  const [camel, legacy] = await Promise.all([
    getDocs(query(collection(db, 'task_comments'), where('taskId', 'in', ids))),
    getDocs(query(collection(db, 'task_comments'), where('task_id', 'in', ids))),
  ]);
  const byId = new Map<string, TaskComment>();
  for (const d of [...camel.docs, ...legacy.docs]) {
    const c = d.data();
    byId.set(d.id, {
      id: d.id,
      taskId: String(pick(c, 'taskId', 'task_id') ?? ''),
      userId: String(pick(c, 'userId', 'user_id') ?? ''),
      userName: String(pick(c, 'userName', 'user_name') ?? 'Unknown'),
      body: String(c.body ?? ''),
      createdAt: String(pick(c, 'createdAt', 'created_at') ?? ''),
    });
  }
  return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function insertComment(c: { taskId: string; userId: string; userName: string; body: string }) {
  try {
    await addDoc(collection(db, 'task_comments'), {
      ...c,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('insertComment:', error);
    return false;
  }
}

export async function addReaction(commentId: string, reaction: string) {
  try {
    const ref = doc(db, 'task_comments', commentId);
    await updateDoc(ref, { reaction });
  } catch (error) {
    console.error('addReaction:', error);
  }
}

export async function fetchActivity(limit = 50) {
  try {
    const q = query(
      collection(db, 'task_activity'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('fetchActivity:', error);
    return [];
  }
}

export async function logActivity(a: RawDoc) {
  try {
    await addDoc(collection(db, 'task_activity'), {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...a,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('logActivity:', error);
  }
}

export async function fetchAttachments(taskId: string) {
  try {
    const q = query(
      collection(db, 'task_attachments'),
      where('taskId', '==', taskId),
      orderBy('createdAt')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('fetchAttachments:', error);
    return [];
  }
}

export async function insertAttachment(a: RawDoc) {
  try {
    await addDoc(collection(db, 'task_attachments'), {
      ...a,
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('insertAttachment:', error);
    return false;
  }
}

export async function generateDailyTasks(
  date: string,
  workingUsers: { id: string; name: string; role: string; jobRoles: string[] }[],
) {
  try {
    const templates = await fetchTemplates();
    const active = templates.filter((t) => t.isActive);
    const dow = new Date(date + 'T00:00:00').getDay();
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = dayNames[dow];
    const dom = new Date(date + 'T00:00:00').getDate();
    const existing = await fetchTasksForDate(date);
    // Existing tasks may use either spelling.
    const existKeys = new Set(existing.map((t) => `${pick(t, 'templateId', 'template_id')}_${pick(t, 'assignedTo', 'assigned_to')}`));
    const toInsert: RawDoc[] = [];

    for (const tmpl of active) {
      let gen = false;
      if (tmpl.recurrence === 'daily') gen = true;
      else if (tmpl.recurrence === 'weekdays') gen = dow >= 1 && dow <= 5;
      else if (tmpl.recurrence === `weekly_${dayName}`) gen = true;
      else if (tmpl.recurrence === 'monthly' && dom === 1) gen = true;
      if (!gen) continue;

      const targets = workingUsers.filter(u => !tmpl.assignedRole || u.jobRoles.includes(tmpl.assignedRole));
      for (const u of targets) {
        if (existKeys.has(`${tmpl.id}_${u.id}`)) continue;
        toInsert.push({
          id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          templateId: tmpl.id,
          title: tmpl.title ?? 'Task',
          description: tmpl.description ?? '',
          categoryId: tmpl.categoryId ?? '',
          date,
          assignedTo: u.id,
          assignedToName: u.name ?? 'Unknown',
          assignedBy: 'system',
          assignedByName: 'Auto-generated',
          priority: tmpl.priority ?? 'normal',
          hasChecklist: tmpl.hasChecklist ?? false,
          checklistItems: tmpl.checklistItems ?? [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (toInsert.length > 0) {
      const batch = writeBatch(db);
      for (const task of toInsert) {
        const docRef = doc(collection(db, 'tasks'));
        batch.set(docRef, task);
      }
      await batch.commit();
    }

    return toInsert.length;
  } catch (error) {
    console.error('generateDailyTasks:', error);
    return 0;
  }
}
