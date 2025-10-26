/* eslint-disable no-console, no-unused-vars, no-undef */

const CACHE_VERSION = 'v2';

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(
    Promise.all([
      // Clear old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_VERSION) {
              console.log('Clearing old cache:', cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      }),
      // Take control of all pages immediately
      clients.claim(),
    ]),
  );
});

// Handle magic link clicks to open in existing PWA window
self.addEventListener('message', (event) => {
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
            client.navigate(url);
            return;
          }
        }
        // Otherwise open new window
        clients.openWindow(url);
      }),
    );
  }
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
  const url = new URL(event.request.url);

  // NEVER cache auth-related routes, invite routes, or API calls - always fetch fresh
  if (
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/auth/') ||
    url.pathname.startsWith('/api/invites/') ||
    url.pathname === '/login' ||
    url.pathname === '/signup' ||
    url.pathname === '/invite' ||
    url.searchParams.has('code') ||
    url.searchParams.has('token') ||
    url.searchParams.has('token_hash') ||
    url.searchParams.has('inviteToken')
  ) {
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

  // For all other requests, network-first strategy
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Offline - Please check your connection', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      });
    }),
  );
});
