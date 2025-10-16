'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { useBands } from '@/contexts/BandsContext';

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const invitationId = params?.invitationId ?? '';
  const { showToast } = useToast();
  const { refreshBands, setCurrentBand } = useBands();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function acceptInvitation() {
      try {
        const response = await fetch(`/api/invitations/${invitationId}/accept`, {
          method: 'POST',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to accept invitation');
        }

        showToast(`Welcome to ${data.band_name || 'the band'}!`, 'success');
        
        // Set the newly joined band as current band
        if (data.band_id) {
          await refreshBands();
          setCurrentBand(data.band_id);
        }
        
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);

      } catch (error: unknown) {
        console.error('Accept invitation error:', error);
        const msg = error instanceof Error ? error.message : 'Failed to accept invitation';
        setError(msg);
        showToast(msg, 'error');
        setIsLoading(false);
      }
    }

    if (invitationId) {
      acceptInvitation();
    }
  }, [invitationId, showToast, refreshBands, setCurrentBand, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Accepting invitation...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="max-w-md text-center rounded-3xl border border-border bg-card/90 p-8 shadow-2xl shadow-primary/20">
          <div className="mb-6 rounded-lg border border-destructive/60 bg-destructive/10 p-6">
            <h1 className="mb-2 text-xl font-bold text-destructive">Error</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow shadow-primary/30 transition-opacity hover:opacity-90"
          >
            Go to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return null;
}
