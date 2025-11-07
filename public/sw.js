/* eslint-disable no-console, no-unused-vars, no-undef */

const RUNTIME_HTML = 'br-runtime-html';
const NEXT_STATIC  = 'br-next-static';
const RUNTIME_DATA = 'br-runtime-data';

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Handle magic link clicks to open in existing PWA window
  if (event.data && event.data.type === 'NAVIGATE_URL') {
    const url = event.data.url;
    console.log('[SW] Navigate request:', url);

    // Find existing client or open new one
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // Focus existing window if available
        for (const client of windowClients) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              client.navigate(url);
            } else {
              // Fallback for clients that don't support navigate
              client.postMessage({ type: 'NAVIGATE_TO', url: url });
            }
            return;
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          clients.openWindow(url);
        }
      }),
    );
  }
  
  // Handle PWA ready notification
  if (event.data && event.data.type === 'PWA_READY') {
    console.log('[SW] PWA ready signal received');
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => ![RUNTIME_HTML, NEXT_STATIC, RUNTIME_DATA].includes(k))
      .map(k => caches.delete(k)));
  })());
});

// Handle notification clicks for magic links
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no matching window, open new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never intercept non-GET
  if (req.method !== 'GET') return;

  // NEVER cache auth-related routes, invite routes - always fetch fresh
  // This includes all magic link flows and PKCE authentication
  if (
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/auth/') ||
    url.pathname.startsWith('/api/invites/') ||
    url.pathname === '/login' ||
    url.pathname === '/signup' ||
    url.pathname === '/invite' ||
    url.searchParams.has('code') ||
    url.searchParams.has('state') || // PKCE state parameter
    url.searchParams.has('token') ||
    url.searchParams.has('token_hash') ||
    url.searchParams.has('inviteToken')
  ) {
    // Bypass service worker entirely for auth flows
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        credentials: 'same-origin',
      }).catch(() => {
        return new Response('Authentication requires an internet connection', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      }),
    );
    return;
  }

  // HTML navigations → Network-First
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, RUNTIME_HTML));
    return;
  }

  // Next.js hashed assets → Cache-First
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(cacheFirst(req, NEXT_STATIC, 30 * 24 * 60 * 60));
    return;
  }

  // API/JSON → Stale-While-Revalidate
  if (url.pathname.startsWith('/api') || url.pathname.endsWith('.json')) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_DATA));
    return;
  }
});

// Helpers
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = (async () => {
    try {
      const fresh = await fetch(request, { cache: 'no-store' });
      cache.put(request, fresh.clone());
    } catch {}
  })();
  return cached || networkPromise.then(async () => (await cache.match(request)) || fetch(request));
}
