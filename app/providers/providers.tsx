'use client';

import { Suspense } from 'react';
import { SessionSync } from '@/components/auth/SessionSync';
import { PWABootstrap } from '@/components/pwa/PWABootstrap';
import { PWARedirectHandler } from '@/components/pwa/PWARedirectHandler';
import { ServiceWorkerNavigationHandler } from '@/components/pwa/ServiceWorkerNavigationHandler';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { PWAPerformanceMonitor } from '@/components/pwa/PWAPerformanceMonitor';
import { PWAErrorHandler, NetworkStatusIndicator } from '@/components/pwa/PWAErrorHandler';
import { PWASessionSync } from '@/hooks/usePWASession';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      <SessionSync />
      <PWASessionSync />
      <ServiceWorkerRegistration />
      <PWAPerformanceMonitor />
      <PWAErrorHandler />
      <NetworkStatusIndicator />
      <Suspense fallback={null}>
        <PWABootstrap />
        <PWARedirectHandler />
        <ServiceWorkerNavigationHandler />
      </Suspense>
      {children}
    </>
  );
}
