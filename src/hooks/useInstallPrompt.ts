import { useEffect, useState, useCallback } from 'react';
import { isNativeApp } from '../lib/platform';

// Chrome stores the event so it can be replayed when the user is
// ready. Type the subset we actually use.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/**
 * Captures the `beforeinstallprompt` event on Android Chrome/Edge and
 * exposes a `promptInstall()` trigger plus convenience flags. On iOS
 * Safari (which doesn't fire this event) we fall back to detecting
 * standalone mode so the caller can show a "how to install" hint
 * instead of a native prompt button.
 */
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    // Platform sniff — rough but good enough for install-hint UX.
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (/iPhone|iPad|iPod/.test(ua)) setPlatform('ios');
      else if (/Android/.test(ua)) setPlatform('android');
      else setPlatform('desktop');
    }

    // Already running inside a Capacitor native shell? Treat as
    // installed — don't show the "install as PWA" UI when the user
    // is already in the Play Store app.
    if (isNativeApp()) {
      setInstalled(true);
      return;
    }

    // Already running as an installed PWA?
    const mq = typeof window !== 'undefined'
      ? window.matchMedia('(display-mode: standalone)')
      : null;
    if (mq?.matches) setInstalled(true);
    // Also handle iOS Safari's non-standard flag.
    if (typeof navigator !== 'undefined' && (navigator as any).standalone === true) {
      setInstalled(true);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredEvent) return 'unavailable';
    try {
      await deferredEvent.prompt();
      const { outcome } = await deferredEvent.userChoice;
      setDeferredEvent(null);
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, [deferredEvent]);

  return {
    canInstall: !!deferredEvent,
    installed,
    platform,
    promptInstall,
  };
}
