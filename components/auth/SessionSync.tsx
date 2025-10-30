'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { syncSessionToCookies } from '@/lib/auth/session';

const EVENTS_TO_SYNC = new Set(['SIGNED_IN', 'TOKEN_REFRESHED']);

export function SessionSync() {
    useEffect(() => {
        let mounted = true;
        const supabase = createClient();

        const syncOnce = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                if (!mounted) return;
                if (session) {
                    await syncSessionToCookies(session);
                }
            } catch (error) {
                // Suppress errors; the bridge route will handle hard failures.
            }
        };

        syncOnce();

        const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            if (event === 'SIGNED_OUT') {
                return;
            }

            if (EVENTS_TO_SYNC.has(event)) {
                try {
                    await syncSessionToCookies(session);
                } catch (error) {
                    // Ignore; middleware will route back to verifier if cookies expire.
                }
            }
        });

        return () => {
            mounted = false;
            subscription.subscription.unsubscribe();
        };
    }, []);

    return null;
}
