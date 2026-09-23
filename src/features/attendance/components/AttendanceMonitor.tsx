import { useEffect, useRef } from 'react';
import { sendLateAlerts, sendCheckoutReminders } from '@/features/attendance/attendanceUtils';
import { todayStr } from '@/utils/dateUtils';

interface AttendanceMonitorProps {
  userRole: string;
}

// Runs once on mount for managers/admins, then every 30 minutes
export default function AttendanceMonitor({ userRole }: AttendanceMonitorProps) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (userRole !== 'manager' && userRole !== 'super_admin') return;
    if (hasRun.current) return;
    hasRun.current = true;

    // Local date: Italy is UTC+1/+2, so toISOString() would give yesterday after midnight.
    const today = todayStr();

    // Run immediately
    sendLateAlerts(today).catch(() => {});
    sendCheckoutReminders(today).catch(() => {});

    // Then every 30 minutes
    const interval = setInterval(() => {
      const currentDate = todayStr();
      sendLateAlerts(currentDate).catch(() => {});
      sendCheckoutReminders(currentDate).catch(() => {});
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userRole]);

  return null; // Invisible component
}
