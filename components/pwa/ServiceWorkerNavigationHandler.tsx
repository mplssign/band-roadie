'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function ServiceWorkerNavigationHandler() {
  const router = useRouter();

  useEffect(() => {
    // Listen for navigation messages from the service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE_TO') {
        const url = event.data.url;
        try {
          const urlObj = new URL(url, window.location.origin);
          // Only navigate to same-origin URLs for security
          if (urlObj.origin === window.location.origin) {
            router.push(urlObj.pathname + urlObj.search + urlObj.hash);
          }
        } catch (error) {
          // Invalid URL, ignore
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [router]);

  return null;
}