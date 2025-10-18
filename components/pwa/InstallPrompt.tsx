'use client';

import { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';

const SHOW_DELAY = 3000; // Show banner after 3 seconds
const MIN_INTERACTIONS = 1; // Show after at least 1 interaction

export function InstallPrompt() {
  const {
    isStandalone,
    isIOS,
    canPrompt,
    shouldShowBanner,
    promptInstall,
    dismiss,
  } = usePWAInstall();

  const [isVisible, setIsVisible] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [hasDelayPassed, setHasDelayPassed] = useState(false);

  useEffect(() => {
    // Don't show on desktop (width > 768px)
    if (window.innerWidth > 768) {
      return;
    }

    // Track user interactions
    const trackInteraction = () => {
      setInteractionCount(prev => prev + 1);
    };

    // Listen for any interaction
    window.addEventListener('click', trackInteraction, { once: true });
    window.addEventListener('touchstart', trackInteraction, { once: true });
    window.addEventListener('scroll', trackInteraction, { once: true });

    // Set delay timer
    const timer = setTimeout(() => {
      setHasDelayPassed(true);
    }, SHOW_DELAY);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', trackInteraction);
      window.removeEventListener('touchstart', trackInteraction);
      window.removeEventListener('scroll', trackInteraction);
    };
  }, []);

  useEffect(() => {
    // Show banner when:
    // 1. Should show (not dismissed, not installed, not embedded)
    // 2. Delay has passed
    // 3. User has interacted at least once
    if (shouldShowBanner && hasDelayPassed && interactionCount >= MIN_INTERACTIONS) {
      setIsVisible(true);
    }
  }, [shouldShowBanner, hasDelayPassed, interactionCount]);

  const handleInstall = async () => {
    if (canPrompt) {
      await promptInstall();
    }
    setIsVisible(false);
  };

  const handleDismiss = () => {
    dismiss();
    setIsVisible(false);
  };

  // Don't render if standalone or not visible
  if (isStandalone || !isVisible) {
    return null;
  }

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
    >
      <Card className="mx-4 mb-4 border-rose-600/50 bg-card/95 backdrop-blur-sm shadow-lg">
        <div className="flex items-start gap-3 p-4">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {isIOS ? (
              <Share className="h-5 w-5 text-rose-500" />
            ) : (
              <Download className="h-5 w-5 text-rose-500" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground mb-1">
              Install Band Roadie
            </h3>
            
            {isIOS ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tap <Share className="inline h-3 w-3 mx-0.5" /> then scroll down and select{' '}
                <span className="font-medium text-foreground">Add to Home Screen</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Install for quick access and a better experience
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-3">
              {canPrompt && !isIOS && (
                <Button
                  onClick={handleInstall}
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white h-8 px-3 text-xs"
                >
                  Install
                </Button>
              )}
              
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                Not now
              </Button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 -mt-1 -mr-1 p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </Card>
    </div>
  );
}
