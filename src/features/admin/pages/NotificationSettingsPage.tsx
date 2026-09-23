import { TranslatedText } from '@/i18n/LanguageContext';
import { useState, type FormEvent } from 'react';
import { Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAppData } from '@/app/AppDataContext';
import { useAuth } from '@/features/auth/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';

interface Props { onBack: () => void }

export default function NotificationSettingsPage({ onBack }: Props) {
  const { user } = useAuth();
  const { notificationSettings, updateNotificationSettings } = useAppData();
  const [time, setTime] = useState(notificationSettings.dailyReminderTime);
  const [enabled, setEnabled] = useState(notificationSettings.dailyReminderEnabled);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      // The context types this as void, but the implementation is async.
      await Promise.resolve(updateNotificationSettings(
        { dailyReminderTime: time, dailyReminderEnabled: enabled },
        user?.id ?? 'admin',
        user?.displayName ?? 'Admin',
      ));
      toast.success('Notification settings saved');
    } catch {
      toast.error('Couldn’t save the settings. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = time !== notificationSettings.dailyReminderTime || enabled !== notificationSettings.dailyReminderEnabled;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification settings"
        description="Control the automatic reminders the team receives."
        onBack={onBack}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <form onSubmit={handleSave}>
          <Card>
            <CardHeader>
              <CardTitle>Daily absence reminder</CardTitle>
              <CardDescription>A daily summary of who is off tomorrow.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="daily-reminder-enabled">Send daily reminder</FieldLabel>
                    <FieldDescription>Turn off to stop the summary for everyone.</FieldDescription>
                  </FieldContent>
                  <Switch id="daily-reminder-enabled" checked={enabled} onCheckedChange={setEnabled} />
                </Field>
                <Field data-disabled={!enabled ? true : undefined}>
                  <FieldLabel htmlFor="daily-reminder-time">Reminder time</FieldLabel>
                  <Input
                    id="daily-reminder-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    disabled={!enabled}
                    className="h-9 w-40"
                  />
                  <FieldDescription>The default is 14:00.</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t">
              {hasChanges && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setTime(notificationSettings.dailyReminderTime); setEnabled(notificationSettings.dailyReminderEnabled); }}
                  disabled={saving}
                >
                  Discard
                </Button>
              )}
              <Button type="submit" disabled={!hasChanges || saving}>
                {saving && <Spinner data-icon="inline-start" />}
                Save changes
              </Button>
            </CardFooter>
          </Card>
        </form>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground"><TranslatedText text="Status" /></dt>
                  <dd>
                    {notificationSettings.dailyReminderEnabled ? (
                      <Badge variant="secondary" className="border-transparent bg-success/12 text-success"><TranslatedText text="Active" /></Badge>
                    ) : (
                      <Badge variant="secondary" className="border-transparent bg-muted text-muted-foreground"><TranslatedText text="Off" /></Badge>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Time</dt>
                  <dd className="font-medium tabular-nums">{notificationSettings.dailyReminderTime}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd><Badge variant="outline">In-app only</Badge></dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Alert>
            <Info />
            <AlertDescription>
              Push and email delivery aren’t connected yet, so reminders only appear in the app.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
