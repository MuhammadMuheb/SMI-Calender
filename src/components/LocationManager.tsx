import { useState } from 'react';

export default function LocationManager() {
  const [loading] = useState(false);
  const [showForm] = useState(false);

  if (loading) {
    return <div className="p-4 text-center">Loading locations...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">📍 Location Manager</h2>
      <p className="text-gray-600 mb-4">TODO: Migrate to Firestore</p>
      {showForm && (
        <div className="mb-4 p-4 border rounded">
          <p>Location form - TODO: Implement with Firestore</p>
        </div>
      )}
      <div className="space-y-2">
        <p className="text-sm text-gray-500">No locations loaded. Please implement Firestore migration.</p>
      </div>
    </div>
  );
}
