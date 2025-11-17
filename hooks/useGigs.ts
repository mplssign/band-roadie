/**
 * React hooks for unified gig data management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchBandGigs,
  fetchPotentialGigs,
  fetchUpcomingGigs,
  fetchAllGigsForCalendar,
  type GigData,
  type GigFilters,
} from '@/lib/data/gigs';

export interface UseGigsOptions {
  bandId?: string;
  includePotential?: boolean;
  windowDays?: number;
  includeAll?: boolean;
  limit?: number;
  enabled?: boolean; // Allow disabling the hook
}

export interface UseGigsResult {
  gigs: GigData[];
  potentialGigs: GigData[];
  confirmedGigs: GigData[];
  loading: boolean;
  error: any;
  refetch: () => void;
}

/**
 * Main hook for fetching gigs with various filter options
 */
export function useGigs(options: UseGigsOptions = {}): UseGigsResult {
  const {
    bandId,
    includePotential = true,
    windowDays,
    includeAll = false,
    limit,
    enabled = true,
  } = options;

  const [gigs, setGigs] = useState<GigData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  // Use refs to track the current request to avoid race conditions
  const currentBandIdRef = useRef<string | undefined>();
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchGigs = useCallback(async () => {
    if (!bandId || !enabled) {
      setGigs([]);
      setLoading(false);
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    currentBandIdRef.current = bandId;

    setLoading(true);
    setError(null);

    try {
      const filters: GigFilters = {
        bandId,
        includePotential,
        windowDays,
        includeAll,
      };

      const { data, error: fetchError } = await fetchBandGigs(filters);

      // Check if band changed during fetch
      if (currentBandIdRef.current !== bandId) {
        console.warn('[useGigs] Band changed during fetch, discarding results');
        return;
      }

      if (fetchError) {
        setError(fetchError);
        setGigs([]);
      } else {
        let resultData = data || [];

        // Apply limit if specified
        if (limit && limit > 0) {
          resultData = resultData.slice(0, limit);
        }

        setGigs(resultData);
      }
    } catch (err) {
      if (currentBandIdRef.current === bandId) {
        setError(err);
        setGigs([]);
      }
    } finally {
      if (currentBandIdRef.current === bandId) {
        setLoading(false);
      }
    }
  }, [bandId, includePotential, windowDays, includeAll, limit, enabled]);

  // Clear data immediately when bandId changes
  useEffect(() => {
    if (currentBandIdRef.current !== bandId) {
      setGigs([]);
      setError(null);
      setLoading(true);
    }
  }, [bandId]);

  useEffect(() => {
    fetchGigs();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchGigs]);

  // Derive potential and confirmed gigs from the main list
  const potentialGigs = gigs.filter((gig) => gig.is_potential === true);
  const confirmedGigs = gigs.filter((gig) => gig.is_potential === false);

  return {
    gigs,
    potentialGigs,
    confirmedGigs,
    loading,
    error,
    refetch: fetchGigs,
  };
}

/**
 * Hook specifically for Dashboard potential gigs card
 */
export function usePotentialGigs(bandId?: string, enabled = true): UseGigsResult {
  return useGigs({
    bandId,
    includePotential: true,
    windowDays: 120,
    includeAll: false,
    enabled,
  });
}

/**
 * Hook specifically for Dashboard upcoming gigs list
 */
export function useUpcomingGigs(bandId?: string, enabled = true, limit = 5): UseGigsResult {
  return useGigs({
    bandId,
    includePotential: false,
    windowDays: 120,
    includeAll: false,
    limit,
    enabled,
  });
}

/**
 * Hook specifically for Calendar view (all gigs, no date filtering)
 */
export function useCalendarGigs(bandId?: string, enabled = true): UseGigsResult {
  return useGigs({
    bandId,
    includePotential: true,
    includeAll: true,
    enabled,
  });
}

/**
 * Hook that provides both potential and upcoming gigs separately
 * This is perfect for Dashboard that needs both sets
 */
export function useDashboardGigs(bandId?: string, enabled = true) {
  const potentialResult = usePotentialGigs(bandId, enabled);
  const upcomingResult = useUpcomingGigs(bandId, enabled);

  return {
    potential: potentialResult,
    upcoming: upcomingResult,
    loading: potentialResult.loading || upcomingResult.loading,
    error: potentialResult.error || upcomingResult.error,
    refetch: () => {
      potentialResult.refetch();
      upcomingResult.refetch();
    },
  };
}
