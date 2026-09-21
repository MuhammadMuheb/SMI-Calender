import {
  collection, getDocs, query, where, orderBy, addDoc, doc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function fetchTasksForDate(date: string) {
  try {
    const q = query(
      collection(db, 'tasks'),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    // Sort in memory to avoid composite index requirement
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .sort((a: any, b: any) => {
        const priorityDiff = (a.priority || 999) - (b.priority || 999);
        if (priorityDiff !== 0) return priorityDiff;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });
  } catch (error) {
    console.error('fetchTasksForDate:', error);
    return [];
  }
}

export async function fetchTasksForUser(userId: string, startDate: string, endDate: string) {
  try {
    const q = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', userId)
    );
    const snapshot = await getDocs(q);
    // Filter and sort in memory to avoid composite index requirement
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter((task: any) => task.date >= startDate && task.date <= endDate)
      .sort((a: any, b: any) => {
        const dateDiff = (b.date || '').localeCompare(a.date || '');
        if (dateDiff !== 0) return dateDiff;
        return (a.priority || 999) - (b.priority || 999);
      });
  } catch (error) {
    console.error('fetchTasksForUser:', error);
    return [];
  }
}

export async function fetchAllTasks(startDate: string, endDate: string) {
  try {
    const q = query(
      collection(db, 'tasks')
    );
    const snapshot = await getDocs(q);
    // Filter and sort in memory to avoid composite index requirement
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter((task: any) => task.date >= startDate && task.date <= endDate)
      .sort((a: any, b: any) => {
        const dateDiff = (b.date || '').localeCompare(a.date || '');
        if (dateDiff !== 0) return dateDiff;
        return (a.priority || 999) - (b.priority || 999);
      });
  } catch (error) {
    console.error('fetchAllTasks:', error);
    return [];
  }
}

export async function insertTask(task: Record<string, any>) {
  try {
    await addDoc(collection(db, 'tasks'), {
      ...task,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('insertTask:', error);
    return false;
  }
}

export async function updateTask(id: string, updates: Record<string, any>) {
  try {
    const taskRef = doc(db, 'tasks', id);
    await updateDoc(taskRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('updateTask:', error);
    return false;
  }
}

export async function completeGroupTasks(groupId: string, completedBy: string, completedByName: string) {
  try {
    const q = query(
      collection(db, 'tasks'),
      where('groupId', '==', groupId),
      where('status', '!=', 'done')
    );
    const snapshot = await getDocs(q);
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    snapshot.docs.forEach(docSnap => {
      batch.update(docSnap.ref, {
        status: 'done',
        completedAt: now,
        completedBy,
        completedByName,
        updatedAt: now,
      });
    });

    await batch.commit();
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

    snapshot.docs
      .filter((docSnap: any) => {
        const data = docSnap.data();
        return data.date < beforeDate && ['pending', 'in_progress'].includes(data.status);
      })
      .forEach(docSnap => {
        batch.update(docSnap.ref, {
          status: 'missed',
          updatedAt: now,
        });
      });

    await batch.commit();
  } catch (error) {
    console.error('markMissedTasks:', error);
  }
}

export async function fetchTemplates(): Promise<any[]> {
  try {
    const q = query(collection(db, 'task_templates'), orderBy('createdAt'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
  } catch (error) {
    console.error('fetchTemplates:', error);
    return [];
  }
}

export async function insertTemplate(t: Record<string, any>) {
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

export async function updateTemplate(id: string, updates: Record<string, any>) {
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

export async function fetchCategories(): Promise<any[]> {
  try {
    const q = query(collection(db, 'task_categories'), orderBy('sortOrder'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
  } catch (error) {
    console.error('fetchCategories:', error);
    return [];
  }
}

export async function fetchComments(taskId: string) {
  try {
    const q = query(
      collection(db, 'task_comments'),
      where('taskId', '==', taskId),
      orderBy('createdAt')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('fetchComments:', error);
    return [];
  }
}

export async function insertComment(c: Record<string, any>) {
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

export async function logActivity(a: Record<string, any>) {
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

export async function insertAttachment(a: Record<string, any>) {
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
    const active = templates.filter((t: any) => t.isActive);
    const dow = new Date(date + 'T00:00:00').getDay();
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = dayNames[dow];
    const dom = new Date(date + 'T00:00:00').getDate();
    const existing = await fetchTasksForDate(date);
    const existKeys = new Set(existing.map((t: any) => `${t.templateId}_${t.assignedTo}`));
    const toInsert: any[] = [];

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
