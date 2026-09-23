import { useState, useEffect } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** True when the prompt was dismissed in the last 24 hours. */
function dismissedRecently(): boolean {
  try {
    const lastDismissed = localStorage.getItem('smi_install_dismissed');
    return !!lastDismissed && Date.now() - parseInt(lastDismissed) < 86400000;
  } catch {
    return false;
  }
}

/** iOS Safari has no install event, so we show manual instructions there. */
function isIOSSafari(): boolean {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
  return isIOS && isSafari;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(isIOSSafari);
  const [dismissed, setDismissed] = useState(dismissedRecently);

  // Check if already installed as PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;

  useEffect(() => {
    if (isStandalone || dismissed) return;

    // Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone, dismissed]);

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
    try { localStorage.setItem('smi_install_dismissed', Date.now().toString()); } catch { /* storage unavailable */ }
  };

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !showIOSPrompt) return null;

  return (
    <div
      role="region"
      aria-label="Install app"
      className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-40 px-4 animate-in fade-in-0 slide-in-from-bottom-4 lg:bottom-4"
    >
      <Card size="sm" className="relative mx-auto max-w-md gap-3 px-3 shadow-lg">
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X />
        </Button>

        <div className="flex items-start gap-3 pr-8">
          <img src="/icons/logo.png" alt="" aria-hidden="true" className="size-10 shrink-0 rounded-xl border object-cover" />
          <div className="min-w-0">
            <p className="font-medium">Install Show Me Italy</p>
            {deferredPrompt ? (
              <p className="text-sm text-muted-foreground">
                Add the staff calendar to your home screen for quick access and push alerts.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                In Safari, tap <Share className="inline size-3.5 align-[-2px]" aria-hidden="true" />{' '}
                <span className="font-medium text-foreground">Share</span>, then{' '}
                <SquarePlus className="inline size-3.5 align-[-2px]" aria-hidden="true" />{' '}
                <span className="font-medium text-foreground">Add to Home Screen</span>.
              </p>
            )}
          </div>
        </div>

        {deferredPrompt ? (
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={handleDismiss}>Not now</Button>
            <Button size="lg" className="flex-1" onClick={handleInstall}>
              <Download /> Install
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="lg" className="w-full" onClick={handleDismiss}>Not now</Button>
        )}
      </Card>
    </div>
  );
}
