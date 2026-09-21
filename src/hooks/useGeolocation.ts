import { useState, useEffect, useCallback, useRef } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Location {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  allowed_roles: string[];
}

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  nearbyLocations: Location[];
  nearestLocation: Location | null;
  distanceToNearest: number | null;
  allLocations: Location[];
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGeolocation(userJobRoles: string[], autoWatch = true) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null, longitude: null, accuracy: null, error: null, loading: true,
    nearbyLocations: [], nearestLocation: null, distanceToNearest: null, allLocations: [],
  });

  const watchIdRef = useRef<number | null>(null);
  const locationsRef = useRef<Location[]>([]);

  useEffect(() => {
    async function fetchLocations() {
      try {
        const snapshot = await getDocs(collection(db, 'locations'));
        const locations = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          address: doc.data().address || null,
          latitude: doc.data().latitude || 0,
          longitude: doc.data().longitude || 0,
          radius_meters: doc.data().radius_meters || 100,
          allowed_roles: doc.data().allowed_roles || [],
        }));
        locationsRef.current = locations;
        setState(prev => ({ ...prev, allLocations: locations }));
      } catch (error) {
        console.error('Failed to fetch locations:', error);
        locationsRef.current = [];
      }
    }
    fetchLocations();
  }, []);

  const checkProximity = useCallback((lat: number, lng: number) => {
    const locations = locationsRef.current;
    const allowedLocations = locations.filter((loc) => {
      if (!loc.allowed_roles || loc.allowed_roles.length === 0) return true;
      return loc.allowed_roles.some((role) => userJobRoles.includes(role));
    });
    const withDistances = allowedLocations.map((loc) => ({
      location: loc,
      distance: getDistanceMeters(lat, lng, loc.latitude, loc.longitude),
    }));
    withDistances.sort((a, b) => a.distance - b.distance);
    const nearby = withDistances.filter((wd) => wd.distance <= wd.location.radius_meters).map((wd) => wd.location);
    const nearest = withDistances.length > 0 ? withDistances[0] : null;
    setState((prev) => ({
      ...prev, latitude: lat, longitude: lng, loading: false,
      nearbyLocations: nearby, nearestLocation: nearest ? nearest.location : null,
      distanceToNearest: nearest ? Math.round(nearest.distance) : null,
    }));
  }, [userJobRoles]);

  const requestPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, error: 'Geolocation is not supported by your browser', loading: false }));
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setState((prev) => ({ ...prev, accuracy }));
        checkProximity(latitude, longitude);
      },
      (err) => {
        let errorMsg = 'Unable to get location';
        if (err.code === 1) errorMsg = 'Location access denied. Please enable GPS in your settings.';
        if (err.code === 2) errorMsg = 'Location unavailable. Please try again.';
        if (err.code === 3) errorMsg = 'Location request timed out. Please try again.';
        setState((prev) => ({ ...prev, error: errorMsg, loading: false }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, [checkProximity]);

  useEffect(() => {
    if (!autoWatch || !navigator.geolocation) return;
    requestPosition();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setState((prev) => ({ ...prev, accuracy }));
        checkProximity(latitude, longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
    );
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [autoWatch, requestPosition, checkProximity]);

  return { ...state, requestPosition };
}

export { getDistanceMeters };
