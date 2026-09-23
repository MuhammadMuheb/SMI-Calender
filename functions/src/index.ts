import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

// Retained names disable previously deployed insecure legacy endpoints.
const retired = () => onCall({ region: 'us-central1' }, () => {
  throw new HttpsError('failed-precondition', 'Use the current application API');
});
export const signInWithPin = retired();
export const calculateUserBalance = retired();
export const calculateMonthlyPayment = retired();
export const submitLeaveRequest = retired();
export const decideLeaveRequest = retired();
export const cancelLeaveRequest = retired();
export const acceptSwap = retired();
export const adjustVacationBalance = retired();

initializeApp();
export const attendanceScheduler = onSchedule({ schedule: 'every 30 minutes', timeZone: 'Europe/Rome', region: 'us-central1' }, async () => {
  const runtimePath = './attendance.cjs';
  const runtime = await import(runtimePath) as { runAttendance: (db: Firestore) => Promise<unknown> };
  await runtime.runAttendance(getFirestore());
});
