'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Music, Calendar, Users } from 'lucide-react';
import { useBands } from '@/hooks/useBands';

export default function BottomNav() {
  const pathname = usePathname();
  const { currentBand, loading } = useBands();
  
  const isActive = (path: string) => pathname === path;

  // Don't render the bottom nav if user is not in a band
  if (loading || !currentBand) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 pb-safe z-[5]">
      <div className="flex justify-around items-center h-20 px-2">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/dashboard')
              ? 'text-blue-500'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Home className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Dashboard</span>
        </Link>

        <Link
          href="/setlists"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/setlists')
              ? 'text-blue-500'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Music className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Setlists</span>
        </Link>

        <Link
          href="/calendar"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/calendar')
              ? 'text-blue-500'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Calendar className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Calendar</span>
        </Link>

        <Link
          href="/members"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/members')
              ? 'text-blue-500'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Members</span>
        </Link>
      </div>
    </nav>
  );
}
