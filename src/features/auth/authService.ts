import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { serverApi } from '@/lib/serverApi';
export async function authenticateUser(username: string, pin: string) {
  const { token } = await serverApi<{ token: string }>('session', { username, pin });
  await signInWithCustomToken(auth, token);
}
export { insertUser, updateUserDb, deleteUserDb } from '@/services/firestore/users';
export { insertAuditLog, fetchAuditLog } from '@/services/firestore/core';
