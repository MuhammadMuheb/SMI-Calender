import { useEffect, useRef } from 'react';
import { sendLateAlerts, sendCheckoutReminders } from '../utils/attendanceUtils';

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

    // Run immediately
    sendLateAlerts().catch(() => {});
    sendCheckoutReminders().catch(() => {});

    // Then every 30 minutes
    const interval = setInterval(() => {
      sendLateAlerts().catch(() => {});
      sendCheckoutReminders().catch(() => {});
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userRole]);

  return null; // Invisible component
}
