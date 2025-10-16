import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Band } from '@/lib/types';
import { create } from 'zustand';

interface BandStore {
  currentBand: Band | null;
  bands: Band[];
  setCurrentBand: (band: Band | null) => void;
  setBands: (bands: Band[]) => void;
}

export const useBandStore = create<BandStore>((set) => ({
  currentBand: null,
  bands: [],
  setCurrentBand: (band) => set({ currentBand: band }),
  setBands: (bands) => set({ bands }),
}));

export function useBands() {
  const [loading, setLoading] = useState(true);
  const { currentBand, bands, setCurrentBand, setBands } = useBandStore();
  const supabase = createClient();
  
  const loadBands = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBands([]);
        setCurrentBand(null);
        setLoading(false);
        return;
      }

      // First get band memberships
      const { data: memberships, error: membershipError } = await supabase
        .from('band_members')
        .select('band_id, role')
        .eq('user_id', user.id);

      if (membershipError) {
        console.error('Error loading band memberships:', membershipError);
        setBands([]);
        setCurrentBand(null);
        setLoading(false);
        return;
      }

      if (!memberships || memberships.length === 0) {
        setBands([]);
        setCurrentBand(null);
        setLoading(false);
        return;
      }

      // Then get the actual band data
      const bandIds = memberships.map(m => m.band_id);
      const { data: bands, error: bandsError } = await supabase
        .from('bands')
        .select('*')
        .in('id', bandIds);

      if (bandsError) {
        console.error('Error loading bands:', bandsError);
        setBands([]);
        setCurrentBand(null);
        setLoading(false);
        return;
      }

      const userBands = bands || [];
      setBands(userBands);
      
      if (userBands.length > 0 && !currentBand) {
        setCurrentBand(userBands[0]);
      } else if (userBands.length === 0) {
        setCurrentBand(null);
      }
    } catch (error) {
      console.error('Error loading bands:', error);
      setBands([]);
      setCurrentBand(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, setBands, setCurrentBand, currentBand]);

  useEffect(() => {
    loadBands();
  }, [loadBands]);

  const switchBand = (band: Band) => {
    setCurrentBand(band);
  };

  const createBand = async (name: string, inviteEmails?: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: band, error } = await supabase
      .from('bands')
      .insert({ name, created_by: user.id })
      .select()
      .single();

    if (error) throw error;

    await supabase.from('band_members').insert({
      band_id: band.id,
      user_id: user.id,
    });

    if (inviteEmails && inviteEmails.length > 0) {
      const invites = inviteEmails.map(email => ({
        band_id: band.id,
        email,
        invited_by: user.id,
      }));
      
      await supabase.from('invites').insert(invites);
    }

    await loadBands();
    return band;
  };

  return {
    currentBand,
    bands,
    loading,
    switchBand,
    createBand,
    reload: loadBands,
  };
}
