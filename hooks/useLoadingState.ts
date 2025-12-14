'use client';

import { useCallback, useRef, useState } from 'react';

interface UseLoadingStateOptions {
  timeout?: number;
  onTimeout?: () => void;
}

export function useLoadingState(options: UseLoadingStateOptions = {}) {
  const { timeout = 10000, onTimeout } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const startLoading = useCallback(() => {
    if (loadingRef.current) return false;
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    // Set up timeout
    if (timeout > 0) {
      timeoutRef.current = setTimeout(() => {
        if (loadingRef.current) {
          loadingRef.current = false;
          setLoading(false);
          setError('Request timed out');
          onTimeout?.();
        }
      }, timeout);
    }

    return true;
  }, [timeout, onTimeout]);

  const stopLoading = useCallback((errorMessage?: string) => {
    loadingRef.current = false;
    setLoading(false);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    if (errorMessage) {
      setError(errorMessage);
    }
  }, []);

  const isLoading = useCallback(() => {
    return loadingRef.current;
  }, []);

  return {
    loading,
    error,
    startLoading,
    stopLoading,
    isLoading,
  };
}