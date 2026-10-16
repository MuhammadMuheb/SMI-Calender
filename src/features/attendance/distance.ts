export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Most of a phone's reported accuracy is credited, up to this many metres.
 * Indoors (stone buildings, Wi-Fi off) phones often report ±30–150 m and the
 * reading drifts, so a strict "distance ≤ radius" check rejected people who
 * were inside the office.
 */
export const MAX_ACCURACY_ALLOWANCE_M = 100;

/**
 * Is a GPS reading inside a check-in location? The reading counts if the
 * circle of uncertainty around it (capped at MAX_ACCURACY_ALLOWANCE_M)
 * reaches the location's radius.
 */
export function isWithinGeofence(distanceM: number, radiusM: number, accuracyM: number | null | undefined): boolean {
  const allowance = Math.min(Math.max(accuracyM ?? 0, 0), MAX_ACCURACY_ALLOWANCE_M);
  return distanceM - allowance <= radiusM;
}
