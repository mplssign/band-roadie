'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export interface Band {
  id: string;
  name: string;
  image_url?: string | null;
  avatar_color?: string | null;
}

// Custom event for band changes
const BAND_CHANGE_EVENT = 'band-changed';

interface BandsContextType {
  bands: Band[];
  currentBand: Band | null;
  loading: boolean;
  setCurrentBandId: (id: string) => void;
  setCurrentBand: (bandOrId: Band | string | null) => void;
  refreshBands: () => Promise<void>;
  clearBandState: () => void;
}

const BandsContext = createContext<BandsContextType | undefined>(undefined);

const CURRENT_BAND_KEY = 'br_current_band_id';
const CURRENT_BAND_COOKIE = 'br_current_band_id';

/**
 * Set a cookie (client-side)
 */
function setCookie(name: string, value: string, days: number = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Delete a cookie (client-side)
 */
function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
}

export function BandsProvider({ children }: { children: React.ReactNode }) {
  const [bands, setBands] = useState<Band[]>([]);
  const [currentBand, setCurrentBandState] = useState<Band | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);
  const previousBandIdRef = useRef<string | null>(null);

  /**
   * Clear all band-specific state when switching bands
   * This triggers a custom event that components can listen to
   */
  const clearBandState = useCallback(() => {
    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent(BAND_CHANGE_EVENT));
  }, []);

  const setCurrentBandId = useCallback((id: string) => {
    setCurrentBandState(prev => {
      const match = (prev && prev.id === id) ? prev : (bands.find(b => b.id === id) || null);

      // If band is actually changing, trigger state clear
      if (match && prev?.id !== match.id) {
        previousBandIdRef.current = prev?.id || null;
        clearBandState();
      }

      try {
        if (match) {
          localStorage.setItem(CURRENT_BAND_KEY, match.id);
          setCookie(CURRENT_BAND_COOKIE, match.id);
        } else {
          localStorage.removeItem(CURRENT_BAND_KEY);
          deleteCookie(CURRENT_BAND_COOKIE);
        }
      } catch {
        // localStorage might be unavailable (SSR/private mode); ignore
        void 0;
      }
      return match;
    });
  }, [bands, clearBandState]);

  const setCurrentBand = useCallback((bandOrId: Band | string | null) => {
    let band: Band | null = null;
    if (typeof bandOrId === 'string') {
      band = bands.find(b => b.id === bandOrId) || null;
    } else {
      band = bandOrId;
    }

    // If band is actually changing, trigger state clear
    if (band && currentBand?.id !== band.id) {
      previousBandIdRef.current = currentBand?.id || null;
      clearBandState();
    }

    setCurrentBandState(band);
    try {
      if (band) {
        localStorage.setItem(CURRENT_BAND_KEY, band.id);
        setCookie(CURRENT_BAND_COOKIE, band.id);
      } else {
        localStorage.removeItem(CURRENT_BAND_KEY);
        deleteCookie(CURRENT_BAND_COOKIE);
      }
    } catch {
      // ignore persistence failures
      void 0;
    }
  }, [bands, currentBand, clearBandState]);

  const fetchBands = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    if (loadingRef.current && retryCount === 0) return;
    loadingRef.current = true;
    setLoading(true);

    console.log('[BandsContext] Fetching bands...', retryCount > 0 ? `(retry ${retryCount})` : '');

    try {
      // Get user's bands from API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/bands', {
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('[BandsContext] Response status:', response.status, response.statusText);

      if (!response.ok) {
        // If unauthorized and we have retries left, wait and retry
        if (response.status === 401 && retryCount < maxRetries) {
          console.log('[BandsContext] Got 401, retrying in 1 second...');
          loadingRef.current = false; // Allow retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchBands(retryCount + 1);
        }
        
        console.log('[BandsContext] Response not OK, clearing bands');
        setBands([]);
        setCurrentBandState(null);
        return;
      }

      const { bands: bandList } = await response.json();
      console.log('[BandsContext] Received bands:', bandList?.length || 0, 'items');

      const list: Band[] = (bandList || []).map((row: { 
        id: string; 
        name: string; 
        image_url?: string | null; 
        avatar_color?: string | null; 
      }) => ({
        id: row.id,
        name: row.name,
        image_url: row.image_url ?? null,
        avatar_color: row.avatar_color ?? null,
      }));

      if (list.length === 0) {
        setBands([]);
        setCurrentBandState(null);
        return;
      }

      setBands(list);

      // restore selection
      let restored: Band | null = null;
      try {
        const saved = localStorage.getItem(CURRENT_BAND_KEY);
        console.log('[BandsContext] Saved band ID from localStorage:', saved);
        if (saved) restored = list.find(b => b.id === saved) || null;
        console.log('[BandsContext] Restored band:', restored);
        // Band restored or default selected
      } catch {
        // localStorage read failed; ignore
        void 0;
      }
      const resolvedBand = restored ?? list[0] ?? null;
      console.log('[BandsContext] Final resolved band:', resolvedBand);
      setCurrentBandState(resolvedBand);

      try {
        if (resolvedBand) {
          localStorage.setItem(CURRENT_BAND_KEY, resolvedBand.id);
          setCookie(CURRENT_BAND_COOKIE, resolvedBand.id);
        } else {
          localStorage.removeItem(CURRENT_BAND_KEY);
          deleteCookie(CURRENT_BAND_COOKIE);
        }
      } catch {
        // Persistence helpers may fail in private mode; ignore
        void 0;
      }
      // Bands fetch completed successfully
    } catch (error) {
      setBands([]);
      setCurrentBandState(null);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  const refreshBands = useCallback(async () => {
    await fetchBands();
  }, [fetchBands]);

  useEffect(() => {
    fetchBands().catch(() => {
      // Error handling done in fetchBands
      setLoading(false);
      loadingRef.current = false;
    });
  }, [fetchBands]);

  const value: BandsContextType = {
    bands,
    currentBand,
    loading,
    setCurrentBandId,
    setCurrentBand,
    refreshBands,
    clearBandState,
  };

  return (
    <BandsContext.Provider value={value}>
      {children}
    </BandsContext.Provider>
  );
}

export function useBands(): BandsContextType {
  const context = useContext(BandsContext);
  if (context === undefined) {
    throw new Error('useBands must be used within a BandsProvider');
  }
  return context;
}