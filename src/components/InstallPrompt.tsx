import { useState, useEffect } from 'react';
import { theme } from '../config/theme';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if already installed as PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;

  useEffect(() => {
    if (isStandalone) return;

    // Check if dismissed recently (24h cooldown)
    const lastDismissed = localStorage.getItem('smi_install_dismissed');
    if (lastDismissed && Date.now() - parseInt(lastDismissed) < 86400000) {
      setDismissed(true);
      return;
    }

    // Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS detection
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setShowIOSPrompt(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSPrompt(false);
    localStorage.setItem('smi_install_dismissed', Date.now().toString());
  };

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !showIOSPrompt) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 px-4 pb-2 animate-[slideUp_0.3s_ease-out]">
      <div className="max-w-md mx-auto rounded-2xl p-4"
        style={{
          backgroundColor: theme.colors.bgElevated,
          border: `1px solid ${theme.colors.primary}30`,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
        }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: theme.colors.primary }}>
            <img src="/icons/icon-192.png" alt="" className="w-7 h-7 rounded-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>
              Install SMI Calendar
            </p>
            {deferredPrompt ? (
              <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>
                Add to your home screen for quick access
              </p>
            ) : (
              <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>
                Tap <span style={{ color: theme.colors.white }}>Share</span> →{' '}
                <span style={{ color: theme.colors.white }}>Add to Home Screen</span>
              </p>
            )}
          </div>
          <button type="button" onClick={handleDismiss} aria-label="Dismiss install prompt"
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
            style={{ color: theme.colors.grayDark }}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {deferredPrompt && (
          <button type="button" onClick={handleInstall}
            className="w-full mt-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            style={{ backgroundColor: theme.colors.primary, color: theme.colors.white }}>
            Install App
          </button>
        )}

        {showIOSPrompt && !deferredPrompt && (
          <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg"
            style={{ backgroundColor: theme.colors.bgCard }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M5 12l7-7 7 7" />
            </svg>
            <p className="text-[10px]" style={{ color: theme.colors.gray }}>
              In Safari: tap the <strong>Share</strong> button below, then <strong>"Add to Home Screen"</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
