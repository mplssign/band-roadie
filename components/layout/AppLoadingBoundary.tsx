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
    // Add a small delay to prevent flash of loading screen
    // for pages that load quickly
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!isHydrated) {
    return fallback || <DefaultFallback />;
  }

  return <>{children}</>;
}