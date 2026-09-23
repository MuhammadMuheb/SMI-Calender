import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getAnalytics, type Analytics } from 'firebase/analytics';

// Firebase's web config is meant to be public — real access control lives in
// Firestore Security Rules + Firebase Auth. Values come from .env.local, with
// the project defaults as a fallback.

/** Treat unset values and untouched `.env.example` placeholders as missing. */
function env(value: string | undefined, fallback: string): string {
  if (!value || value.startsWith('your_') || value.includes('your_project')) return fallback;
  return value;
}

const firebaseConfig = {
  apiKey: env(import.meta.env.VITE_FIREBASE_API_KEY, 'AIzaSyCeBzzn2SVQ-H9CX1o8Res-qnpOAzDubhQ'),
  authDomain: env(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, 'smi-calender.firebaseapp.com'),
  databaseURL: env(import.meta.env.VITE_FIREBASE_DATABASE_URL, 'https://smi-calender-default-rtdb.firebaseio.com'),
  projectId: env(import.meta.env.VITE_FIREBASE_PROJECT_ID, 'smi-calender'),
  storageBucket: env(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, 'smi-calender.firebasestorage.app'),
  messagingSenderId: env(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, '354590091291'),
  appId: env(import.meta.env.VITE_FIREBASE_APP_ID, '1:354590091291:web:848bcb171629975d18f0be'),
  measurementId: env(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, 'G-T38XMM43KK'),
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp);

let analytics: Analytics | undefined;
if (import.meta.env.PROD) {
  try {
    analytics = getAnalytics(firebaseApp);
  } catch {
    // Analytics is optional.
  }
}
export { analytics };

// Firestore rules require a signed-in (anonymous) Firebase user.
signInAnonymously(auth).catch((error) => {
  console.warn('Anonymous sign-in failed:', error.code, error.message);
});
