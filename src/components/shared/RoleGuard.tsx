import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import type { Role } from '@/config/roles';
import UnauthorizedView from '@/features/auth/UnauthorizedPage';

interface RoleGuardProps {
  /** Roles that are allowed to see this content */
  allowed: Role[];
  children: ReactNode;
}

/**
 * STATUS: UI-SIDE GUARD ONLY
 * Blocks rendering of children if user's role is not in the allowed list.
 * This is NOT server-side enforcement — a real backend must also check roles.
 */
export default function RoleGuard({ allowed, children }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user) return null;

  if (!allowed.includes(user.role)) {
    return <UnauthorizedView />;
  }

  return <>{children}</>;
}
