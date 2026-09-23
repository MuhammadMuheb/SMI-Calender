import {
  createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode,
} from 'react';
import type { DaySwap } from '@/models/swap';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serverApi } from '@/lib/serverApi';
import { toast } from 'sonner';

/**
 * STATUS: IN-MEMORY STORE (MOCK)
 * Manages day-swap proposals between same-role staff.
 * Instant approval when receiver accepts.
 * Notifies manager/admin (via audit log for now).
 */

interface SwapContextValue {
  swaps: DaySwap[];
  proposeSwap: (
    proposerId: string, proposerName: string,
    receiverId: string, receiverName: string,
    date: string, originalRequestId: string, commonJobRoleId: string,
  ) => Promise<string | null>;
  acceptSwap: (swapId: string) => Promise<void>;
  declineSwap: (swapId: string) => Promise<void>;
  getSwapsForUser: (userId: string) => DaySwap[];
  getPendingSwapsForUser: (userId: string) => DaySwap[];
}

const SwapContext = createContext<SwapContextValue | null>(null);

export function SwapProvider({ children }: { children: ReactNode }) {
  const [swaps, setSwaps] = useState<DaySwap[]>([]);

  useEffect(() => onSnapshot(collection(db, 'swaps'), snapshot => {
    setSwaps(snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as DaySwap));
  }, () => toast.error('Unable to load swaps')), []);

  const proposeSwap = useCallback(async (
    _proposerId: string, _proposerName: string, receiverId: string, _receiverName: string,
    _date: string, originalRequestId: string, _commonJobRoleId: string,
  ): Promise<string | null> => {
    try { await serverApi('swaps', { action: 'propose', originalRequestId, receiverId, commonJobRoleId: _commonJobRoleId }); return null; }
    catch (error) { return error instanceof Error ? error.message : 'Unable to propose swap'; }
  }, []);
  const acceptSwap = useCallback(async (id: string) => { await serverApi('swaps', { action: 'accept', id }); }, []);
  const declineSwap = useCallback(async (id: string) => { await serverApi('swaps', { action: 'decline', id }); }, []);

  const getSwapsForUser = useCallback(
    (userId: string) => swaps.filter((s) => s.proposerId === userId || s.receiverId === userId),
    [swaps],
  );

  const getPendingSwapsForUser = useCallback(
    (userId: string) => swaps.filter((s) => s.receiverId === userId && s.status === 'pending'),
    [swaps],
  );

  const value = useMemo(() => ({
    swaps, proposeSwap, acceptSwap, declineSwap, getSwapsForUser, getPendingSwapsForUser,
  }), [swaps, proposeSwap, acceptSwap, declineSwap, getSwapsForUser, getPendingSwapsForUser]);

  return <SwapContext.Provider value={value}>{children}</SwapContext.Provider>;
}

export function useSwap(): SwapContextValue {
  const ctx = useContext(SwapContext);
  if (!ctx) throw new Error('useSwap must be used inside SwapProvider');
  return ctx;
}
