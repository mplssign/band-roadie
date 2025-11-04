'use client';

import { Suspense, lazy } from 'react';
import { SessionSync } from '@/components/auth/SessionSync';
import { PWASessionSync } from '@/hooks/usePWASession';

// Lazy load non-critical PWA components
const PWABootstrap = lazy(() => import('@/components/pwa/PWABootstrap').then(m => ({ default: m.PWABootstrap })));
const PWARedirectHandler = lazy(() => import('@/components/pwa/PWARedirectHandler').then(m => ({ default: m.PWARedirectHandler })));
const ServiceWorkerNavigationHandler = lazy(() => import('@/components/pwa/ServiceWorkerNavigationHandler').then(m => ({ default: m.ServiceWorkerNavigationHandler })));
const ServiceWorkerRegistration = lazy(() => import('@/components/pwa/ServiceWorkerRegistration').then(m => ({ default: m.ServiceWorkerRegistration })));
const PWAPerformanceMonitor = lazy(() => import('@/components/pwa/PWAPerformanceMonitor').then(m => ({ default: m.PWAPerformanceMonitor })));
const PWAErrorHandler = lazy(() => import('@/components/pwa/PWAErrorHandler').then(m => ({ default: m.PWAErrorHandler })));
const NetworkStatusIndicator = lazy(() => import('@/components/pwa/PWAErrorHandler').then(m => ({ default: m.NetworkStatusIndicator })));

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      {/* Critical components loaded immediately */}
      <SessionSync />
      <PWASessionSync />
      
      {/* Non-critical PWA components loaded after initial render */}
      <Suspense fallback={null}>
        <ServiceWorkerRegistration />
        <PWABootstrap />
        <PWARedirectHandler />
        <ServiceWorkerNavigationHandler />
        <PWAPerformanceMonitor />
        <PWAErrorHandler />
        <NetworkStatusIndicator />
      </Suspense>
      
      {children}
    </>
  );
}
