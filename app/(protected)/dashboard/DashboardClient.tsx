// app/(protected)/dashboard/DashboardClient.tsx
'use client';
import { useBands } from '@/contexts/BandsContext';
import { User } from '@supabase/supabase-js';
import { Band } from '@/lib/types';
import TopNav from '@/components/navigation/TopNav';
import BottomNav from '@/components/navigation/BottomNav';
import Footer from '@/components/navigation/Footer';
import { useRouter } from 'next/navigation';

interface DashboardClientProps {
  user: User;
  initialBands: Band[];
}

export default function DashboardClient({ user: _user, initialBands: _initialBands }: DashboardClientProps) {
  const { bands, currentBand, setCurrentBand } = useBands();
  const router = useRouter();

  // Limited view for users without bands
  if (bands.length === 0 && _initialBands.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Top Navigation */}
  <TopNav />
        
        {/* Main Content with proper spacing for fixed header */}
        <main className="flex-1 pt-16 bg-background">
          <div className="p-4 space-y-6 max-w-7xl mx-auto">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-6">
              <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to Band Roadie!</h1>
              <p className="text-muted-foreground">Your profile is complete. Create or join a band to get started.</p>
            </div>
          </div>
        </main>
        {/* No Footer or Bottom Nav for limited view */}
      </div>
    );
  }

  // Full dashboard for users with bands
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation */}
  <TopNav />
      
      {/* Main Content with proper spacing for fixed header */}
      <main className="flex-1 pt-16 pb-20 sm:pb-0 bg-background">
        <div className="p-4 space-y-4 max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Welcome back!</h1>
            <p className="text-muted-foreground">Ready to rock? Let&apos;s manage your band.</p>
          </div>

          {/* Current Band Section */}
          <div className="bg-card/90 border border-border/70 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Current Band</h2>
              <button
                className="px-4 py-2 rounded-lg border border-border/60 bg-card text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                onClick={() => router.push('/bands/create')}
              >
                Create New Band
              </button>
            </div>

              <select
              className="w-full rounded-lg border-2 border-primary/40 bg-card px-4 py-3 text-foreground transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
              value={currentBand?.id ?? ''}
              onChange={(e) => {
                const selectedBand = bands.find(b => b.id === e.target.value);
                if (selectedBand) setCurrentBand(selectedBand);
              }}
            >
              {bands.length === 0 ? (
                <option value="">No bands available</option>
              ) : (
                bands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))
              )}
            </select>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <button
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                onClick={() => router.push('/members')}
              >
                <span className="text-2xl">👥</span>
                <span className="text-sm">Members</span>
              </button>
              <button
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                onClick={() => router.push('/setlists')}
              >
                <span className="text-2xl">🎵</span>
                <span className="text-sm">Setlists</span>
              </button>
              <button
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                onClick={() => router.push('/calendar')}
              >
                <span className="text-2xl">📅</span>
                <span className="text-sm">Calendar</span>
              </button>
              <button
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-muted/40 text-muted-foreground rounded-lg hover:bg-muted/40 hover:text-foreground transition-colors"
                onClick={() => router.push('/settings')}
              >
                <span className="text-2xl">⚙️</span>
                <span className="text-sm">Settings</span>
              </button>
            </div>
          </div>

          {/* Quick Add Note */}
          <div className="bg-card/90 border border-border/70 rounded-lg p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Quick Note</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Soundcheck details, load-in, parking, etc."
                className="w-full bg-muted/40 border border-border/60 rounded-lg px-4 py-3 text-foreground placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm">
                Save Note
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card/90 border border-border/70 rounded-lg p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Recent Activity</h3>
            <div className="space-y-3 text-muted-foreground">
              <div className="flex justify-between items-center py-2 border-b border-border/70">
                <span>New setlist created: &ldquo;Summer Tour 2025&rdquo;</span>
                <span className="text-sm">2 hours ago</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/70">
                <span>Member added: John Smith (Bass)</span>
                <span className="text-sm">Yesterday</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span>Gig scheduled: The Venue - March 15th</span>
                <span className="text-sm">2 days ago</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Desktop Footer */}
      <Footer />

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
