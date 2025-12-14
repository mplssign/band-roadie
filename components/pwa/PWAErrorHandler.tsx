'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface PWAError {
  type: 'network' | 'auth' | 'timeout' | 'session' | 'generic';
  message: string;
  recoverable: boolean;
}

export function PWAErrorHandler() {
  const router = useRouter();
  const [error, setError] = useState<PWAError | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [retryAttempts, setRetryAttempts] = useState(0);

  useEffect(() => {
    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setIsOnline(navigator.onLine);

    // Handle global errors
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || 'An unexpected error occurred';
      
      // Categorize errors
      let errorType: PWAError['type'] = 'generic';
      const recoverable = true;

      if (errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
        errorType = 'network';
      } else if (errorMessage.includes('auth') || errorMessage.includes('session')) {
        errorType = 'auth';
      } else if (errorMessage.includes('timeout')) {
        errorType = 'timeout';
      }

      setError({
        type: errorType,
        message: errorMessage,
        recoverable,
      });
    };

    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      let errorMessage = 'An error occurred';
      let errorType: PWAError['type'] = 'generic';

      if (reason instanceof Error) {
        errorMessage = reason.message;
      } else if (typeof reason === 'string') {
        errorMessage = reason;
      }

      if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
        errorType = 'network';
      } else if (errorMessage.includes('Session') || errorMessage.includes('Authentication')) {
        errorType = 'session';
      }

      setError({
        type: errorType,
        message: errorMessage,
        recoverable: true,
      });

      // Prevent default browser error handling
      event.preventDefault();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const handleRetry = () => {
    setError(null);
    setRetryAttempts(prev => prev + 1);
    
    // Try to reload the current page
    window.location.reload();
  };

  const handleLogin = () => {
    setError(null);
    router.push('/login');
  };

  const handleGoHome = () => {
    setError(null);
    router.push('/dashboard');
  };

  // Don't show error overlay if no error
  if (!error) {
    return null;
  }

  // Show network status indicator for network errors
  if (error.type === 'network' && !isOnline) {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <WifiOff className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">You&apos;re offline</h2>
            <p className="text-muted-foreground">
              Check your internet connection and try again.
            </p>
          </div>
          <button
            onClick={handleRetry}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <RefreshCw className="h-4 w-4 inline mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show auth error dialog
  if (error.type === 'auth' || error.type === 'session') {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Session expired</h2>
            <p className="text-muted-foreground">
              Your session has expired. Please sign in again.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGoHome}
              className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLogin}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show generic error dialog
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">
          <AlertTriangle className="h-12 w-12 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground text-sm mb-2">
            {error.message}
          </p>
          {retryAttempts > 0 && (
            <p className="text-muted-foreground text-xs">
              Retry attempts: {retryAttempts}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGoHome}
            className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Go Home
          </button>
          {error.recoverable && (
            <button
              onClick={handleRetry}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="h-4 w-4 inline mr-2" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Network status indicator component
export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowIndicator(true);
      // Hide the indicator after 3 seconds
      setTimeout(() => setShowIndicator(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showIndicator) return null;

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-40 px-3 py-2 rounded-full text-sm font-medium transition-all ${
      isOnline 
        ? 'bg-green-500 text-white' 
        : 'bg-red-500 text-white'
    }`}>
      <div className="flex items-center gap-2">
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>Back online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Offline</span>
          </>
        )}
      </div>
    </div>
  );
}