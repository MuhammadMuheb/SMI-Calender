import type { StaffUser } from '../models/user';

/**
 * Real staff list — used for login dropdown only.
 * Actual data lives in Supabase.
 */
export const seedUsers: StaffUser[] = [
  { id: 'usr_nabeel',   username: 'nabeel',   displayName: 'Nabeel',    pin: '0000', role: 'super_admin', isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'usr_zack',     username: 'zack',     displayName: 'Zack',      pin: '0000', role: 'manager',     isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'usr_michael',  username: 'michael',  displayName: 'Michael',   pin: '0000', role: 'manager',     isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'usr_rihab',    username: 'rihab',    displayName: 'Rihab',     pin: '0000', role: 'staff',       isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'usr_umer',     username: 'umer',     displayName: 'Umer',      pin: '0000', role: 'staff',       isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'usr_parnia',   username: 'parnia',   displayName: 'Parnia',    pin: '0000', role: 'staff',       isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'usr_desiree',  username: 'desiree',  displayName: 'Desiree',   pin: '0000', role: 'staff',       isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'usr_sherry',   username: 'sherry',   displayName: 'Sherry',    pin: '0000', role: 'staff',       isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'usr_gunzan',   username: 'gunzan',   displayName: 'Gunzan',    pin: '0000', role: 'staff',       isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'usr_kristina', username: 'kristina', displayName: 'Kristina',  pin: '0000', role: 'staff',       isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'usr_matteo',   username: 'matteo',   displayName: 'Matteo',    pin: '0000', role: 'staff',       isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'usr_giovanni', username: 'giovanni', displayName: 'Giovanni',  pin: '0000', role: 'staff',       isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
];
