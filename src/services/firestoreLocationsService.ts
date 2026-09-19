import {
  collection, getDocs, query, where, orderBy, addDoc, updateDoc, doc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Location {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchLocations() {
  try {
    const q = query(collection(db, 'locations'), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as Location[];
  } catch (error) {
    console.error('fetchLocations:', error);
    return [];
  }
}

export async function fetchActiveLocations() {
  try {
    const q = query(
      collection(db, 'locations'),
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as Location[];
  } catch (error) {
    console.error('fetchActiveLocations:', error);
    return [];
  }
}

export async function updateLocation(id: string, updates: Partial<Location>) {
  try {
    const locationRef = doc(db, 'locations', id);
    await updateDoc(locationRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('updateLocation:', error);
    return false;
  }
}

export async function insertLocation(location: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    await addDoc(collection(db, 'locations'), {
      ...location,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('insertLocation:', error);
    return false;
  }
}

export async function toggleLocationActive(id: string, currentActive: boolean) {
  return updateLocation(id, { isActive: !currentActive });
}
