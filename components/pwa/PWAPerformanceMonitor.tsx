'use client';

import { useEffect } from 'react';

export function PWAPerformanceMonitor() {
  useEffect(() => {
    // Only run in PWA mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                 ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

    if (!isPWA) return;

    // Preload critical resources for faster navigation
    const preloadCriticalResources = () => {
      const criticalPaths = [
        '/dashboard',
        '/profile',
        '/calendar',
        '/setlists',
      ];

      criticalPaths.forEach(path => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = path;
        document.head.appendChild(link);
      });
    };

    // Optimize images and assets
    const optimizeAssets = () => {
      // Preload critical images
      const criticalImages = [
        '/icon-192x192.png',
        '/apple-touch-icon.png',
      ];

      criticalImages.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
      });
    };

    // Monitor performance metrics
    const monitorPerformance = () => {
      if ('performance' in window && 'getEntriesByType' in window.performance) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'paint') {
              // Track paint metrics for PWA optimization
              if (entry.name === 'first-contentful-paint') {
                // Store performance data for optimization
                sessionStorage.setItem('pwa_fcp', entry.startTime.toString());
              }
            }
          });
        });

        observer.observe({ entryTypes: ['paint', 'navigation'] });
      }
    };

    // Run optimizations
    setTimeout(preloadCriticalResources, 100);
    setTimeout(optimizeAssets, 200);
    monitorPerformance();

    // Cleanup function
    return () => {
      // Remove prefetch links on unmount to prevent memory leaks
      const prefetchLinks = document.querySelectorAll('link[rel="prefetch"]');
      prefetchLinks.forEach(link => link.remove());
    };
  }, []);

  return null;
}