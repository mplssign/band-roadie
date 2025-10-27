'use client';

import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, Plus, AlertCircle } from 'lucide-react';
// import { useState } from 'react'; // Temporarily disabled
// import EditRehearsalDrawer from './EditRehearsalDrawer'; // Temporarily disabled

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
  dashboardData: DashboardData;
}

export default function DashboardContent({ 
  user: _user, 
  bands: _bands, 
  currentBand: _currentBand, 
  dashboardData 
}: DashboardContentProps) {
  const router = useRouter();
  // const [isRehearsalDrawerOpen, setIsRehearsalDrawerOpen] = useState(false); // Temporarily disabled

  return (
    <>
      <main className="min-h-screen bg-black text-white pb-28">
        <div className="px-4 pt-4 space-y-6">
          
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
                  <div className="px-6 py-2 rounded-full border-2 border-white/80 bg-transparent">
                    <span className="text-lg font-medium text-white">Yes ({dashboardData.potentialGig.yesCount})</span>
                  </div>
                  <div className="px-6 py-2 rounded-full border-2 border-white/80 bg-transparent">
                    <span className="text-lg font-medium text-white">No ({dashboardData.potentialGig.noCount})</span>
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* Next Rehearsal Card */}
          {dashboardData.nextRehearsal && (
            <button
              onClick={() => {/* setIsRehearsalDrawerOpen(true) - temporarily disabled */}}
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
                onClick={() => router.push('/setlists/create')}
                className="flex-shrink-0 rounded-xl p-4 hover:opacity-80 transition-opacity snap-start bg-zinc-900 border border-zinc-800"
              >
                <div className="flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" />
                  <span className="text-base font-semibold">Create Setlist</span>
                </div>
              </button>

              <button
                onClick={() => router.push('/gigs/create')}
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

      {/* <EditRehearsalDrawer
        isOpen={isRehearsalDrawerOpen}
        onClose={() => setIsRehearsalDrawerOpen(false)}
        rehearsal={dashboardData.nextRehearsal ? {
          date: dashboardData.nextRehearsal.date,
          time: dashboardData.nextRehearsal.time,
          location: dashboardData.nextRehearsal.location
        } : null}
      /> */}
    </>
  );
}