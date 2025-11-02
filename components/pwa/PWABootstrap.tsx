'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function PWABootstrap() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Detect if launched from PWA
    const isPWALaunch = searchParams?.get('source') === 'pwa' || 
                      window.matchMedia('(display-mode: standalone)').matches ||
                      ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

    if (isPWALaunch) {
      // Set a cookie to indicate PWA launch for server-side handling
      document.cookie = `pwa_source=pwa; path=/; max-age=300; samesite=lax`;
      
      // Prevent navigation delays by pre-warming critical resources
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(() => {
          // Service worker is ready - app should load faster
        }).catch(() => {
          // Fallback if SW fails
        });
      }
    }

    // Clean up the PWA source indicator after a short time
    const cleanup = setTimeout(() => {
      document.cookie = `pwa_source=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
    }, 5000);

    return () => clearTimeout(cleanup);
  }, [searchParams]);

  return null;
}