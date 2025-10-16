'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Music, Calendar, Users } from 'lucide-react';
import { useBands } from '@/hooks/useBands';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentBand, loading } = useBands();

  // Don't render the bottom nav if user is not in a band
  if (loading || !currentBand) {
    return null;
  }

  const navItems = [
    { name: 'Dashboard', icon: Home, path: '/dashboard' },
    { name: 'Setlists', icon: Music, path: '/setlists' },
    { name: 'Calendar', icon: Calendar, path: '/calendar' },
    { name: 'Members', icon: Users, path: '/members' },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-20 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
          
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-2 transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{item.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
