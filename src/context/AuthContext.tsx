import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, AuthState } from '../types';
import { authenticateUser } from '../services/supabaseService';

const AuthContext = createContext<AuthState | null>(null);

const SESSION_KEY = 'smi_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [user]);

  const login = async (username: string, pin: string): Promise<string | null> => {
    const match = await authenticateUser(username, pin);
    if (!match) {
      return 'Invalid username or PIN';
    }
    setUser({
      id: match.id,
      username: match.username,
      displayName: match.displayName,
      role: match.role,
      jobRole: match.jobRole,
    });
    return null;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
