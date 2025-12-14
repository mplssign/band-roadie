'use client';

import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface AppLoadingBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const DefaultFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <LoadingSpinner size="large" />
      <div className="text-muted-foreground">Loading Band Roadie...</div>
    </div>
  </div>
);

export function AppLoadingBoundary({ children, fallback }: AppLoadingBoundaryProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Detect PWA mode for faster loading
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                 ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
    
    // Shorter delay for PWA to improve perceived performance
    const delay = isPWA ? 50 : 100;
    
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  if (!isHydrated) {
    return fallback || <DefaultFallback />;
  }

  return <>{children}</>;
}