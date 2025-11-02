'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useBands } from '@/hooks/useBands';

// Location options for the dropdown
const LOCATION_OPTIONS = [
  { value: '', label: 'Select where this happened (optional)' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'setlists', label: 'Setlists' },
  { value: 'setlist-details', label: 'Setlist Details' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'add-event', label: 'Add Event (bottom drawer)' },
  { value: 'edit-event', label: 'Edit Event (bottom drawer)' },
  { value: 'members', label: 'Members' },
  { value: 'profile', label: 'My Profile' },
  { value: 'band-settings', label: 'Band Settings' },
  { value: 'auth-login', label: 'Auth / Login' },
  { value: 'magic-link', label: 'Magic Link / Email' },
  { value: 'potential-gigs', label: 'Potential Gigs' },
  { value: 'song-details', label: 'Song Details' },
  { value: 'other', label: 'Other (I&apos;m not sure)' },
];

const MIN_DESCRIPTION_LENGTH = 15;

export default function ReportBugPage() {
  const router = useRouter();
  const { currentBand } = useBands();
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate description
    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      return;
    }

    setIsSubmitting(true);
    setSubmitState('idle');
    setErrorMessage('');

    try {
      // Collect device and browser information
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenResolution: `${screen.width}x${screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cookiesEnabled: navigator.cookieEnabled,
        onlineStatus: navigator.onLine,
      };

      const response = await fetch('/api/bug-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: location || 'Unspecified',
          description: description.trim(),
          currentRoute: window.location.pathname,
          currentBandId: currentBand?.id || null,
          currentBandName: currentBand?.name || null,
          deviceInfo,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit bug report');
      }

      setSubmitState('success');
    } catch (error) {
      console.error('Error submitting bug report:', error);
      setSubmitState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setSubmitState('idle');
    setErrorMessage('');
  };

  const isDescriptionValid = description.trim().length >= MIN_DESCRIPTION_LENGTH;
  const showDescriptionHint = description.length > 0 && !isDescriptionValid;

  // Success state
  if (submitState === 'success') {
    return (
      <main className="bg-background text-foreground min-h-screen pb-32">
        <div className="px-4 pt-4">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="gap-2 -ml-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          {/* Success Message */}
          <div className="max-w-md mx-auto text-center py-12">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-4">Thanks! We&apos;ll take a look.</h1>
            <p className="text-muted-foreground mb-8">
              Your bug report has been sent. We appreciate you helping us improve the app.
            </p>
            <Button onClick={() => router.back()} className="w-full">
              Back
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background text-foreground min-h-screen pb-32">
      <div className="px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2 -ml-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Content */}
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold mb-4">Report a bug</h1>
          <p className="text-muted-foreground mb-8">
            Tell us what broke or looked off. The more detail, the faster we can fix it.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Location Dropdown */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium mb-2">
                Where did this happen?
              </label>
              <select
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {LOCATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description Textarea */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Describe the issue <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? What were you trying to do? Any steps to reproduce?"
                rows={6}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                aria-describedby={showDescriptionHint ? "description-hint" : undefined}
              />
              {showDescriptionHint && (
                <p id="description-hint" className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  Please provide a bit more detail (at least {MIN_DESCRIPTION_LENGTH} characters)
                </p>
              )}
            </div>

            {/* Error State */}
            {submitState === 'error' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                      {errorMessage}
                    </p>
                    <Button
                      type="button"
                      onClick={handleRetry}
                      variant="outline"
                      size="sm"
                      className="border-red-200 dark:border-red-700 text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/40"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!isDescriptionValid || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner />
                  Sending...
                </>
              ) : (
                'Send'
              )}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}