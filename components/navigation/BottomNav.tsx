'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Music, Calendar, Users } from 'lucide-react';
import { useBands } from '@/hooks/useBands';
import { useEffect, useRef, useState } from 'react';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentBand, loading } = useBands();
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const navRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const navItems = [
    { name: 'Dashboard', icon: Home, path: '/dashboard' },
    { name: 'Setlists', icon: Music, path: '/setlists' },
    { name: 'Calendar', icon: Calendar, path: '/calendar' },
    { name: 'Members', icon: Users, path: '/members' },
  ];

  const activeIndex = navItems.findIndex(
    (item) => pathname === item.path || pathname?.startsWith(item.path + '/')
  );

  useEffect(() => {
    if (activeIndex >= 0 && buttonRefs.current[activeIndex] && navRef.current) {
      const button = buttonRefs.current[activeIndex];
      const nav = navRef.current;
      const buttonRect = button.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();

      setIndicatorStyle({
        left: buttonRect.left - navRect.left,
        width: buttonRect.width,
      });
    }
  }, [activeIndex, pathname]);

  // Don't render the bottom nav if user is not in a band
  if (loading || !currentBand) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div ref={navRef} className="relative flex h-20 items-center justify-around px-2">
        {/* Animated background indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[calc(100%-16px)] bg-primary rounded-xl shadow-lg shadow-primary/30 transition-all duration-300 ease-out"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />

        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');

          return (
            <button
              key={item.path}
              ref={(el) => { buttonRefs.current[index] = el; }}
              onClick={() => router.push(item.path)}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-2 transition-colors ${isActive
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
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
