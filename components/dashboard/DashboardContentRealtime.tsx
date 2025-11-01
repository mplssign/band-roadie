'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation'; 
import { Calendar, Clock, MapPin, Plus, AlertCircle } from 'lucide-react';
import AddEventDrawer from '@/app/(protected)/calendar/AddEventDrawer';
import { useRealtime } from '@/hooks/useRealtime';
import { RealtimeEvent } from '@/lib/types/realtime';
import { LiveUpdateBanner } from '@/components/realtime/LiveUpdateComponents';
import { useBands } from '@/contexts/BandsContext';

interface Band {
  id: string;
  name: string;
  image_url?: string;
  avatar_color?: string;
}

interface Gig {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  setlist?: string;
}

interface DashboardData {
  nextRehearsal: {
    id: string;
    date: string;
    time: string;
    location: string;
  } | null;
  upcomingGigs: Gig[];
  potentialGig: {
    id: string;
    date: string;
    time: string;
    location: string;
    name: string;
    yesCount: number;
    noCount: number;
    noReplyCount: number;
  } | null;
}

interface DashboardContentProps {
  user: User;
  bands: Band[];
  currentBand: Band;
  initialDashboardData: DashboardData;
}

export default function DashboardContentRealtime({
  user: _user,
  bands: _bands,
  currentBand: _currentBand,
  initialDashboardData
}: DashboardContentProps) {
  const router = useRouter();
  const { currentBand } = useBands();
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [addEventType, setAddEventType] = useState<'rehearsal' | 'gig'>('gig');
  
  // Real-time state
  const [dashboardData, setDashboardData] = useState<DashboardData>(initialDashboardData);
  const [liveUpdateEvent, setLiveUpdateEvent] = useState<RealtimeEvent | null>(null);
  const [showLiveUpdate, setShowLiveUpdate] = useState(false);
  const [pendingRefresh, setPendingRefresh] = useState(false);

  // Handle real-time events
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    let shouldRefresh = false;
    
    switch (event.type) {
      case 'gig:created':
      case 'gig:updated':
      case 'gig:deleted':
        shouldRefresh = true;
        break;
      case 'gig:response':
        // Update potential gig counts immediately if possible
        if (dashboardData.potentialGig && event.data.gigId === dashboardData.potentialGig.id) {
          shouldRefresh = true;
        }
        break;
      case 'rehearsal:created':
      case 'rehearsal:updated':
      case 'rehearsal:deleted':
        shouldRefresh = true;
        break;
      case 'member:joined':
      case 'member:left':
        // This might affect gig response counts
        shouldRefresh = true;
        break;
    }

    if (shouldRefresh) {
      setLiveUpdateEvent(event);
      setShowLiveUpdate(true);
      setPendingRefresh(true);
    }
  }, [dashboardData.potentialGig]);

  // Set up real-time connection
  const realtime = useRealtime({
    eventTypes: [
      'gig:created',
      'gig:updated', 
      'gig:deleted',
      'gig:response',
      'rehearsal:created',
      'rehearsal:updated',
      'rehearsal:deleted',
      'member:joined',
      'member:left'
    ],
    onEvent: handleRealtimeEvent,
    debug: process.env.NODE_ENV === 'development',
  });

  // Refresh dashboard data
  const refreshDashboardData = useCallback(async () => {
    if (!currentBand?.id) return;
    
    try {
      const response = await fetch(`/api/dashboard?bandId=${currentBand.id}`, {
        cache: 'no-store'
      });
      
      if (response.ok) {
        const newData = await response.json();
        setDashboardData(newData);
        setPendingRefresh(false);
      }
    } catch (error) {
      console.error('Failed to refresh dashboard data:', error);
    }
  }, [currentBand?.id]);

  // Handle live update actions
  const handleAcceptUpdate = useCallback(() => {
    setShowLiveUpdate(false);
    refreshDashboardData();
  }, [refreshDashboardData]);

  const handleDismissUpdate = useCallback(() => {
    setShowLiveUpdate(false);
    setLiveUpdateEvent(null);
  }, []);

  const openAddEventDrawer = (type: 'rehearsal' | 'gig') => {
    setAddEventType(type);
    setIsAddEventOpen(true);
  };

  const handleEventUpdated = useCallback(() => {
    setIsAddEventOpen(false);
    refreshDashboardData();
  }, [refreshDashboardData]);

  // Auto-refresh when band changes
  useEffect(() => {
    refreshDashboardData();
  }, [currentBand?.id, refreshDashboardData]);

  return (
    <>
      {/* Live Update Banner */}
      <LiveUpdateBanner
        isVisible={showLiveUpdate}
        event={liveUpdateEvent}
        onAccept={handleAcceptUpdate}
        onDismiss={handleDismissUpdate}
      />

      <main className="min-h-screen bg-black text-white pb-28">
        <div className="px-4 pt-4 space-y-6">
          {/* Connection Status (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-500 mb-2">
              Real-time: {realtime.connected ? '🟢 Connected' : '🔴 Disconnected'}
              {pendingRefresh && ' • Updates pending'}
            </div>
          )}

          {/* Potential Gig Card */}
          {dashboardData.potentialGig && (
            <button
              onClick={() => dashboardData.potentialGig && router.push(`/gigs/${dashboardData.potentialGig.id}/edit`)}
              className="w-full rounded-2xl p-6 shadow-xl text-left bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400 hover:opacity-90 transition-opacity"
            >
              {/* Header Row */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-white" />
                  <span className="text-base font-medium text-white">Potential Gig</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-white" />
                  <span className="text-base font-medium text-white whitespace-nowrap">
                    {dashboardData.potentialGig.date}
                  </span>
                </div>
              </div>

              {/* Venue Name */}
              <h2 className="text-4xl font-bold mb-2 leading-tight text-white">
                {dashboardData.potentialGig.name}
              </h2>

              {/* Location */}
              <p className="text-2xl mb-6 text-white/95">{dashboardData.potentialGig.location}</p>

              {/* Time and Response Buttons Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-6 h-6 text-white" />
                  <span className="text-xl font-normal text-white">{dashboardData.potentialGig.time}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`
                    px-6 py-2 rounded-full border-2 border-white/80 bg-transparent
                    ${pendingRefresh ? 'animate-pulse' : ''}
                  `}>
                    <span className="text-lg font-medium text-white">
                      Yes ({dashboardData.potentialGig.yesCount})
                    </span>
                  </div>
                  <div className={`
                    px-6 py-2 rounded-full border-2 border-white/80 bg-transparent
                    ${pendingRefresh ? 'animate-pulse' : ''}
                  `}>
                    <span className="text-lg font-medium text-white">
                      No ({dashboardData.potentialGig.noCount})
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* Next Rehearsal Card */}
          {dashboardData.nextRehearsal && (
            <button
              onClick={() => {/* Navigation to rehearsal edit */ }}
              className="w-full rounded-2xl p-4 shadow-xl text-left bg-zinc-900/60 border border-zinc-800 hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 px-3 py-1 border border-blue-300 rounded-full">
                  <Calendar className="w-4 h-4 text-blue-200" />
                  <span className="text-sm font-medium text-blue-200">Rehearsal</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <span className="text-lg font-semibold">{dashboardData.nextRehearsal.date}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5" />
                  <span className="text-base text-gray-200">{dashboardData.nextRehearsal.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-lg font-semibold">{dashboardData.nextRehearsal.time}</span>
                </div>
              </div>
            </button>
          )}

          {/* Quick Actions */}
          <section>
            <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
              <button
                onClick={() => router.push('/setlists/new')}
                className="flex-shrink-0 rounded-xl p-4 hover:opacity-80 transition-opacity snap-start bg-zinc-900 border border-zinc-800"
              >
                <div className="flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" />
                  <span className="text-base font-semibold">Create Setlist</span>
                </div>
              </button>

              <button
                onClick={() => openAddEventDrawer('gig')}
                className="flex-shrink-0 rounded-xl p-4 hover:opacity-80 transition-opacity snap-start bg-zinc-900 border border-zinc-800"
              >
                <div className="flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" />
                  <span className="text-base font-semibold">Create Gig</span>
                </div>
              </button>

              <button
                onClick={() => router.push('/calendar/block-dates')}
                className="flex-shrink-0 rounded-xl p-4 hover:opacity-80 transition-opacity snap-start bg-zinc-900 border border-zinc-800"
              >
                <div className="flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" />
                  <span className="text-base font-semibold whitespace-nowrap">Add Block Out Dates</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      </main>

      <AddEventDrawer
        isOpen={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
        defaultEventType={addEventType}
        onEventUpdated={handleEventUpdated}
      />
    </>
  );
}