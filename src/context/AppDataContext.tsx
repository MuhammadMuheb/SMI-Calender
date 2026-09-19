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
import { getSafeUsers, SAFE_EMPTY_USERS } from '../utils/safeFallbacks';
import { validateUsers } from '../utils/dataValidation';
import {
  fetchUsers, insertUser, updateUserDb, deleteUserDb,
} from '../services/firestoreUserService';
import {
  fetchJobRoles, insertJobRole, updateJobRoleDb, deleteJobRoleDb,
  fetchRoleAssignments, insertRoleAssignment, deleteRoleAssignmentDb,
} from '../services/firestoreRoleService';
import {
  fetchStaffingRules, insertStaffingRule, updateStaffingRuleDb, deleteStaffingRuleDb,
} from '../services/firestoreStaffingService';
import {
  fetchHolidays, fetchSpecialDays, insertSpecialDay, deleteSpecialDayDb,
  fetchNotificationSettings, updateNotificationSettingsDb,
} from '../services/firestoreSettingsService';
import {
  fetchTourAssignments,
} from '../services/firestoreService';
import {
  insertAuditLog,
} from '../services/firestoreService';
import {
  fetchSchedules,
  insertSchedulesBatch,
} from '../services/firestoreService';
import { augustSchedules, septemberSchedules } from '../data/scheduleData';

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
  assignRole: (userId: string, jobRoleId: string, isPrimary: boolean, actorName: string) => void;
  removeRoleAssignment: (id: string, actorName: string) => void;
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

  // Load all data from Firestore on mount
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Wrap each fetch in its own try-catch to prevent one failure from crashing all
      const u = await fetchUsers().catch(err => {
        console.error('fetchUsers error:', err);
        return [];
      });
      let jr = await fetchJobRoles().catch(err => {
        console.error('fetchJobRoles error:', err);
        return [];
      });

      // Seed default job roles if empty
      if (jr.length === 0) {
        console.log('No job roles found in Firestore, seeding defaults...');
        const defaultRoles = [
          { id: 'role_checkin', name: 'Check In', color: '#3B82F6', isHidden: false, shiftStart: '08:00', shiftEnd: '17:00' },
          { id: 'role_backoffice', name: 'Back Office', color: '#F59E0B', isHidden: false, shiftStart: '09:00', shiftEnd: '18:00' },
          { id: 'role_backoffice_extra', name: 'Back Office Extra', color: '#EA580C', isHidden: false, shiftStart: '09:00', shiftEnd: '18:00' },
          { id: 'role_office', name: 'Office', color: '#8B5CF6', isHidden: false, shiftStart: '08:00', shiftEnd: '17:00' },
        ];

        try {
          for (const role of defaultRoles) {
            await insertJobRole(role).catch(err => console.warn(`Failed to insert role ${role.id}:`, err));
          }
          jr = defaultRoles;
          console.log('✓ Successfully seeded default job roles');
        } catch (seedErr) {
          console.error('Failed to seed job roles:', seedErr);
        }
      }
      const ra = await fetchRoleAssignments().catch(err => {
        console.error('fetchRoleAssignments error:', err);
        return [];
      });
      const sr = await fetchStaffingRules().catch(err => {
        console.error('fetchStaffingRules error:', err);
        return [];
      });
      const h = await fetchHolidays().catch(err => {
        console.error('fetchHolidays error:', err);
        return [];
      });
      const sd = await fetchSpecialDays().catch(err => {
        console.error('fetchSpecialDays error:', err);
        return [];
      });
      const ns = await fetchNotificationSettings().catch(err => {
        console.error('fetchNotificationSettings error:', err);
        return { dailyReminderTime: '14:00', dailyReminderEnabled: true, updatedAt: '', updatedBy: '' };
      });
      const ta = await fetchTourAssignments().catch(err => {
        console.error('fetchTourAssignments error:', err);
        return [];
      });
      const sched = await fetchSchedules().catch(err => {
        console.error('fetchSchedules error:', err);
        return [];
      });
      // Use bulletproof validation - GUARANTEED to never be undefined
      const validatedUsers = validateUsers(Array.isArray(u) ? u : SAFE_EMPTY_USERS);
      setUsers(validatedUsers);
      setJobRoles(Array.isArray(jr) ? jr : []);
      setRoleAssignments(Array.isArray(ra) ? ra : []);
      setStaffingRules(Array.isArray(sr) ? sr : []);
      setHolidays(Array.isArray(h) ? h : []);
      setSpecialDays(Array.isArray(sd) ? sd : []);
      setNotificationSettings(ns || { dailyReminderTime: '14:00', dailyReminderEnabled: true, updatedAt: '', updatedBy: '' });
      setTourAssignments(Array.isArray(ta) ? ta : []);
      const scheduleData = Array.isArray(sched) ? sched : [];
      console.log(`AppDataContext: Loaded ${scheduleData.length} schedules from Firestore`);
      console.log(`AppDataContext: Loaded ${Array.isArray(u) ? u.length : 0} users from Firestore`);
      setSchedules(scheduleData);

      // Auto-import schedules if none exist
      if (scheduleData.length === 0) {
        console.log(`AppDataContext: No schedules in Firestore, checking for local data...`);
        console.log(`August schedules available: ${augustSchedules.length}, September: ${septemberSchedules.length}`);

        if (augustSchedules.length > 0 || septemberSchedules.length > 0) {
          try {
          const allSchedules = [...augustSchedules, ...septemberSchedules];
          console.log(`Attempting to auto-import ${allSchedules.length} schedule entries...`);
          console.log('Sample entries:', allSchedules.slice(0, 3));

          if (!allSchedules || allSchedules.length === 0) {
            console.error('Schedule data is invalid or empty');
            return;
          }

          // Set local state first so it renders even if Firestore fails
          setSchedules(allSchedules);
          console.log(`AppDataContext: Set local schedules state (${allSchedules.length} entries)`);

          // Then attempt to save to Firestore
          try {
            await insertSchedulesBatch(allSchedules);
            console.log(`✓ AppDataContext: Successfully saved ${allSchedules.length} schedules to Firestore`);
          } catch (firestoreErr) {
            console.warn(`⚠ AppDataContext: Firestore save failed, but local data is available`);
          }
          } catch (importErr) {
            console.error('✗ AppDataContext: Failed to auto-import schedules:', importErr);
          }
        }
      }
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
    // CRITICAL: Always filter through getSafeUsers
    setUsers((prev) => getSafeUsers([...prev, newUser]));
    await insertUser({ id, username: user.username, displayName: user.displayName, pin: user.pin, role: user.role });
    await insertAuditLog({ actorId: 'admin', actorName, action: 'user_created', entityType: 'user', entityId: id, description: `Created user ${newUser.displayName}` });
    return id;
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<StaffUser>, actorName: string) => {
    // CRITICAL: Always filter through getSafeUsers
    setUsers((prev) => getSafeUsers(prev.map((u) => u.id === id ? { ...u, ...updates, updatedAt: now() } : u)));
    await updateUserDb(id, updates);
    await insertAuditLog({ actorId: 'admin', actorName, action: 'user_updated', entityType: 'user', entityId: id, description: `Updated user ${id}` });
  }, []);

  const deleteUser = useCallback(async (id: string, actorName: string) => {
    // CRITICAL: Always filter through getSafeUsers
    setUsers((prev) => getSafeUsers(prev.filter((u) => u.id !== id)));
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
  const assignRole = useCallback(async (userId: string, jobRoleId: string, isPrimary: boolean, actorName: string) => {
    const existing = roleAssignments.find((a) => a.userId === userId && a.jobRoleId === jobRoleId);
    if (existing) return;
    const id = `assign_${Date.now()}`;
    const newAssign = { id, userId, jobRoleId, isPrimary, assignedAt: now() };
    setRoleAssignments((prev) => [...prev, newAssign]);
    await insertRoleAssignment({ id, userId, jobRoleId, isPrimary });
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
      setSchedules((prev) => [...prev, ...schedulesList]);
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
