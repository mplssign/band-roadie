import { useEffect, useState } from 'react';
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

  useEffect(() => {
    loadBands();
  }, []);

  const loadBands = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from('band_members')
        .select('*, band:bands(*)')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (memberships) {
        const userBands = memberships.map(m => m.band).filter(Boolean) as Band[];
        setBands(userBands);
        
        if (userBands.length > 0 && !currentBand) {
          setCurrentBand(userBands[0]);
        }
      }
    } catch (error) {
      console.error('Error loading bands:', error);
    } finally {
      setLoading(false);
    }
  };

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
