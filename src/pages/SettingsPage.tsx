import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { ROLE_LABELS, ROLE_BADGE_COLOR, ROLES } from '../config/roles';
import { theme } from '../config/theme';
import { alpha } from '../utils/themeColor';
import { Card, Badge, Button, Modal, FormInput, Icons } from '../components/ui';
import { subscribeToPush, sendPushToUser } from '../utils/pushManager';
import { authenticateUser } from '../services/supabaseService';
import AdminControlsSection from '../components/AdminControlsSection';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { updateUser } = useAppData();
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const [pushStatus, setPushStatus] = useState<string>('checking...');
  const [pushError, setPushError] = useState('');
  const [pushLoading, setPushLoading] = useState(false);
  const [testResult, setTestResult] = useState('');

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) setPushStatus('unsupported');
    else if (!('PushManager' in window)) setPushStatus('need_pwa');
    else if (Notification.permission === 'granted') setPushStatus('enabled');
    else if (Notification.permission === 'denied') setPushStatus('denied');
    else setPushStatus('not_enabled');
  }, []);

  // Detect mobile at runtime (not build time)
  useEffect(() => {
    const checkMobile = () => {
      // Only show Management Console on screens 1023px and below (< 1024px)
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!user) return null;

  const handleEnablePush = async () => {
    setPushLoading(true);
    setPushError('');
    const result = await subscribeToPush(user.id);
    if (result.ok) {
      setPushStatus('enabled');
    } else {
      setPushError(result.error ?? 'Unknown error');
    }
    setPushLoading(false);
  };

  const handleTestPush = async () => {
    setTestResult('Sending...');
    const result = await sendPushToUser(user.id, '🔔 Test Notification', 'Push notifications are working!', 'test');
    setTestResult(result.ok ? '✓ Sent! Check your phone' : `✕ Failed: ${result.error}`);
    setTimeout(() => setTestResult(''), 5000);
  };

  const handlePinChange = async () => {
    setPinError('');
    if (!currentPin || currentPin.length < 4) { setPinError('Enter your current PIN'); return; }
    if (!newPin || newPin.length < 4) { setPinError('New PIN must be 4+ digits'); return; }
    if (newPin !== confirmPin) { setPinError('PINs do not match'); return; }
    if (newPin === currentPin) { setPinError('New PIN must be different'); return; }
    setLoading(true);
    const verified = await authenticateUser(user.username, currentPin);
    if (!verified) { setPinError('Current PIN is incorrect'); setLoading(false); return; }
    updateUser(user.id, { pin: newPin }, user.displayName);
    setLoading(false);
    setPinSuccess(true);
    setTimeout(() => { setPinSuccess(false); setShowPinChange(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); logout(); }, 1500);
  };

  const closePinModal = () => { setShowPinChange(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setPinError(''); setPinSuccess(false); };

  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Settings</h2>

      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: theme.colors.primary, color: theme.colors.white }}>
            {user.displayName[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: theme.colors.white }}>{user.displayName}</p>
            <Badge color={ROLE_BADGE_COLOR[user.role]} size="xs">{ROLE_LABELS[user.role].toUpperCase()}</Badge>
          </div>
        </div>
      </Card>

      {/* Push Notifications */}
      <Card title="Notifications" subtitle="Get shift reminders even when app is closed">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: theme.colors.white }}>Push Notifications</p>
              <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
                {pushStatus === 'enabled' && '✅ Enabled — you will receive alerts'}
                {pushStatus === 'not_enabled' && 'Tap Enable to turn on notifications'}
                {pushStatus === 'denied' && '❌ Blocked — enable in phone settings'}
                {pushStatus === 'unsupported' && '❌ Not supported on this browser'}
                {pushStatus === 'need_pwa' && '⚠️ Install app to home screen first'}
                {pushStatus === 'checking...' && 'Checking...'}
              </p>
            </div>
            {(pushStatus === 'not_enabled' || pushStatus === 'need_pwa') && (
              <Button variant="primary" size="sm" onClick={handleEnablePush} disabled={pushLoading}>
                {pushLoading ? '...' : 'Enable'}
              </Button>
            )}
            {pushStatus === 'enabled' && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: alpha(theme.colors.primary, '20') }}>
                <span style={{ color: theme.colors.primary, fontSize: 14 }}>✓</span>
              </div>
            )}
          </div>

          {/* Error display */}
          {pushError && (
            <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: alpha(theme.colors.danger, '15'), border: `1px solid ${alpha(theme.colors.danger, '30')}` }}>
              <p className="text-[10px] font-medium" style={{ color: theme.colors.danger }}>Error: {pushError}</p>
            </div>
          )}

          {pushStatus === 'enabled' && (
            <Button variant="outline" size="sm" fullWidth onClick={handleTestPush}>
              🔔 Send Test Notification
            </Button>
          )}

          {/* Test result */}
          {testResult && (
            <p className="text-[10px] text-center" style={{ color: testResult.includes('✓') ? theme.colors.primary : theme.colors.danger }}>
              {testResult}
            </p>
          )}
        </div>
      </Card>

      <button onClick={() => setShowPinChange(true)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer"
        style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}>
        <span className="text-xs font-medium" style={{ color: theme.colors.white }}>Change PIN</span>
        <span style={{ color: theme.colors.grayDark }}>{Icons.chevronRight}</span>
      </button>

      {/* Management Console - ONLY visible on screens 1023px and below to super_admin */}
      {/* Dual protection: JS runtime check + CSS media query at 1024px breakpoint */}
      {user.role === ROLES.SUPER_ADMIN && (
        <div
          data-mobile-only="true"
          style={{
            display: isMobile ? 'block' : 'none',
          }}
          className="lg:hidden"
        >
          <AdminControlsSection />
        </div>
      )}

      <Button variant="secondary" fullWidth onClick={logout}>Sign Out</Button>

      <p className="text-center text-[10px]" style={{ color: theme.colors.grayDarker }}>
        Show Me Italy Staff Calendar v1.0.0
      </p>

      <Modal open={showPinChange} onClose={closePinModal} title="Change PIN"
        footer={!pinSuccess ? <>
          <Button variant="outline" onClick={closePinModal}>Cancel</Button>
          <Button onClick={handlePinChange} disabled={loading}>{loading ? 'Verifying...' : 'Update PIN'}</Button>
        </> : undefined}>
        {pinSuccess ? (
          <div className="flex items-center gap-2">
            <Badge color="success">Done</Badge>
            <span className="text-xs" style={{ color: theme.colors.success }}>PIN updated — signing you out...</span>
          </div>
        ) : (
          <>
            <FormInput label="Current PIN" type="password" placeholder="••••" value={currentPin}
              onChange={(e) => { setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }} />
            <FormInput label="New PIN" type="password" placeholder="••••" value={newPin}
              onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }} />
            <FormInput label="Confirm New PIN" type="password" placeholder="••••" value={confirmPin}
              onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }} />
            {pinError && <p className="text-xs" style={{ color: theme.colors.danger }}>{pinError}</p>}
          </>
        )}
      </Modal>
    </div>
  );
}
