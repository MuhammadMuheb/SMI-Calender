import { useState } from 'react';
import { toast } from 'sonner';
import { BellRing, ChevronRight, KeyRound, LogOut, Monitor, Moon, Send, Sun } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppData } from '@/app/AppDataContext';
import { useNotifications } from '@/features/notifications/NotificationContext';
import { ROLE_LABELS } from '@/config/roles';
import { subscribeToPush, sendPushToUser } from '@/features/notifications/pushManager';
import { authenticateUser } from '@/features/auth/authService';
import { useTheme, type ThemeMode } from '@/components/theme/ThemeProvider';
import { PageHeader } from '@/components/shared/PageHeader';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';

type PushStatus = 'enabled' | 'not_enabled' | 'denied' | 'unsupported' | 'need_pwa';

const PUSH_STATUS_TEXT: Record<PushStatus, string> = {
  enabled: 'On. You’ll get alerts even when the app is closed.',
  not_enabled: 'Off. Turn them on to get shift reminders.',
  denied: 'Blocked. Allow notifications for this app in your phone or browser settings.',
  unsupported: 'This browser doesn’t support push notifications.',
  need_pwa: 'Add the app to your home screen first, then turn them on.',
};

function detectPushStatus(): PushStatus {
  if (!('Notification' in window)) return 'unsupported';
  if (!('PushManager' in window)) return 'need_pwa';
  if (Notification.permission === 'granted') return 'enabled';
  if (Notification.permission === 'denied') return 'denied';
  return 'not_enabled';
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { updateUser } = useAppData();
  const { pushEnabled } = useNotifications();
  const { mode, setMode } = useTheme();
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(false);

  const [pushStatus, setPushStatus] = useState<PushStatus>(detectPushStatus);
  const [pushLoading, setPushLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);

  if (!user) return null;

  const status: PushStatus = pushEnabled ? 'enabled' : pushStatus;

  const handleEnablePush = async () => {
    setPushLoading(true);
    const result = await subscribeToPush(user.id);
    if (result.ok) {
      setPushStatus('enabled');
      toast.success('Push notifications turned on');
    } else {
      toast.error('Couldn’t turn on push notifications', { description: result.error ?? 'Unknown error' });
    }
    setPushLoading(false);
  };

  const handleTestPush = async () => {
    setTestSending(true);
    const result = await sendPushToUser(user.id, 'Test notification', 'Push notifications are working!', 'test');
    setTestSending(false);
    if (result.ok) toast.success('Test notification sent', { description: 'Check your phone.' });
    else toast.error('Couldn’t send the test notification', { description: result.error });
  };

  const resetPinForm = () => { setCurrentPin(''); setNewPin(''); setConfirmPin(''); setPinError(''); };

  const handlePinChange = async () => {
    setPinError('');
    if (!currentPin || currentPin.length < 4) { setPinError('Enter your current PIN.'); return; }
    if (!newPin || newPin.length < 4) { setPinError('Your new PIN needs at least 4 digits.'); return; }
    if (newPin !== confirmPin) { setPinError('The new PINs don’t match.'); return; }
    if (newPin === currentPin) { setPinError('Choose a PIN that’s different from your current one.'); return; }
    setLoading(true);
    const verified = await authenticateUser(user.username, currentPin);
    if (!verified) { setPinError('Your current PIN is incorrect.'); setLoading(false); return; }
    updateUser(user.id, { pin: newPin }, user.displayName);
    setLoading(false);
    setShowPinChange(false);
    resetPinForm();
    toast.success('PIN updated', { description: 'Signing you out so you can sign in with your new PIN.' });
    setTimeout(() => { logout(); }, 1500);
  };

  const closePinModal = () => { setShowPinChange(false); resetPinForm(); };

  const pinInput = (id: string, label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <Field data-invalid={pinError ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete={autoComplete}
        placeholder="••••"
        value={value}
        onChange={(e) => { set(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
        className="h-10"
      />
    </Field>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Your profile, appearance and notifications." />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.displayName} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{user.displayName}</p>
              <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
            </div>
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
          </div>
          <Button variant="outline" size="lg" className="w-full justify-between" onClick={() => setShowPinChange(true)}>
            <span className="flex items-center gap-2"><KeyRound /> Change PIN</span>
            <ChevronRight className="text-muted-foreground" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose a theme, or follow your device setting.</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            variant="outline"
            size="lg"
            spacing={0}
            value={mode}
            onValueChange={(v) => { if (v) setMode(v as ThemeMode); }}
            className="w-full"
            aria-label="Theme"
          >
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <ToggleGroupItem key={value} value={value} className="flex-1 data-[state=on]:text-primary" aria-label={label}>
                <Icon /> {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Get shift reminders even when the app is closed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <BellRing className={status === 'enabled' ? 'size-4 text-success' : 'size-4 text-muted-foreground'} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Push notifications</p>
              <p className="text-sm text-muted-foreground">{PUSH_STATUS_TEXT[status]}</p>
            </div>
            {status === 'enabled' && (
              <Badge variant="outline" className="border-success/30 text-success">On</Badge>
            )}
          </div>

          {(status === 'not_enabled' || status === 'need_pwa') && (
            <Button size="lg" className="w-full" onClick={handleEnablePush} disabled={pushLoading}>
              {pushLoading ? <Spinner /> : <BellRing />}
              Enable push notifications
            </Button>
          )}

          {status === 'enabled' && (
            <Button variant="outline" size="lg" className="w-full" onClick={handleTestPush} disabled={testSending}>
              {testSending ? <Spinner /> : <Send />}
              Send a test notification
            </Button>
          )}
        </CardContent>
      </Card>

      <Button
        variant="outline"
        size="lg"
        className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={logout}
      >
        <LogOut /> Sign out
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Show Me Italy Staff Calendar v1.0.0
      </p>

      <ResponsiveDialog
        open={showPinChange}
        onOpenChange={(next) => { if (!next) closePinModal(); }}
        title="Change PIN"
        description="You’ll be signed out after changing it."
        size="sm"
        footer={<>
          <Button variant="outline" size="lg" onClick={closePinModal}>Cancel</Button>
          <Button size="lg" onClick={handlePinChange} disabled={loading}>
            {loading && <Spinner />}
            {loading ? 'Checking…' : 'Update PIN'}
          </Button>
        </>}
      >
        <form onSubmit={(e) => { e.preventDefault(); handlePinChange(); }} noValidate>
          <FieldGroup>
            {pinInput('current-pin', 'Current PIN', currentPin, setCurrentPin, 'current-password')}
            {pinInput('new-pin', 'New PIN', newPin, setNewPin, 'new-password')}
            {pinInput('confirm-pin', 'Confirm new PIN', confirmPin, setConfirmPin, 'new-password')}
            {pinError && <FieldError>{pinError}</FieldError>}
          </FieldGroup>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </ResponsiveDialog>
    </div>
  );
}
