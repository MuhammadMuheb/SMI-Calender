import type { Role } from '@/config/roles';

/**
 * Full user record — represents a staff member in the system.
 * The `role` field determines UI access and permissions.
 * Hidden roles are tracked separately in StaffRole assignments.
 */
export interface StaffUser {
    id: string;
    username: string;
    displayName: string;
    pin: string; // Write-only form input; reads return an empty string.
    role: Role;
    isActive: boolean;
    createdAt: string; // ISO date
    updatedAt: string; // ISO date
    vacationOverride?: number | null;
    regularOverride?: number | null;
    jobRole?: string[];
}

/**
 * Minimal user reference used in logs, requests, etc.
 * Avoids passing full user objects around.
 */
export interface UserRef {
    id: string;
    displayName: string;
    role: Role;
}
