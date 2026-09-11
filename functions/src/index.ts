import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as bcrypt from 'bcryptjs';

initializeApp();

interface UserDoc {
  id: string;
  username: string;
  displayName: string;
  pinHash: string;
  role: 'staff' | 'manager' | 'super_admin' | 'spectator';
  jobRole?: string[];
  isActive: boolean;
}

/**
 * Verifies a username + PIN against the Firestore `users` collection (doc id
 * = username) and, on success, mints a Firebase Auth custom token carrying
 * the user's role as a custom claim — so Firestore Security Rules can check
 * `request.auth.token.role` instead of trusting anything the client sends.
 *
 * The client signs in with this token via `signInWithCustomToken`.
 */
export const signInWithPin = onCall<{ username: string; pin: string }>(
  { region: 'us-central1' },
  async (request) => {
    const username = request.data.username?.trim().toLowerCase();
    const pin = request.data.pin;

    if (!username || !pin) {
      throw new HttpsError('invalid-argument', 'Username and PIN are required');
    }

    const db = getFirestore();
    const snap = await db.collection('users').doc(username).get();

    // Same generic error for "no such user" and "wrong PIN" — don't let a
    // client distinguish the two and enumerate valid usernames.
    const invalidCredentials = () => new HttpsError('unauthenticated', 'Invalid username or PIN');

    if (!snap.exists) throw invalidCredentials();
    const user = snap.data() as UserDoc;

    if (!user.isActive) throw invalidCredentials();

    const pinMatches = await bcrypt.compare(pin, user.pinHash);
    if (!pinMatches) throw invalidCredentials();

    const token = await getAuth().createCustomToken(user.id, { role: user.role });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        jobRole: user.jobRole ?? [],
      },
    };
  },
);
