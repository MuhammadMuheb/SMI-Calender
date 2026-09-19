import { useState, useEffect, useCallback } from 'react';

interface WorkingPerson {
  id: string;
  user_id: string;
  user_name: string;
  role: string;
  job_role: string[];
  location_name: string;
  check_in_at: string;
  check_out_at: string | null;
  is_wfh: boolean;
  work_type: string;
  status: 'working' | 'done';
  hours_so_far: number;
}

export default function WorkingToday() {
  const [people, setPeople] = useState<WorkingPerson[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorking = useCallback(async () => {
    // TODO: Migrate to Firestore
    if (!error && data) setPeople(data as WorkingPerson[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWorking();
    const interval = setInterval(fetchWorking, 20000);
    return () => clearInterval(interval);
  }, [fetchWorking]);

  useEffect(() => {
    // TODO: Migrate to Firestore
      .on('postgres_changes', { event: '*', schema: 'public', table: 'check_ins' }, () => fetchWorking())
      .subscribe();
    // TODO: Clean up listener
  }, [fetchWorking]);

  const working = people.filter((p) => p.status === 'working');
  const done = people.filter((p) => p.status === 'done');

  function formatTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function formatHours(h: number) { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`; }

  function getRoleBadges(roles: string[]) {
    const colors: Record<string, string> = {
      'Check In': 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
      'Back Office': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      'Back Office Extra': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
      'Office': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    };
    return (roles || []).map((r) => (
      <span key={r} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[r] || 'bg-gray-100 text-gray-700'}`}>{r}</span>
    ));
  }

  if (loading) return <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5"><div className="text-center py-4 text-gray-400">Loading...</div></div>;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Working Today</h3>
          {working.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-bold">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />{working.length}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{people.length} total today</span>
      </div>

      {people.length === 0 ? <p className="text-center py-6 text-gray-400">No one has checked in yet today.</p> : (
        <>
          {working.length > 0 && (
            <div className="space-y-2">
              {working.map((p) => (
                <div key={p.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${p.is_wfh ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${p.is_wfh ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{p.user_name}</p>
                        {getRoleBadges(p.job_role)}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        {p.is_wfh ? <><span>🏠</span> Working from Home</> : <><span>📍</span> {p.location_name}</>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{formatTime(p.check_in_at)}</p>
                    <p className={`text-xs font-semibold ${p.is_wfh ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatHours(p.hours_so_far)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-3">Done for the day ({done.length})</h4>
              <div className="space-y-1.5">
                {done.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/30 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full" />
                      <div className="flex items-center gap-2"><p className="font-medium text-gray-600 dark:text-gray-300 text-sm truncate">{p.user_name}</p>{p.is_wfh && <span className="text-xs">🏠</span>}</div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(p.check_in_at)} – {p.check_out_at ? formatTime(p.check_out_at) : '—'}</p>
                      <p className="text-xs text-gray-400">{formatHours(p.hours_so_far)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
