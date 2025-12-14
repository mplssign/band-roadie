'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export function PWARedirectHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const pwaPreferred = searchParams?.get('pwa_preferred') === '1';
    
    if (pwaPreferred && 'serviceWorker' in navigator) {
      // Clean up the URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('pwa_preferred');
      
      // Try to trigger PWA launch if available
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
      
      if (!isStandalone && !isIOSStandalone) {
        // If we're not in PWA mode but PWA is preferred, 
        // check if the app is installed and can be launched
        if ('getInstalledRelatedApps' in navigator) {
          interface RelatedApp {
            platform: string;
            url: string;
            id?: string;
          }
          
          (navigator as { getInstalledRelatedApps(): Promise<RelatedApp[]> }).getInstalledRelatedApps()
            .then((_relatedApps: RelatedApp[]) => {
              // Note: Due to browser security, we can't force launch the PWA
              // but the manifest.json capture_links should handle this
              // _relatedApps.length indicates if PWA is installed
            }).catch(() => {
            // Fallback: just continue in browser
          });
        }
      }
      
      // Update URL without the parameter
      router.replace(url.pathname + url.search + url.hash, { scroll: false });
    }
  }, [searchParams, router]);

  return null;
}