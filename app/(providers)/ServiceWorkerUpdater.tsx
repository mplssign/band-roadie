'use client';
import { useEffect, useRef } from 'react';

export default function ServiceWorkerUpdater() {
  const activated = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        const triggerUpdate = () => reg.update();
        // Check soon after mount and whenever tab gains focus
        const onVisible = () => { if (document.visibilityState === 'visible') triggerUpdate(); };
        setTimeout(triggerUpdate, 3000);
        document.addEventListener('visibilitychange', onVisible);

        const promptSwap = () => {
          if (activated.current) return;
          activated.current = true;
          reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
          }, { once: true });
        };

        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && reg.waiting) promptSwap();
          });
        });

        if (reg.waiting) promptSwap();
      } catch (error) {
        // Service worker registration failed - silently ignore in production
        console.debug('Service worker registration failed:', error);
      }
    };

    register();
  }, []);

  return null;
}