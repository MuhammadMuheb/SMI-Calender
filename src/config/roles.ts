export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  SPECTATOR: 'spectator',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.STAFF]: 'Staff',
  [ROLES.SPECTATOR]: 'Spectator',
};

export const ROLE_BADGE_COLOR: Record<Role, 'secondary' | 'primary' | 'gray'> = {
  [ROLES.SUPER_ADMIN]: 'secondary',
  [ROLES.MANAGER]: 'primary',
  [ROLES.STAFF]: 'gray',
  [ROLES.SPECTATOR]: 'secondary',
};
