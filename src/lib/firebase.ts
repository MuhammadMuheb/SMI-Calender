import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Firebase's web config is meant to be public (same as the Supabase anon key)
// — real access control lives in Firestore Security Rules + Firebase Auth.
// Values come from .env.local (or use defaults for development).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCeBzzn2SVQ-H9CX1o8Res-qnpOAzDubhQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'smi-calender.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'smi-calender',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'smi-calender.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '354590091291',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:354590091291:web:848bcb171629975d18f0be',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp);

// Export VAPID public key for push notifications
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BM2rVmOrn1Lkn0lppCY4GlOq9d8aQ2PkXR1M9ZvLwVG3eNqJz9qJ5eR8mK2pL3sT4uVwxY';
