import { seedUsers } from '../data/seed';
import type { StaffUser } from '../models/user';
import type { Role } from './roles';

/**
 * STATUS: MOCK AUTH DATA
 * Demo users are derived from seedUsers — single source of truth.
 * In production, authentication will be handled by a real backend.
 * PINs are intentionally simple for testing convenience.
 * No secrets — this file is safe to commit for development.
 */

export interface DemoUser {
  id: string;
  username: string;
  pin: string;
  role: Role;
  displayName: string;
}

/**
 * All seed users are available as demo logins.
 * Derived from src/data/seed.ts — no duplication.
 */
export const DEMO_USERS: DemoUser[] = seedUsers
  .filter((u) => u.isActive)
  .map((u: StaffUser) => ({
    id: u.id,
    username: u.username,
    pin: u.pin,
    role: u.role,
    displayName: u.displayName,
  }));

/**
 * Validate credentials against demo user list.
 * Returns the matched user or null.
 */
export function authenticateDemoUser(
  username: string,
  pin: string,
): DemoUser | null {
  const normalized = username.trim().toLowerCase();
  return (
    DEMO_USERS.find(
      (u) => u.username.toLowerCase() === normalized && u.pin === pin,
    ) ?? null
  );
}
