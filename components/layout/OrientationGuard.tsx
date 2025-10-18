'use client';

import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';

// Type for Screen Orientation API (not fully typed in TypeScript lib)
interface ScreenOrientationWithLock extends ScreenOrientation {
  lock?: (orientation: 'portrait' | 'portrait-primary' | 'portrait-secondary' | 'landscape' | 'landscape-primary' | 'landscape-secondary') => Promise<void>;
}

/**
 * OrientationGuard component enforces portrait mode for Band Roadie PWA
 * 
 * Features:
 * 1. Programmatically locks screen to portrait when installed as PWA
 * 2. Shows overlay prompt on mobile when device is in landscape
 * 3. Respects manifest.json orientation: portrait setting
 */
export function OrientationGuard() {
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect if device is mobile (width <= 768px)
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Check orientation
    const checkOrientation = () => {
      const isLandscapeMode = window.innerWidth > window.innerHeight;
      setIsLandscape(isLandscapeMode && isMobile);
    };

    // Initial checks
    checkMobile();
    checkOrientation();

    // Try to lock orientation for installed PWAs
    const lockOrientation = async () => {
      // Only attempt lock if:
      // 1. Running as standalone PWA (display-mode: standalone)
      // 2. Screen Orientation API is available
      const orientation = screen.orientation as ScreenOrientationWithLock;
      
      if (
        window.matchMedia('(display-mode: standalone)').matches &&
        orientation &&
        typeof orientation.lock === 'function'
      ) {
        try {
          await orientation.lock('portrait-primary');
        } catch (error) {
          // Lock may fail if not in fullscreen or not supported
          // Silently ignore - overlay will handle UX
        }
      }
    };

    lockOrientation();

    // Listen for orientation changes
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [isMobile]);

  // Only show overlay on mobile devices in landscape mode
  if (!isLandscape || !isMobile) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
      <div className="flex flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="relative">
          <div className="animate-bounce">
            <RotateCw className="h-24 w-24 text-rose-500" />
          </div>
          <div className="absolute inset-0 animate-ping">
            <RotateCw className="h-24 w-24 text-rose-500/50" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">
            Please Rotate Your Device
          </h2>
          <p className="text-gray-400 max-w-xs">
            Band Roadie works best in portrait mode
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="h-12 w-8 border-2 border-gray-500 rounded-sm" />
          <span>Portrait mode</span>
        </div>
      </div>
    </div>
  );
}
