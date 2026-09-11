import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Firebase's web config is meant to be public (same as the Supabase anon key
// already checked into src/lib/supabase.ts) — real access control lives in
// Firestore Security Rules + Firebase Auth, not in keeping this secret.
const firebaseConfig = {
  apiKey: 'AIzaSyCeBzzn2SVQ-H9CX1o8Res-qnpOAzDubhQ',
  authDomain: 'smi-calender.firebaseapp.com',
  projectId: 'smi-calender',
  storageBucket: 'smi-calender.firebasestorage.app',
  messagingSenderId: '354590091291',
  appId: '1:354590091291:web:848bcb171629975d18f0be',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp);
