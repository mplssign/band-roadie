'use client';

import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface UsePWAInstallReturn {
  isStandalone: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  canPrompt: boolean;
  shouldShowBanner: boolean;
  promptInstall: () => Promise<void>;
  dismiss: () => void;
}

const DISMISSAL_KEY = 'pwa-install-dismissed';
const DISMISSAL_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const checkStandalone = () => {
      const standalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true) ||
        document.referrer.includes('android-app://');
      
      setIsStandalone(standalone);
      return standalone;
    };

    // Detect platform
    const detectPlatform = () => {
      const ua = window.navigator.userAgent;
      const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
      const isAndroidDevice = /Android/.test(ua);
      
      setIsIOS(isIOSDevice);
      setIsAndroid(isAndroidDevice);
      
      return { isIOSDevice, isAndroidDevice };
    };

    // Check if embedded in iframe
    const checkEmbedded = () => {
      const embedded = window.self !== window.top;
      setIsEmbedded(embedded);
      return embedded;
    };

    // Check dismissal status
    const checkDismissal = () => {
      const dismissedStr = localStorage.getItem(DISMISSAL_KEY);
      if (dismissedStr) {
        const dismissedTime = parseInt(dismissedStr, 10);
        const now = Date.now();
        const dismissed = now - dismissedTime < DISMISSAL_DURATION;
        setIsDismissed(dismissed);
        return dismissed;
      }
      return false;
    };

    // Initialize checks
    const standalone = checkStandalone();
    const { isIOSDevice } = detectPlatform();
    const embedded = checkEmbedded();
    checkDismissal();

    // Early exit if already installed or embedded
    if (standalone || embedded) {
      return;
    }

    // Handle beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing
      e.preventDefault();
      
      // Save the event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      // Clear the deferredPrompt
      setDeferredPrompt(null);
      setIsStandalone(true);
      
      // Clear dismissal
      localStorage.removeItem(DISMISSAL_KEY);
    };

    // Listen for install events (non-iOS)
    if (!isIOSDevice) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
    }

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
    };
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    return () => {
      if (!isIOSDevice) {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      }
      
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user's response
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        // User accepted the install prompt
        setDeferredPrompt(null);
      }
    } catch (error) {
      // Silently handle errors
      console.error('Install prompt error:', error);
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSAL_KEY, Date.now().toString());
    setIsDismissed(true);
  }, []);

  const canPrompt = !isStandalone && !!deferredPrompt;
  const shouldShowBanner = 
    !isStandalone && 
    !isDismissed && 
    !isEmbedded &&
    (canPrompt || isIOS);

  return {
    isStandalone,
    isIOS,
    isAndroid,
    canPrompt,
    shouldShowBanner,
    promptInstall,
    dismiss,
  };
}
