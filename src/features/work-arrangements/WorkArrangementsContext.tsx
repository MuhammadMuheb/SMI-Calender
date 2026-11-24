import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serverApi } from '@/lib/serverApi';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppData } from '@/app/AppDataContext';
import { useLeave } from '@/features/leave/LeaveContext';
import { DEFAULT_POLICY, resolveDay, type Arrangement, type WorkPolicy, type WorkSlot } from '../../../shared/work-arrangements.mjs';

interface WorkData { arrangements: Arrangement[]; policy: WorkPolicy; teamPolicy: WorkPolicy; departments: Record<string, string> }
interface WorkContext extends WorkData {
  calendar: Arrangement[]; loading: boolean; error: string; refresh: () => Promise<void>;
  mutate: (body: Record<string, unknown>) => Promise<void>;
  slotsFor: (userId: string, date: string) => WorkSlot[];
}
const Context = createContext<WorkContext | null>(null);
export function WorkArrangementsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { requests } = useLeave();
  const { holidays, specialDays } = useAppData();
  const [data, setData] = useState<WorkData>({ arrangements: [], policy: DEFAULT_POLICY, teamPolicy: DEFAULT_POLICY, departments: {} });
  const [calendar, setCalendar] = useState<Arrangement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const run = ++generation.current;
    try {
      const result = await serverApi<WorkData>('work-arrangements', { action: 'list' });
      if (run === generation.current) { setData(result); setError(''); }
    } catch (e) { if (run === generation.current) setError(e instanceof Error ? e.message : 'Unable to load work arrangements'); }
    finally { if (run === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    const stop = onSnapshot(collection(db, 'work_calendar'), snapshot => {
      setCalendar(snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as Arrangement[]);
      void refresh();
    }, () => setError('Work calendar disconnected. Reload to reconnect.'));
    return () => {
      // This is a request-generation counter, not a DOM ref; invalidate outstanding requests on cleanup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      clearInterval(timer); window.removeEventListener('focus', focus); stop();
    };
  }, [refresh, user?.id]);
  const mutate = useCallback(async (body: Record<string, unknown>) => {
    await serverApi('work-arrangements', body);
    await refresh();
    window.dispatchEvent(new Event('work-schedule-changed'));
  }, [refresh]);
  const slotsFor = useCallback((userId: string, date: string) => resolveDay(userId, date, calendar, data.teamPolicy, { leaves: requests, holidays, specialDays }), [calendar, data.teamPolicy, requests, holidays, specialDays]);
  const value = useMemo(() => ({ ...data, calendar, loading, error, refresh, mutate, slotsFor }), [data, calendar, loading, error, refresh, mutate, slotsFor]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkArrangements() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkArrangementsProvider required');
  return value;
}
