/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, LogOut, User as UserIcon, Zap } from 'lucide-react';
import { useBands } from '@/contexts/BandsContext';
import { createClient } from '@/lib/supabase/client';
import { AnimatePresence, motion } from 'framer-motion';
import { Wordmark } from '@/components/branding/Wordmark';

// Map Tailwind classes to hex colors
const colorMap: Record<string, string> = {
  'bg-red-600': '#dc2626',
  'bg-orange-600': '#ea580c',
  'bg-amber-600': '#d97706',
  'bg-yellow-600': '#ca8a04',
  'bg-lime-600': '#65a30d',
  'bg-green-600': '#16a34a',
  'bg-emerald-600': '#059669',
  'bg-teal-600': '#0d9488',
  'bg-cyan-600': '#0891b2',
  'bg-sky-600': '#0284c7',
  'bg-blue-600': '#2563eb',
  'bg-indigo-600': '#4f46e5',
  'bg-violet-600': '#7c3aed',
  'bg-purple-600': '#9333ea',
  'bg-fuchsia-600': '#c026d3',
  'bg-pink-600': '#db2777',
  'bg-rose-600': '#e11d48',
};

interface UserProfile { first_name?: string; last_name?: string; email?: string; }

export default function TopNav() {
  const router = useRouter();
const rawPathname = usePathname();
const pathname = rawPathname ?? "";
  const supabase = createClient();
  const { currentBand, bands, setCurrentBand, refreshBands } = useBands();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBandSwitcherOpen, setIsBandSwitcherOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Track when we return from edit page
  useEffect(() => {
    const handleRouteChange = () => {
      // If we're coming back to a main page (not an edit page), refresh bands
      // But only if we're not stuck in a loading loop on dashboard
      if (!pathname.includes('/edit') && !pathname.includes('/create')) {
        // Don't constantly refresh if we're on dashboard and have no bands
        if (pathname === '/dashboard' && bands.length === 0) {
          return;
        }
        refreshBands();
      }
    };

    handleRouteChange(); // Check current route
  }, [pathname, refreshBands, bands.length]);

  // Also refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      // Don't constantly refresh if we're on dashboard with no bands
      if (pathname === '/dashboard' && bands.length === 0) {
        return;
      }
      refreshBands();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshBands, pathname, bands.length]);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', user.id)
          .single();

        setProfile(((data) ?? null) as UserProfile | null);
      }
    };
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleBandSelect = (bandId: string) => {
    setCurrentBand(bandId);
    setIsBandSwitcherOpen(false);
  };

  const getUserName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return profile?.email?.split('@')[0] || 'User';
  };

  const getBandInitials = (bandName?: string) => {
    if (!bandName) return 'B';
    return bandName
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3); // Limit to 3 characters max
  };

  const getBandColor = (avatarColor?: string | null) => {
    if (!avatarColor) return '#3b82f6'; // Default blue
    return colorMap[avatarColor] || avatarColor || '#3b82f6';
  };



  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-16 items-center justify-between px-4">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="text-foreground transition-colors hover:text-primary"
          >
            <Menu className="w-6 h-6" />
          </button>

          <Wordmark className="text-foreground" />

          <button
            onClick={() => setIsBandSwitcherOpen(true)}
            className="flex-shrink-0"
          >
            {currentBand ? (
              <div
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white/60 text-sm font-bold text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: getBandColor(currentBand.avatar_color) }}
              >
                {currentBand.image_url ? (
                  <img
                    src={currentBand.image_url}
                    alt={currentBand.name}
                    className="w-full h-full rounded-full object-cover"
                    onError={(e) => {
                      // eslint-disable-next-line no-console
                      console.log('TopNav: Image failed to load, showing initials');
                      // If image fails to load, hide it and show initials
                      e.currentTarget.style.display = 'none';
                    }}
                    onLoad={() => {
                      // eslint-disable-next-line no-console
                      console.log('TopNav: Image loaded successfully');
                    }}
                  />
                ) : (
                  <span>{getBandInitials(currentBand.name)}</span>
                )}
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/60 bg-red-600 text-white transition-opacity hover:opacity-80">
                <Zap className="w-5 h-5" />
              </div>
            )}
          </button>
        </div>
      </nav>

      {/* Sidebar Menu (LEFT) */}
      <AnimatePresence initial={false}>
        {isMenuOpen && (
          <>
            <motion.div
              key="menu-overlay"
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
              onClick={() => setIsMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            />
            <motion.div
              key="menu-panel"
              className="fixed inset-y-0 left-0 z-50 w-80 border-r border-border/50 bg-card shadow-2xl shadow-primary/20"
              role="dialog"
              aria-modal="true"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'tween', duration: 0.22 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
                <h2 className="text-xl font-bold text-foreground">Menu</h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* User Info Section */}
              {profile && (
                <div className="border-b border-border/60 px-4 py-6">
                  <p className="text-lg font-semibold text-foreground">{getUserName()}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>
                </div>
              )}

              <div className="p-4 space-y-2">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    router.push('/settings/profile');
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                >
                  <UserIcon className="w-5 h-5" />
                  <span>My Profile</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-rose-500 transition-colors hover:bg-accent/40 hover:text-rose-600"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Band Switcher Drawer (RIGHT) */}
      <AnimatePresence initial={false}>
        {isBandSwitcherOpen && (
          <>
            <motion.div
              key="switcher-overlay"
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
              onClick={() => setIsBandSwitcherOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            />
            <motion.div
              key="switcher-panel"
              className="fixed inset-y-0 right-0 z-50 w-80 border-l border-border/50 bg-card shadow-2xl shadow-primary/20"
              role="dialog"
              aria-modal="true"
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'tween', duration: 0.22 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
                <h2 className="text-xl font-bold text-foreground">Switch Band</h2>
                <button
                  onClick={() => setIsBandSwitcherOpen(false)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-2 p-4">
                {bands.length > 0 ? (
                  <>
                    {bands.map((band) => (
                      <button
                        key={band.id}
                        onClick={() => handleBandSelect(band.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                          currentBand?.id === band.id
                            ? 'bg-black border border-border/60 text-white'
                            : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                        }`}
                      >
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: getBandColor(band.avatar_color) }}
                        >
                          {band.image_url ? (
                            <img
                              src={band.image_url}
                              alt={band.name}
                              className="w-full h-full rounded-full object-cover"
                              onError={(e) => {
                                // If image fails to load, hide it and show initials
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span>{getBandInitials(band.name)}</span>
                          )}
                        </div>
                        <span className="font-medium">{band.name}</span>
                      </button>
                    ))}

                    <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
                      {/* Edit Band - only show if there's a current band */}
                      {currentBand && (
                        <button
                          onClick={() => {
                            setIsBandSwitcherOpen(false);
                            router.push(`/bands/${currentBand.id}/edit`);
                          }}
                          className="w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          Edit Band
                        </button>
                      )}

                      {/* Create New Band */}
                      <button
                        onClick={() => {
                          setIsBandSwitcherOpen(false);
                          router.push('/bands/create');
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-primary transition-colors hover:text-foreground"
                      >
                        <span className="text-2xl">+</span>
                        <span className="font-medium">Create New Band</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-2">No bands yet</p>
                      <p className="text-sm text-muted-foreground">Create your first band to get started</p>
                    </div>
                    
                    {/* Create New Band - only button when no bands */}
                    <button
                      onClick={() => {
                        setIsBandSwitcherOpen(false);
                        router.push('/bands/create');
                      }}
                      className="w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span className="text-xl">+</span>
                        <span>Create New Band</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
