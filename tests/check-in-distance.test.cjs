const { test } = require('node:test');
const assert = require('node:assert/strict');

test('correct office pin admits office staff previously outside the 100 m radius', async () => {
  const { getDistanceMeters } = await import('../src/features/attendance/distance.ts');
  const office = [41.8966075, 12.4901289];
  assert.equal(getDistanceMeters(...office, ...office), 0);
  assert(getDistanceMeters(...office, 41.8963, 12.4918) > 100);
});

test('100 m geofence accepts inside positions and rejects outside positions in every direction', async () => {
  const { getDistanceMeters } = await import('../src/features/attendance/distance.ts');
  const lat = 41.8966075 * Math.PI / 180;
  const lng = 12.4901289 * Math.PI / 180;
  for (const bearing of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
    for (const meters of [0, 36, 99.99, 100.01, 150, 234]) {
      const arc = meters / 6371000;
      const targetLat = Math.asin(Math.sin(lat) * Math.cos(arc) + Math.cos(lat) * Math.sin(arc) * Math.cos(bearing));
      const targetLng = lng + Math.atan2(Math.sin(bearing) * Math.sin(arc) * Math.cos(lat), Math.cos(arc) - Math.sin(lat) * Math.sin(targetLat));
      const distance = getDistanceMeters(41.8966075, 12.4901289, targetLat * 180 / Math.PI, targetLng * 180 / Math.PI);
      assert(Math.abs(distance - meters) < 0.000001);
      assert.equal(distance <= 100, meters <= 100);
    }
  }
});
