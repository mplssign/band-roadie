'use client';

import { useEffect, useState } from 'react';
import { useBands } from '@/contexts/BandsContext';
import { createClient } from '@/lib/supabase/client';

interface Gig {
  id: string;
  name: string;
  date: string;
  location: string;
  band_id: string;
  is_potential?: boolean;
  created_at: string;
}

export default function DebugGigsPage() {
  const { currentBand, bands } = useBands();
  const [allGigs, setAllGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAllGigs = async () => {
    if (!currentBand?.id) return;
    
    setLoading(true);
    const supabase = createClient();
    
    try {
      // Get ALL gigs for this band (no date filter)
      const { data: gigs, error } = await supabase
        .from('gigs')
        .select('*')
        .eq('band_id', currentBand.id)
        .order('date', { ascending: false }); // Latest first

      if (error) {
        console.error('Error fetching gigs:', error);
      } else {
        setAllGigs(gigs || []);
        console.log(`Found ${gigs?.length || 0} total gigs for ${currentBand.name}`);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentBand?.id) {
      loadAllGigs();
    }
  }, [currentBand?.id]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-4">🔍 Debug Gigs</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Current Band:</h2>
        {currentBand ? (
          <p className="text-green-400">{currentBand.name} (ID: {currentBand.id})</p>
        ) : (
          <p className="text-red-400">No band selected</p>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">All Bands:</h2>
        {bands.map(band => (
          <p key={band.id} className={band.id === currentBand?.id ? 'text-green-400' : 'text-gray-400'}>
            {band.name} (ID: {band.id})
          </p>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">
          All Gigs for {currentBand?.name || 'Current Band'}
          {loading && <span className="ml-2 text-yellow-400">(Loading...)</span>}
        </h2>
        
        {allGigs.length === 0 && !loading ? (
          <p className="text-red-400">❌ No gigs found for this band</p>
        ) : (
          <div className="space-y-4">
            {allGigs.map(gig => {
              const isPast = gig.date < today;
              return (
                <div key={gig.id} className={`p-4 rounded border ${isPast ? 'border-gray-600 bg-gray-900' : 'border-blue-600 bg-blue-900/20'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{gig.name}</h3>
                    <span className={`text-sm px-2 py-1 rounded ${isPast ? 'bg-gray-700 text-gray-300' : 'bg-blue-700 text-blue-300'}`}>
                      {isPast ? 'PAST' : 'FUTURE'}
                    </span>
                  </div>
                  <p className="text-gray-300">📅 Date: {gig.date}</p>
                  <p className="text-gray-300">📍 Location: {gig.location || 'TBD'}</p>
                  <p className="text-gray-300">🎸 Band ID: {gig.band_id}</p>
                  <p className="text-gray-300">⚡ Potential: {gig.is_potential ? 'Yes' : 'No'}</p>
                  <p className="text-gray-300 text-sm">🕐 Created: {new Date(gig.created_at).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8">
        <button 
          onClick={loadAllGigs}
          disabled={loading || !currentBand}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded"
        >
          🔄 Refresh Gigs
        </button>
      </div>
    </div>
  );
}