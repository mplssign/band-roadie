/* eslint-disable no-console, no-unused-vars, no-undef */

const CACHE_VERSION = 'v1';

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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER cache auth-related routes - always fetch fresh from network
  if (
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/auth/') ||
    url.pathname === '/login' ||
    url.pathname === '/signup' ||
    url.searchParams.has('code') ||
    url.searchParams.has('token_hash')
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
