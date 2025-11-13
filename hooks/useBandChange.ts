/**
 * Custom hook to react to band changes
 * Use this in components that need to refetch data when the user switches bands
 */

import { useEffect, useRef } from 'react';
import { useBands } from '@/contexts/BandsContext';

const BAND_CHANGE_EVENT = 'band-changed';

interface UseBandChangeOptions {
  /**
   * Callback to execute when band changes
   */
  onBandChange?: () => void | Promise<void>;

  /**
   * Whether to also call the callback on mount
   * Useful for initial data fetching
   */
  callOnMount?: boolean;
}

/**
 * Hook that triggers a callback when the current band changes
 *
 * @example
 * ```tsx
 * useBandChange({
 *   onBandChange: () => {
 *     // Refetch data for new band
 *     fetchGigs();
 *     fetchRehearsals();
 *   }
 * });
 * ```
 */
export function useBandChange(options: UseBandChangeOptions = {}) {
  const { onBandChange, callOnMount = false } = options;
  const { currentBand } = useBands();
  const previousBandIdRef = useRef<string | null>(currentBand?.id || null);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Call on mount if requested
    if (callOnMount && !mountedRef.current && currentBand && onBandChange) {
      onBandChange();
    }
    mountedRef.current = true;
  }, [callOnMount, currentBand, onBandChange]);

  useEffect(() => {
    // Track band changes via the custom event
    const handleBandChange = () => {
      if (onBandChange) {
        onBandChange();
      }
    };

    window.addEventListener(BAND_CHANGE_EVENT, handleBandChange);

    return () => {
      window.removeEventListener(BAND_CHANGE_EVENT, handleBandChange);
    };
  }, [onBandChange]);

  useEffect(() => {
    // Also track via currentBand prop changes (belt and suspenders)
    if (currentBand?.id && currentBand.id !== previousBandIdRef.current) {
      const oldBandId = previousBandIdRef.current;
      previousBandIdRef.current = currentBand.id;
      
      if (onBandChange && mountedRef.current) {
        console.log('[useBandChange] Band changed from', oldBandId, 'to', currentBand.id);
        onBandChange();
      }
    }
  }, [currentBand, onBandChange]);
}

/**
 * Hook to get the current band ID
 * Returns null if no band is selected
 */
export function useCurrentBandId(): string | null {
  const { currentBand } = useBands();
  return currentBand?.id || null;
}
