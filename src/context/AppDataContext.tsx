import {
  createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode,
} from 'react';
import type { StaffUser } from '../models/user';
import type { JobRole, StaffRoleAssignment } from '../models/jobRole';
import type { StaffingRule } from '../models/staffing';
import type { Holiday, SpecialDay } from '../models/holiday';
import type { NotificationSettings } from '../models/notification';
import type { TourAssignment } from '../models/tourAssignment';
import type { Schedule } from '../models/schedule';
import {
  fetchUsers, insertUser, updateUserDb, deleteUserDb,
  fetchJobRoles, insertJobRole, updateJobRoleDb, deleteJobRoleDb,
  fetchRoleAssignments,
  fetchStaffingRules, insertStaffingRule, updateStaffingRuleDb, deleteStaffingRuleDb,
  fetchHolidays, fetchSpecialDays, insertSpecialDay, deleteSpecialDayDb,
  fetchNotificationSettings, updateNotificationSettingsDb,
  fetchTourAssignments,
  insertAuditLog,
} from '../services/supabaseService';
import {
  fetchSchedules,
  insertSchedulesBatch,
} from '../services/firestoreService';

/**
 * STATUS: CONNECTED TO SUPABASE
 * Loads all data from Supabase on mount.
 * All mutations write to both local state AND Supabase.
 */

interface AppDataContextValue {
  loading: boolean;
  users: StaffUser[];
  addUser: (user: Omit<StaffUser, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => Promise<string>;
  updateUser: (id: string, updates: Partial<StaffUser>, actorName: string) => void;
  deleteUser: (id: string, actorName: string) => void;
  jobRoles: JobRole[];
  addJobRole: (role: Omit<JobRole, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => void;
  updateJobRole: (id: string, updates: Partial<JobRole>, actorName: string) => void;
  deleteJobRole: (id: string, actorName: string) => void;
  roleAssignments: StaffRoleAssignment[];
  assignRole: (userId: string, jobRoleId: string, isPrimary: boolean) => void;
  removeRoleAssignment: (id: string) => void;
  staffingRules: StaffingRule[];
  addStaffingRule: (rule: Omit<StaffingRule, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => void;
  updateStaffingRule: (id: string, updates: Partial<StaffingRule>, actorName: string) => void;
  deleteStaffingRule: (id: string, actorName: string) => void;
  holidays: Holiday[];
  specialDays: SpecialDay[];
  tourAssignments: TourAssignment[];
  addSpecialDay: (day: Omit<SpecialDay, 'id' | 'createdAt'>, actorName: string) => void;
  deleteSpecialDay: (id: string, actorName: string) => void;
  schedules: Schedule[];
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (updates: Partial<NotificationSettings>, actorId: string, actorName: string) => void;
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

  // Load all data from Supabase on mount
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, jr, ra, sr, h, sd, ns, ta, sched] = await Promise.all([
        fetchUsers(), fetchJobRoles(), fetchRoleAssignments(),
        fetchStaffingRules(), fetchHolidays(), fetchSpecialDays(),
        fetchNotificationSettings(), fetchTourAssignments(),
        fetchSchedules(),
      ]);
      setUsers(u as StaffUser[]);
      setJobRoles(jr as JobRole[]);
      setRoleAssignments(ra as StaffRoleAssignment[]);
      setStaffingRules(sr as StaffingRule[]);
      setHolidays(h as Holiday[]);
      setSpecialDays(sd as SpecialDay[]);
      setNotificationSettings(ns as NotificationSettings);
      setTourAssignments(ta as TourAssignment[]);
      setSchedules(sched as Schedule[]);
    } catch (err) {
      console.error('Failed to load app data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Users ───────────────────────────────────────────
  const addUser = useCallback(async (user: Omit<StaffUser, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => {
    const id = `usr_${Date.now()}`;
    const newUser: StaffUser = { ...user, id, createdAt: now(), updatedAt: now() };
    setUsers((prev) => [...prev, newUser]);
    await insertUser({ id, username: user.username, displayName: user.displayName, pin: user.pin, role: user.role });
    await insertAuditLog({ actorId: 'admin', actorName, action: 'user_created', entityType: 'user', entityId: id, description: `Created user ${newUser.displayName}` });
    return id;
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<StaffUser>, actorName: string) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...updates, updatedAt: now() } : u));
    await updateUserDb(id, updates);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'user_updated', entityType: 'user', entityId: id, description: `Updated user ${id}` });
  }, []);

  const deleteUser = useCallback(async (id: string, actorName: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    await deleteUserDb(id);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'user_deleted', entityType: 'user', entityId: id, description: `Deleted user ${id}` });
  }, []);

  // ─── Job Roles ───────────────────────────────────────
  const addJobRole = useCallback(async (role: Omit<JobRole, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => {
    const id = `role_${Date.now()}`;
    const newRole: JobRole = { ...role, id, createdAt: now(), updatedAt: now() };
    setJobRoles((prev) => [...prev, newRole]);
    await insertJobRole({ id, name: role.name, color: role.color, isHidden: role.isHidden, shiftStart: role.shiftStartTime, shiftEnd: role.shiftEndTime });
    await insertAuditLog({ actorId: 'admin', actorName, action: 'role_assigned', entityType: 'user', entityId: id, description: `Created job role ${newRole.name}` });
  }, []);

  const updateJobRole = useCallback(async (id: string, updates: Partial<JobRole>, actorName: string) => {
    setJobRoles((prev) => prev.map((r) => r.id === id ? { ...r, ...updates, updatedAt: now() } : r));
    await updateJobRoleDb(id, updates);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'role_assigned', entityType: 'user', entityId: id, description: `Updated job role ${id}` });
  }, []);

  const deleteJobRole = useCallback(async (id: string, actorName: string) => {
    setJobRoles((prev) => prev.filter((r) => r.id !== id));
    setRoleAssignments((prev) => prev.filter((a) => a.jobRoleId !== id));
    await deleteJobRoleDb(id);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'role_removed', entityType: 'user', entityId: id, description: `Deleted job role ${id}` });
  }, []);

  // ─── Role Assignments ────────────────────────────────
  const assignRole = useCallback((userId: string, jobRoleId: string, isPrimary: boolean) => {
    const existing = roleAssignments.find((a) => a.userId === userId && a.jobRoleId === jobRoleId);
    if (existing) return;
    const newAssign = { id: `assign_${Date.now()}`, userId, jobRoleId, isPrimary, assignedAt: now() };
    setRoleAssignments((prev) => [...prev, newAssign]);
  }, [roleAssignments]);

  const removeRoleAssignment = useCallback((id: string) => {
    setRoleAssignments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ─── Staffing Rules ──────────────────────────────────
  const addStaffingRule = useCallback(async (rule: Omit<StaffingRule, 'id' | 'createdAt' | 'updatedAt'>, actorName: string) => {
    const id = `sr_${Date.now()}`;
    const newRule: StaffingRule = { ...rule, id, createdAt: now(), updatedAt: now() };
    setStaffingRules((prev) => [...prev, newRule]);
    await insertStaffingRule({ id, jobRoleId: rule.jobRoleId, dayOfWeek: rule.dayOfWeek, minimumRequired: rule.minimumRequired, enforcement: rule.enforcement });
    await insertAuditLog({ actorId: 'admin', actorName, action: 'staffing_rule_created', entityType: 'staffing_rule', entityId: id, description: `Created staffing rule` });
  }, []);

  const updateStaffingRule = useCallback(async (id: string, updates: Partial<StaffingRule>, actorName: string) => {
    setStaffingRules((prev) => prev.map((r) => r.id === id ? { ...r, ...updates, updatedAt: now() } : r));
    await updateStaffingRuleDb(id, updates);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'staffing_rule_updated', entityType: 'staffing_rule', entityId: id, description: `Updated staffing rule ${id}` });
  }, []);

  const deleteStaffingRule = useCallback(async (id: string, actorName: string) => {
    setStaffingRules((prev) => prev.filter((r) => r.id !== id));
    await deleteStaffingRuleDb(id);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'staffing_rule_deleted', entityType: 'staffing_rule', entityId: id, description: `Deleted staffing rule ${id}` });
  }, []);

  // ─── Special Days ────────────────────────────────────
  const addSpecialDay = useCallback(async (day: Omit<SpecialDay, 'id' | 'createdAt'>, actorName: string) => {
    const id = `sp_${Date.now()}`;
    const newDay: SpecialDay = { ...day, id, createdAt: now() };
    setSpecialDays((prev) => [...prev, newDay]);
    await insertSpecialDay({ id, name: day.name, date: day.date, consumesBalance: day.consumesBalance, appliesToAll: day.appliesToAll, appliesTo: day.appliesTo, createdBy: day.createdBy });
    await insertAuditLog({ actorId: 'admin', actorName, action: 'special_day_created', entityType: 'special_day', entityId: id, description: `Created special day: ${newDay.name}` });
  }, []);

  const deleteSpecialDay = useCallback(async (id: string, actorName: string) => {
    setSpecialDays((prev) => prev.filter((d) => d.id !== id));
    await deleteSpecialDayDb(id);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'special_day_deleted', entityType: 'special_day', entityId: id, description: `Deleted special day ${id}` });
  }, []);

  // ─── Notification Settings ───────────────────────────
  const updateNotificationSettingsHandler = useCallback(async (
    updates: Partial<NotificationSettings>, actorId: string, actorName: string,
  ) => {
    setNotificationSettings((prev) => ({ ...prev, ...updates, updatedAt: now(), updatedBy: actorId }));
    await updateNotificationSettingsDb({ ...updates, updatedBy: actorId } as { updatedBy: string; dailyReminderTime?: string; dailyReminderEnabled?: boolean });
    await insertAuditLog({ actorId, actorName, action: 'notification_setting_changed', entityType: 'notification_setting', entityId: 'global', description: `Updated notification settings` });
  }, []);

  // ─── Schedules ───────────────────────────────────
  const seedSchedules = useCallback(async (schedulesList: Schedule[]) => {
    try {
      await insertSchedulesBatch(schedulesList);
      setSchedules(schedulesList);
      await insertAuditLog({ actorId: 'system', actorName: 'System', action: 'schedules_seeded', entityType: 'schedule', entityId: 'bulk', description: `Seeded ${schedulesList.length} schedule entries` });
    } catch (err) {
      console.error('Failed to seed schedules:', err);
      throw err;
    }
  }, []);

  const value = useMemo(() => ({
    loading, users, addUser, updateUser, deleteUser,
    jobRoles, addJobRole, updateJobRole, deleteJobRole,
    roleAssignments, assignRole, removeRoleAssignment,
    staffingRules, addStaffingRule, updateStaffingRule, deleteStaffingRule,
    holidays, specialDays, addSpecialDay, deleteSpecialDay,
    tourAssignments,
    schedules, seedSchedules,
    notificationSettings, updateNotificationSettings: updateNotificationSettingsHandler,
    refreshData: loadData,
  }), [
    loading, users, addUser, updateUser, deleteUser,
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
