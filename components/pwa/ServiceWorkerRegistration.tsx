'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
          });

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker is available
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });

          // Notify service worker that PWA is ready
          if (registration.active) {
            registration.active.postMessage({ type: 'PWA_READY' });
          }
        } catch (error) {
          // Service worker registration failed, but continue without it
        }
      };

      registerSW();
    }
  }, []);

  return null;
}