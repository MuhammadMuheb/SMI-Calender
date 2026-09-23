import {
  createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode,
} from 'react';
import type { StaffUser } from '@/models/user';
import type { JobRole, StaffRoleAssignment } from '@/models/jobRole';
import type { StaffingRule } from '@/models/staffing';
import type { Holiday, SpecialDay } from '@/models/holiday';
import type { NotificationSettings } from '@/models/notification';
import type { TourAssignment } from '@/models/tourAssignment';
import type { Schedule } from '@/models/schedule';
import { getSafeUsers, SAFE_EMPTY_USERS } from '@/utils/safeFallbacks';
import { validateUsers } from '@/utils/dataValidation';
import {
  fetchUsers, insertUser, updateUserDb, deleteUserDb,
  deleteUserRoleAssignments, deleteUserLeaveRequests, deleteUserCheckIns,
  deleteUserTourAssignments, deleteUserTasks,
  deleteUserWithDataHandling as deleteUserService,
} from '@/services/firestore/users';
import {
  fetchJobRoles, insertJobRole, updateJobRoleDb, deleteJobRoleDb,
  fetchRoleAssignments, deleteRoleAssignmentDb,
} from '@/services/firestore/roles';
import {
  fetchStaffingRules, insertStaffingRule, updateStaffingRuleDb, deleteStaffingRuleDb,
} from '@/services/firestore/staffingRules';
import {
  fetchHolidays, fetchSpecialDays, insertSpecialDay, deleteSpecialDayDb,
  fetchNotificationSettings, updateNotificationSettingsDb,
} from '@/services/firestore/settings';
import {
  fetchTourAssignments,
  insertAuditLog,
  fetchSchedules,
  insertSchedulesBatch,
} from '@/services/firestore/core';
import { collection, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

/**
 * STATUS: FIREBASE FIRESTORE ONLY
 * Loads all data from Firestore on mount.
 * All mutations write to both local state AND Firestore.
 * Empty collections remain empty; imports are explicit administrator actions.
 */

interface AppDataContextValue {
  loading: boolean;
  users: StaffUser[];
  addUser: (user: Omit<StaffUser, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => Promise<string>;
  updateUser: (id: string, updates: Partial<StaffUser>, actorName: string) => Promise<void>;
  deleteUser: (id: string, actorName: string) => Promise<void>;
  deleteUserWithDataHandling: (id: string, mode: 'hard_delete' | 'soft_delete', actorName: string) => Promise<void>;
  jobRoles: JobRole[];
  addJobRole: (role: Omit<JobRole, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => Promise<void>;
  updateJobRole: (id: string, updates: Partial<JobRole>, actorName: string) => Promise<void>;
  deleteJobRole: (id: string, actorName: string) => Promise<void>;
  roleAssignments: StaffRoleAssignment[];
  assignRole: (userId: string, jobRoleId: string, isPrimary: boolean, actorName: string) => Promise<void>;
  removeRoleAssignment: (id: string, actorName: string) => Promise<void>;
  staffingRules: StaffingRule[];
  addStaffingRule: (rule: Omit<StaffingRule, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => Promise<void>;
  updateStaffingRule: (id: string, updates: Partial<StaffingRule>, actorName: string) => Promise<void>;
  deleteStaffingRule: (id: string, actorName: string) => Promise<void>;
  holidays: Holiday[];
  specialDays: SpecialDay[];
  tourAssignments: TourAssignment[];
  addSpecialDay: (day: Omit<SpecialDay, 'id' | 'createdAt'>, actorName: string) => Promise<void>;
  deleteSpecialDay: (id: string, actorName: string) => Promise<void>;
  schedules: Schedule[];
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (updates: Partial<NotificationSettings>, actorId: string, actorName: string) => Promise<void>;
  refreshData: () => void;
  seedSchedules: (schedules: Schedule[]) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<StaffRoleAssignment[]>([]);
  const [staffingRules, setStaffingRules] = useState<StaffingRule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [tourAssignments, setTourAssignments] = useState<TourAssignment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    dailyReminderTime: '14:00', dailyReminderEnabled: true, updatedAt: '', updatedBy: '',
  });

  const now = () => new Date().toISOString();

  // Load all data from Firestore on mount
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch everything in parallel; a failure in one collection must not block the rest.
      const safe = <T,>(label: string, p: Promise<T>, fallback: T): Promise<T> =>
        p.catch((err) => { console.error(`${label} error:`, err); return fallback; });
      const [u, jrFetched, ra, sr, h, sd, ns, ta, sched] = await Promise.all([
        safe('fetchUsers', fetchUsers(), [] as StaffUser[]),
        safe('fetchJobRoles', fetchJobRoles(), [] as JobRole[]),
        safe('fetchRoleAssignments', fetchRoleAssignments(), [] as StaffRoleAssignment[]),
        safe('fetchStaffingRules', fetchStaffingRules(), [] as StaffingRule[]),
        safe('fetchHolidays', fetchHolidays(), [] as Holiday[]),
        safe('fetchSpecialDays', fetchSpecialDays(), [] as SpecialDay[]),
        safe('fetchNotificationSettings', fetchNotificationSettings(),
          { dailyReminderTime: '14:00', dailyReminderEnabled: true, updatedAt: '', updatedBy: '' } as NotificationSettings),
        safe('fetchTourAssignments', fetchTourAssignments(), [] as TourAssignment[]),
        safe('fetchSchedules', fetchSchedules(), [] as Schedule[]),
      ]);

      // Deleted/inactive users are hidden from every view.
      const activeUsers = u.filter((user) => user.isActive);
      const jr: JobRole[] = jrFetched;

      // CRITICAL: Use only ACTIVE users - filter out all deleted/inactive
      const validatedUsers = validateUsers(Array.isArray(activeUsers) ? activeUsers : SAFE_EMPTY_USERS);
      setUsers(validatedUsers);

      setJobRoles(Array.isArray(jr) ? jr : []);
      const finalRoleAssignments = Array.isArray(ra) ? ra : [];

      setRoleAssignments(finalRoleAssignments.filter(a => activeUsers.some(u => u.id === a.userId)));
      setStaffingRules(Array.isArray(sr) ? sr : []);
      setHolidays(Array.isArray(h) ? h : []);
      setSpecialDays(Array.isArray(sd) ? sd : []);
      setNotificationSettings(ns || { dailyReminderTime: '14:00', dailyReminderEnabled: true, updatedAt: '', updatedBy: '' });
      setTourAssignments(Array.isArray(ta) ? ta : []);
      const scheduleData = Array.isArray(sched) ? sched : [];
      setSchedules(scheduleData);

    } catch (err) {
      console.error('Failed to load app data:', err);
    }
    setLoading(false);
  }, []);

  // Initial fetch; loadData only sets state after its awaits resolve.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    let running = false;
    let queued = false;
    const refresh = async () => {
      if (stopped) return;
      if (running) { queued = true; return; }
      running = true;
      await loadData();
      running = false;
      if (queued && !stopped) { queued = false; void refresh(); }
    };
    const stops = ['users', 'jobRoles', 'role_assignments', 'staffing_rules', 'holidays', 'special_days', 'notificationSettings', 'tour_assignments', 'schedules'].map(name =>
      onSnapshot(collection(db, name), () => { clearTimeout(timer); timer = setTimeout(() => void refresh(), 80); }, () => toast.error('Live updates disconnected. Please reload.')));
    return () => { stopped = true; clearTimeout(timer); stops.forEach(stop => stop()); };
  }, [loadData]);

  // ─── Users ───────────────────────────────────────────
  const addUser = useCallback(async (user: Omit<StaffUser, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => {
    const id = `usr_${Date.now()}`;
    const newUser: StaffUser = { ...user, pin: '', id, createdAt: now(), updatedAt: now() };
    // CRITICAL: Always filter through getSafeUsers
    await insertUser({ id, username: user.username, displayName: user.displayName, pin: user.pin, role: user.role });
    setUsers((prev) => getSafeUsers([...prev, newUser]));
    await insertAuditLog({ actorId: 'admin', actorName, action: 'user_created', entityType: 'user', entityId: id, description: `Created user ${newUser.displayName}` });
    return id;
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<StaffUser>, actorName: string) => {
    // CRITICAL: Always filter through getSafeUsers
    await updateUserDb(id, updates);
    setUsers((prev) => getSafeUsers(prev.map((u) => u.id === id ? { ...u, ...updates, pin: '', updatedAt: now() } : u)));
    await insertAuditLog({ actorId: 'admin', actorName, action: 'user_updated', entityType: 'user', entityId: id, description: `Updated user ${id}` });
  }, []);

  const deleteUser = useCallback(async (id: string, actorName: string) => {
    const deletedUser = users.find((u) => u.id === id);
    if (!deletedUser) {
      throw new Error(`User ${id} not found in local state - cannot delete`);
    }

    try {
      // Delete user from Firestore (fast, no retries)
      await deleteUserDb(id);

      // Update UI immediately (user sees instant feedback)
      setUsers((prev) => getSafeUsers(prev.filter((u) => u.id !== id)));

      // Run cleanup in parallel background (don't await)
      Promise.all([
        deleteUserRoleAssignments(id),
        deleteUserLeaveRequests(id),
        deleteUserCheckIns(id),
        deleteUserTourAssignments(id),
        deleteUserTasks(id),
        insertAuditLog({
          actorId: 'admin',
          actorName,
          action: 'user_deleted',
          entityType: 'user',
          entityId: id,
          description: `Deleted user "${deletedUser.displayName}" (${deletedUser.username})`
        })
      ]).catch(err => console.warn(`Background cleanup had issues:`, err));
    } catch (err) {
      console.error('Deletion failed:', err);
      throw err;
    }
  }, [users]);

  // Enhanced deletion with user choice: HARD DELETE (wipe all) or SOFT DELETE (archive)
  const deleteUserWithDataHandling = useCallback(async (
    id: string,
    mode: 'hard_delete' | 'soft_delete',
    actorName: string
  ) => {
    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) {
      throw new Error(`User ${id} not found in local state`);
    }

    try {
      // Call the service function that handles both deletion modes
      await deleteUserService(id, mode);

      if (mode === 'hard_delete') {
        // Hard delete: remove user from state completely
        setUsers((prev) => getSafeUsers(prev.filter((u) => u.id !== id)));
      } else {
        // Soft delete: mark as inactive in state
        setUsers((prev) => getSafeUsers(
          prev.map((u) => u.id === id ? { ...u, isActive: false } : u)
        ));
      }

      // Log audit trail
      insertAuditLog({
        actorId: 'admin',
        actorName,
        action: mode === 'hard_delete' ? 'user_deleted_hard' : 'user_deleted_soft',
        entityType: 'user',
        entityId: id,
        description: `${mode === 'hard_delete' ? 'Permanently deleted' : 'Archived'} user "${targetUser.displayName}" (${targetUser.username})`
      }).catch(err => console.warn('Audit log failed:', err));

    } catch (err) {
      console.error(`User ${mode} deletion failed:`, err);
      throw err;
    }
  }, [users]);

  // ─── Job Roles ───────────────────────────────────────
  const addJobRole = useCallback(async (role: Omit<JobRole, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => {
    const id = `role_${Date.now()}`;
    const newRole: JobRole = { ...role, id, createdAt: now(), updatedAt: now() };
    await insertJobRole({ id, name: role.name, color: role.color, isHidden: role.isHidden, shiftStart: role.shiftStartTime, shiftEnd: role.shiftEndTime });
    setJobRoles((prev) => [...prev, newRole]);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'role_assigned', entityType: 'user', entityId: id, description: `Created job role ${newRole.name}` });
  }, []);

  const updateJobRole = useCallback(async (id: string, updates: Partial<JobRole>, actorName: string) => {
    await updateJobRoleDb(id, updates);
    setJobRoles((prev) => prev.map((r) => r.id === id ? { ...r, ...updates, updatedAt: now() } : r));
    await insertAuditLog({ actorId: 'admin', actorName, action: 'role_assigned', entityType: 'user', entityId: id, description: `Updated job role ${id}` });
  }, []);

  const deleteJobRole = useCallback(async (id: string, actorName: string) => {
    await deleteJobRoleDb(id);
    setJobRoles((prev) => prev.filter((r) => r.id !== id));
    setRoleAssignments((prev) => prev.filter((a) => a.jobRoleId !== id));
    await insertAuditLog({ actorId: 'admin', actorName, action: 'role_removed', entityType: 'user', entityId: id, description: `Deleted job role ${id}` });
  }, []);

  // ─── Role Assignments ────────────────────────────────
  const assignRole = useCallback(async (userId: string, jobRoleId: string, isPrimary: boolean, actorName: string) => {
    const existing = roleAssignments.find((a) => a.userId === userId && a.jobRoleId === jobRoleId);
    const id = existing?.id ?? `assign_${crypto.randomUUID()}`;
    const batch = writeBatch(db);
    if (isPrimary) roleAssignments.filter(a => a.userId === userId && a.id !== id && a.isPrimary).forEach(a => batch.update(doc(db, 'role_assignments', a.id), { isPrimary: false }));
    batch.set(doc(db, 'role_assignments', id), { id, userId, jobRoleId, isPrimary, assignedAt: now() });
    await batch.commit();
    const newAssign = { id, userId, jobRoleId, isPrimary, assignedAt: now() };
    setRoleAssignments((prev) => [...prev.filter(a => a.id !== id).map(a => isPrimary && a.userId === userId ? { ...a, isPrimary: false } : a), newAssign]);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'role_assigned', entityType: 'role_assignment', entityId: id, description: `Assigned role ${jobRoleId} to user ${userId}` });
  }, [roleAssignments]);

  const removeRoleAssignment = useCallback(async (id: string, actorName: string) => {
    const assignment = roleAssignments.find((a) => a.id === id);
    setRoleAssignments((prev) => prev.filter((a) => a.id !== id));
    if (assignment) {
      await deleteRoleAssignmentDb(id);
      await insertAuditLog({ actorId: 'admin', actorName, action: 'role_unassigned', entityType: 'role_assignment', entityId: id, description: `Removed role assignment ${id}` });
    }
  }, [roleAssignments]);

  // ─── Staffing Rules ──────────────────────────────────
  const addStaffingRule = useCallback(async (rule: Omit<StaffingRule, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => {
    const id = `sr_${Date.now()}`;
    const newRule: StaffingRule = { ...rule, id, createdAt: now(), updatedAt: now() };
    await insertStaffingRule({ id, jobRoleId: rule.jobRoleId, dayOfWeek: rule.dayOfWeek, minimumRequired: rule.minimumRequired, enforcement: rule.enforcement });
    setStaffingRules((prev) => [...prev, newRule]);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'staffing_rule_created', entityType: 'staffing_rule', entityId: id, description: `Created staffing rule` });
  }, []);

  const updateStaffingRule = useCallback(async (id: string, updates: Partial<StaffingRule>, actorName: string) => {
    await updateStaffingRuleDb(id, updates);
    setStaffingRules((prev) => prev.map((r) => r.id === id ? { ...r, ...updates, updatedAt: now() } : r));
    await insertAuditLog({ actorId: 'admin', actorName, action: 'staffing_rule_updated', entityType: 'staffing_rule', entityId: id, description: `Updated staffing rule ${id}` });
  }, []);

  const deleteStaffingRule = useCallback(async (id: string, actorName: string) => {
    await deleteStaffingRuleDb(id);
    setStaffingRules((prev) => prev.filter((r) => r.id !== id));
    await insertAuditLog({ actorId: 'admin', actorName, action: 'staffing_rule_deleted', entityType: 'staffing_rule', entityId: id, description: `Deleted staffing rule ${id}` });
  }, []);

  // ─── Special Days ────────────────────────────────────
  const addSpecialDay = useCallback(async (day: Omit<SpecialDay, 'id' | 'createdAt'>, actorName: string) => {
    const id = `sp_${Date.now()}`;
    const newDay: SpecialDay = { ...day, id, createdAt: now() };
    await insertSpecialDay({ id, name: day.name, date: day.date, consumesBalance: day.consumesBalance, appliesToAll: day.appliesToAll, appliesTo: day.appliesTo, createdBy: day.createdBy });
    setSpecialDays((prev) => [...prev, newDay]);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'special_day_created', entityType: 'special_day', entityId: id, description: `Created special day: ${newDay.name}` });
  }, []);

  const deleteSpecialDay = useCallback(async (id: string, actorName: string) => {
    await deleteSpecialDayDb(id);
    setSpecialDays((prev) => prev.filter((d) => d.id !== id));
    await insertAuditLog({ actorId: 'admin', actorName, action: 'special_day_deleted', entityType: 'special_day', entityId: id, description: `Deleted special day ${id}` });
  }, []);

  // ─── Notification Settings ───────────────────────────
  const updateNotificationSettingsHandler = useCallback(async (
    updates: Partial<NotificationSettings>, actorId: string, actorName: string,
  ) => {
    await updateNotificationSettingsDb({ ...updates, updatedBy: actorId } as { updatedBy: string; dailyReminderTime?: string; dailyReminderEnabled?: boolean });
    setNotificationSettings((prev) => ({ ...prev, ...updates, updatedAt: now(), updatedBy: actorId }));
    await insertAuditLog({ actorId, actorName, action: 'notification_setting_changed', entityType: 'notification_setting', entityId: 'global', description: `Updated notification settings` });
  }, []);

  // ─── Schedules ───────────────────────────────────
  const seedSchedules = useCallback(async (schedulesList: Schedule[]) => {
    try {
      await insertSchedulesBatch(schedulesList);
      setSchedules((prev) => [...prev, ...schedulesList]);
      await insertAuditLog({ actorId: 'system', actorName: 'System', action: 'schedules_seeded', entityType: 'schedule', entityId: 'bulk', description: `Seeded ${schedulesList.length} schedule entries` });
    } catch (err) {
      console.error('Failed to seed schedules:', err);
      throw err;
    }
  }, []);

  const value = useMemo(() => ({
    loading, users, addUser, updateUser, deleteUser, deleteUserWithDataHandling,
    jobRoles, addJobRole, updateJobRole, deleteJobRole,
    roleAssignments, assignRole, removeRoleAssignment,
    staffingRules, addStaffingRule, updateStaffingRule, deleteStaffingRule,
    holidays, specialDays, addSpecialDay, deleteSpecialDay,
    tourAssignments,
    schedules, seedSchedules,
    notificationSettings, updateNotificationSettings: updateNotificationSettingsHandler,
    refreshData: loadData,
  }), [
    loading, users, addUser, updateUser, deleteUser, deleteUserWithDataHandling,
    jobRoles, addJobRole, updateJobRole, deleteJobRole,
    roleAssignments, assignRole, removeRoleAssignment,
    staffingRules, addStaffingRule, updateStaffingRule, deleteStaffingRule,
    holidays, specialDays, addSpecialDay, deleteSpecialDay,
    tourAssignments,
    schedules, seedSchedules,
    notificationSettings, updateNotificationSettingsHandler, loadData,
  ]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}

// Development mode: Load testing utilities
if (import.meta.env.MODE === 'development') {
  import('@/utils/calendarDataIngestion').catch(() => null);
  import('@/utils/verifyCalendarData').catch(() => null);
}
