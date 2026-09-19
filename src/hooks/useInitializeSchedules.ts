import { useEffect, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import scheduleDataJson from '../data/scheduleData.json';
import type { Schedule } from '../models/schedule';

export function useInitializeSchedules() {
  const { schedules, seedSchedules } = useAppData();
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeIfNeeded = async () => {
      if (schedules.length === 0 && !initialized) {
        try {
          const scheduleData = scheduleDataJson as Schedule[];
          await seedSchedules(scheduleData);
          setInitialized(true);
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Failed to initialize schedules'));
          console.error('Failed to initialize schedules:', err);
        }
      } else if (schedules.length > 0) {
        setInitialized(true);
      }
    };

    initializeIfNeeded();
  }, [schedules.length, seedSchedules, initialized]);

  return { initialized, error };
}
