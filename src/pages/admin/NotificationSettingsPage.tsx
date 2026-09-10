import { useState } from 'react';
import { Card, Badge, Button } from '../../components/ui';
import { theme } from '../../config/theme';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';

interface Props { onBack: () => void }

export default function NotificationSettingsPage({ onBack }: Props) {
  const { user } = useAuth();
  const { notificationSettings, updateNotificationSettings } = useAppData();
  const [time, setTime] = useState(notificationSettings.dailyReminderTime);
  const [enabled, setEnabled] = useState(notificationSettings.dailyReminderEnabled);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateNotificationSettings(
      { dailyReminderTime: time, dailyReminderEnabled: enabled },
      user?.id ?? 'admin',
      user?.displayName ?? 'Admin',
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasChanges = time !== notificationSettings.dailyReminderTime || enabled !== notificationSettings.dailyReminderEnabled;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
        <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Notification Settings</h2>
      </div>

      <Card title="Daily Absence Reminder" subtitle="Automatic reminder about tomorrow's absences">
        {/* Enable/disable toggle */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs" style={{ color: theme.colors.white }}>Daily reminder enabled</span>
          <button
            onClick={() => setEnabled(!enabled)}
            className="w-11 h-6 rounded-full relative cursor-pointer transition-colors"
            style={{ backgroundColor: enabled ? theme.colors.primary : theme.colors.grayDarker }}
          >
            <div
              className="w-5 h-5 rounded-full absolute top-0.5 transition-all"
              style={{
                backgroundColor: theme.colors.white,
                left: enabled ? '22px' : '2px',
              }}
            />
          </button>
        </div>

        {/* Time picker */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>
            Reminder Time
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!enabled}
            className="w-full rounded-lg text-sm px-3 py-2.5"
            style={{
              backgroundColor: theme.colors.bgCard,
              border: `1px solid ${theme.colors.border}`,
              color: enabled ? theme.colors.white : theme.colors.grayDark,
              colorScheme: 'dark',
              opacity: enabled ? 1 : 0.5,
            }}
          />
          <p className="text-[10px] mt-1" style={{ color: theme.colors.grayDark }}>
            Default: 14:00. Sends a summary of who is off tomorrow.
          </p>
        </div>

        {/* Save */}
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handleSave} disabled={!hasChanges}>
            Save Changes
          </Button>
          {saved && <Badge color="success">Saved</Badge>}
        </div>
      </Card>

      {/* Current status */}
      <Card title="Current Configuration">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: theme.colors.grayDark }}>Status</span>
            <Badge color={notificationSettings.dailyReminderEnabled ? 'success' : 'gray'} size="xs">
              {notificationSettings.dailyReminderEnabled ? 'Active' : 'Disabled'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: theme.colors.grayDark }}>Time</span>
            <span className="text-xs" style={{ color: theme.colors.white }}>{notificationSettings.dailyReminderTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: theme.colors.grayDark }}>Delivery</span>
            <Badge color="warning" size="xs">In-App Only</Badge>
          </div>
        </div>
      </Card>

      <p className="text-[10px] px-1" style={{ color: theme.colors.grayDark }}>
        Push notifications and email delivery are not yet connected. Currently in-app only.
      </p>
    </div>
  );
}
