/**
 * A job role defines a function a staff member can perform on a shift.
 * Examples: "Guide", "Check-in", "Coordinator"
 *
 * Hidden roles (isHidden=true):
 * - Visible ONLY to super admin in backend/admin UI
 * - Managers and staff must NOT see hidden roles in normal UI
 * - Hidden roles STILL count in staffing calculations
 */
export interface JobRole {
  id: string;
  name: string;
  color: string; // Hex color for calendar dots/badges
  isHidden: boolean;
  shiftStartTime: string; // e.g. "08:00"
  shiftEndTime: string; // e.g. "17:00"
  createdAt: string;
  updatedAt: string;
}

/**
 * Assignment of a job role to a staff member.
 * A staff member can hold multiple job roles.
 */
export interface StaffRoleAssignment {
  id: string;
  userId: string;
  jobRoleId: string;
  isPrimary: boolean; // Their main role for scheduling
  assignedAt: string;
}
