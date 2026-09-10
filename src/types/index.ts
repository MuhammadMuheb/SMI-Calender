import type { Role } from '../config/roles';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  jobRole: string[];
}

export interface AuthState {
  user: User | null;
  /** Returns error message on failure, null on success */
  login: (username: string, pin: string) => Promise<string | null>;
  logout: () => void;
}
