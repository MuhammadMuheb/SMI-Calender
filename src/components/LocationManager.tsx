import { useState, useEffect } from 'react';

const ALL_JOB_ROLES = ['Check In', 'Back Office', 'Back Office Extra', 'Office'];

interface Location {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  allowed_roles: string[];
}

export default function LocationManager() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detectingGPS, setDetectingGPS] = useState(false);

  const [form, setForm] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius_meters: '200',
    allowed_roles: [...ALL_JOB_ROLES] as string[],
  });

  async function fetchLocations() {
    setLoading(true);
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) setLocations(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchLocations();
  }, []);

  function resetForm() {
    setForm({
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      radius_meters: '200',
      allowed_roles: [...ALL_JOB_ROLES],
    });
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(loc: Location) {
    setForm({
      name: loc.name,
      address: loc.address || '',
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      radius_meters: String(loc.radius_meters),
      allowed_roles: loc.allowed_roles?.length ? [...loc.allowed_roles] : [...ALL_JOB_ROLES],
    });
    setEditingId(loc.id);
    setShowForm(true);
  }

  function detectCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation not supported');
      return;
    }
    setDetectingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: String(pos.coords.latitude.toFixed(6)),
          longitude: String(pos.coords.longitude.toFixed(6)),
        }));
        setDetectingGPS(false);
      },
      () => {
        alert('Unable to detect location.');
        setDetectingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function toggleRole(role: string) {
    setForm((prev) => {
      const has = prev.allowed_roles.includes(role);
      return {
        ...prev,
        allowed_roles: has
          ? prev.allowed_roles.filter((r) => r !== role)
          : [...prev.allowed_roles, role],
      };
    });
  }

  async function handleSave() {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const radius = parseInt(form.radius_meters);

    if (!form.name.trim() || isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      alert('Please fill in name, valid coordinates, and radius.');
      return;
    }
    if (form.allowed_roles.length === 0) {
      alert('Select at least one job role.');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      latitude: lat,
      longitude: lng,
      radius_meters: radius,
      allowed_roles: form.allowed_roles,
    };

    if (editingId) {
    // TODO: Migrate to Firestore
    } else {
    // TODO: Migrate to Firestore
    }

    setSaving(false);
    resetForm();
    fetchLocations();
  }

  async function toggleActive(loc: Location) {
    // TODO: Migrate to Firestore
    fetchLocations();
  }

  async function deleteLocation(id: string) {
    if (!confirm('Delete this location? Existing check-in records will be preserved.')) return;
    // TODO: Migrate to Firestore
    fetchLocations();
  }

  function getRoleBadgeColor(role: string) {
    const map: Record<string, string> = {
      'Check In': 'bg-sky-100 text-sky-700',
      'Back Office': 'bg-amber-100 text-amber-700',
      'Back Office Extra': 'bg-orange-100 text-orange-700',
      'Office': 'bg-indigo-100 text-indigo-700',
    };
    return map[role] || 'bg-gray-100 text-gray-700';
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading locations...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">📍 Check-In Locations</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + Add Location
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {editingId ? 'Edit Location' : 'New Location'}
          </h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Office, Check-In Spot"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Via dei Fori Imperiali 1, Roma"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude *</label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                placeholder="41.8924"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude *</label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                placeholder="12.4875"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <button
            onClick={detectCurrentLocation}
            disabled={detectingGPS}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
          >
            {detectingGPS ? '📡 Detecting...' : '📡 Use my current GPS location'}
          </button>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Radius (meters) *
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="50"
                max="500"
                step="25"
                value={form.radius_meters}
                onChange={(e) => setForm((f) => ({ ...f, radius_meters: e.target.value }))}
                className="flex-1"
              />
              <span className="text-sm font-mono text-gray-600 dark:text-gray-300 w-16 text-right">
                {form.radius_meters}m
              </span>
            </div>
          </div>

          {/* Role restrictions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Allowed Job Roles *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Only selected roles can check in at this location
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_JOB_ROLES.map((role) => {
                const selected = form.allowed_roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                      selected
                        ? `${getRoleBadgeColor(role)} border-transparent ring-2 ring-blue-300`
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {selected ? '✓ ' : ''}{role}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add Location'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Locations List */}
      {locations.length === 0 ? (
        <p className="text-center py-6 text-gray-400">No locations configured yet.</p>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className={`border rounded-xl p-4 transition-colors ${
                loc.is_active
                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  : 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{loc.name}</h4>
                    {!loc.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-gray-300 text-gray-600 rounded-full">
                        Disabled
                      </span>
                    )}
                  </div>
                  {loc.address && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{loc.address}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)} · {loc.radius_meters}m
                  </p>
                  {/* Show allowed roles */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(loc.allowed_roles || []).map((role) => (
                      <span
                        key={role}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getRoleBadgeColor(role)}`}
                      >
                        {role}
                      </span>
                    ))}
                    {(!loc.allowed_roles || loc.allowed_roles.length === 0) && (
                      <span className="text-[10px] text-gray-400">All roles</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(loc)}
                    className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                      loc.is_active
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                  >
                    {loc.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => startEdit(loc)}
                    className="text-xs px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteLocation(loc.id)}
                    className="text-xs px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
