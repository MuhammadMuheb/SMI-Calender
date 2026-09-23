import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Role } from '@/config/roles';

/**
 * Firestore-only authentication (migrated from Supabase).
 * This is the only function left from the original Supabase service.
 * All other data operations now use Firestore directly.
 */
export async function authenticateUser(username: string, pin: string) {
  try {
    const normalizedUsername = username.trim().toLowerCase();
    const q = query(
      collection(db, 'users'),
      where('username', '==', normalizedUsername),
      where('pinHash', '==', pin),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const data = snapshot.docs[0].data();

    return {
      id: data.id ?? snapshot.docs[0].id ?? 'unknown',
      username: (data.username ?? 'unknown') as string,
      displayName: (data.displayName ?? data.username ?? 'Unknown User') as string,
      role: (data.role ?? 'staff') as Role,
      jobRole: (Array.isArray(data.jobRole) ? data.jobRole : ['Office']) as string[],
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Re-export from firestoreUserService for backward compatibility
 */
export { insertUser, updateUserDb, deleteUserDb } from '@/services/firestore/users';

/**
 * Re-export from firestoreService for backward compatibility
 */
export { insertAuditLog, fetchAuditLog } from '@/services/firestore/core';
