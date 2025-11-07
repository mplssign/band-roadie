'use client';

import { useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Search, ClipboardList } from 'lucide-react';
import { AppleMusicIcon, SpotifyIcon, AmazonMusicIcon } from '@/components/icons/ProviderIcons';

interface SetlistImportRowProps {
  onSongLookup: () => void;
  onBulkPaste: () => void;
  onSpotify: () => void;
  onAppleMusic: () => void;
  onAmazonMusic: () => void;
}

export function SetlistImportRow({
  onSongLookup,
  onBulkPaste,
  onSpotify,
  onAppleMusic,
  onAmazonMusic,
}: SetlistImportRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const scrollAmount = 120;
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      
      containerRef.current.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-x-auto scrollbar-none snap-x snap-mandatory flex gap-3 px-6"
      role="group"
      aria-label="Import sources"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <Button
        onClick={onSongLookup}
        variant="outline"
        size="lg"
        className="gap-2 border-rose-600 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 shrink-0 snap-start min-w-fit"
        aria-label="Search and add songs to setlist"
      >
        <Search className="h-4 w-4" />
        Song Lookup
      </Button>
      
      <Button
        onClick={onBulkPaste}
        variant="outline"
        size="lg"
        className="gap-2 border-rose-600 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 shrink-0 snap-start min-w-fit"
        aria-label="Bulk paste songs from spreadsheet"
      >
        <ClipboardList className="h-4 w-4" />
        Bulk Paste
      </Button>
      
      <Button
        onClick={onSpotify}
        variant="outline"
        size="lg"
        className="gap-2 border-rose-600 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 shrink-0 snap-start min-w-fit"
        aria-label="Import from Spotify"
      >
        <SpotifyIcon className="h-5 w-5" />
        <span className="font-medium">Spotify</span>
      </Button>
      
      <Button
        onClick={onAppleMusic}
        variant="outline"
        size="lg"
        className="gap-2 border-rose-600 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 shrink-0 snap-start min-w-fit"
        aria-label="Import from Apple Music"
      >
        <AppleMusicIcon className="h-5 w-5" />
        <span className="font-medium">Apple Music</span>
      </Button>
      
      <Button
        onClick={onAmazonMusic}
        variant="outline"
        size="lg"
        className="gap-2 border-rose-600 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 shrink-0 snap-start min-w-fit"
        aria-label="Import from Amazon Music"
      >
        <AmazonMusicIcon className="h-5 w-5" />
        <span className="font-medium">Amazon</span>
      </Button>
    </div>
  );
}