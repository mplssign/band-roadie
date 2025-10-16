'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Band {
  id: string;
  name: string;
  image_url?: string | null;
  avatar_color?: string | null;
}

interface BandsContextType {
  bands: Band[];
  currentBand: Band | null;
  loading: boolean;
  setCurrentBandId: (id: string) => void;
  setCurrentBand: (bandOrId: Band | string | null) => void;
  refreshBands: () => Promise<void>;
}

const BandsContext = createContext<BandsContextType | undefined>(undefined);

const CURRENT_BAND_KEY = 'br_current_band_id';

export function BandsProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [bands, setBands] = useState<Band[]>([]);
  const [currentBand, setCurrentBandState] = useState<Band | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const setCurrentBandId = useCallback((id: string) => {
    setCurrentBandState(prev => {
      const match = (prev && prev.id === id) ? prev : (bands.find(b => b.id === id) || null);
      try {
        if (match) localStorage.setItem(CURRENT_BAND_KEY, match.id);
        else localStorage.removeItem(CURRENT_BAND_KEY);
      } catch {
        // localStorage might be unavailable (SSR/private mode); ignore
        void 0;
      }
      return match;
    });
  }, [bands]);

  const setCurrentBand = useCallback((bandOrId: Band | string | null) => {
    let band: Band | null = null;
    if (typeof bandOrId === 'string') {
      band = bands.find(b => b.id === bandOrId) || null;
    } else {
      band = bandOrId;
    }
    setCurrentBandState(band);
    try {
      if (band) localStorage.setItem(CURRENT_BAND_KEY, band.id);
      else localStorage.removeItem(CURRENT_BAND_KEY);
    } catch {
      // ignore persistence failures
      void 0;
    }
  }, [bands]);

  const fetchBands = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBands([]);
        setCurrentBandState(null);
        return;
      }

      const { data: memberships, error: memErr } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', user.id);
      if (memErr) {
        console.error('BandsContext: band_members error:', memErr);
        setBands([]);
        setCurrentBandState(null);
        return;
      }

      const bandIds = (memberships ?? [])
        .map(m => (m as { band_id: string | null })?.band_id)
        .filter((id): id is string => !!id);

      if (bandIds.length === 0) {

        setBands([]);
        setCurrentBandState(null);
        return;
      }

      const { data: bandRows, error: bandErr } = await supabase
        .from('bands')
        .select('id, name, image_url, avatar_color')
        .in('id', bandIds);
      if (bandErr) throw bandErr;

      const list: Band[] = (bandRows ?? []).map(row => ({
        id: row.id as string,
        name: row.name as string,
        image_url: (row as { image_url?: string | null }).image_url ?? null,
        avatar_color: (row as { avatar_color?: string | null }).avatar_color ?? null,
      }));

      setBands(list);

      // restore selection
      let restored: Band | null = null;
      try {
        const saved = localStorage.getItem(CURRENT_BAND_KEY);
        if (saved) restored = list.find(b => b.id === saved) || null;
      } catch {
        // localStorage read failed; ignore
        void 0;
      }
      setCurrentBandState(restored ?? list[0] ?? null);
    } catch (error) {
      console.error('BandsProvider: Error in fetchBands:', error);
      throw error;
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [supabase]);

  const refreshBands = useCallback(async () => {
    await fetchBands();
  }, [fetchBands]);

  useEffect(() => {
    fetchBands();
  }, [fetchBands]);

  const value: BandsContextType = {
    bands,
    currentBand,
    loading,
    setCurrentBandId,
    setCurrentBand,
    refreshBands,
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