import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User, AuthState } from './types';
import { authenticateUser } from './authService';
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    localStorage.removeItem('smi_session');
    let stopProfile = () => {};
    const stopAuth = onAuthStateChanged(auth, (session) => {
      stopProfile();
      setUser(null);
      if (!session || session.isAnonymous) { setLoading(false); return; }
      stopProfile = onSnapshot(doc(db, 'users', session.uid), (snapshot) => {
        const profile = snapshot.data();
        if (!profile?.isActive || !['staff', 'manager', 'super_admin', 'spectator'].includes(profile.role)) { void signOut(auth); setUser(null); }
        else setUser({ id: session.uid, username: profile.username, displayName: profile.displayName,
          role: profile.role, jobRole: profile.jobRole || [] });
        setLoading(false);
      }, () => { setUser(null); setLoading(false); void signOut(auth); });
    });
    return () => { stopAuth(); stopProfile(); };
  }, []);
  const login = async (username: string, pin: string) => {
    try { await authenticateUser(username, pin); return null; }
    catch (error) { return error instanceof Error ? error.message : 'Unable to sign in'; }
  };
  const logout = () => { setUser(null); void signOut(auth); };
  return <AuthContext.Provider value={{ user, login, logout }}>{loading ? <p role="status" className="p-8">Loading session...</p> : children}</AuthContext.Provider>;
}
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
