import {
  createContext, useContext, useState, useCallback, useMemo, type ReactNode,
} from 'react';
import type { DaySwap, SwapStatus } from '../models/swap';
import { logAction } from '../services/auditService';

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
  ) => string | null;
  acceptSwap: (swapId: string) => void;
  declineSwap: (swapId: string) => void;
  getSwapsForUser: (userId: string) => DaySwap[];
  getPendingSwapsForUser: (userId: string) => DaySwap[];
}

const SwapContext = createContext<SwapContextValue | null>(null);

export function SwapProvider({ children }: { children: ReactNode }) {
  const [swaps, setSwaps] = useState<DaySwap[]>([]);

  const proposeSwap = useCallback((
    proposerId: string, proposerName: string,
    receiverId: string, receiverName: string,
    date: string, originalRequestId: string, commonJobRoleId: string,
  ): string | null => {
    const existing = swaps.find(
      (s) => s.date === date && s.proposerId === proposerId && s.status === 'pending',
    );
    if (existing) return 'You already have a pending swap for this date';

    const swap: DaySwap = {
      id: `swap_${Date.now()}`,
      proposerId, proposerName, receiverId, receiverName,
      date, originalRequestId, commonJobRoleId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    setSwaps((prev) => [...prev, swap]);
    logAction(proposerId, proposerName, 'leave_requested', 'leave_request', swap.id,
      `${proposerName} proposed day swap with ${receiverName} for ${date}`);
    return null;
  }, [swaps]);

  const acceptSwap = useCallback((swapId: string) => {
    setSwaps((prev) => prev.map((s) => {
      if (s.id !== swapId) return s;
      logAction(s.receiverId, s.receiverName, 'leave_approved', 'leave_request', swapId,
        `${s.receiverName} accepted day swap from ${s.proposerName} for ${s.date}`);
      return { ...s, status: 'accepted' as SwapStatus, resolvedAt: new Date().toISOString() };
    }));
  }, []);

  const declineSwap = useCallback((swapId: string) => {
    setSwaps((prev) => prev.map((s) => {
      if (s.id !== swapId) return s;
      return { ...s, status: 'declined' as SwapStatus, resolvedAt: new Date().toISOString() };
    }));
  }, []);

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
