/* eslint-disable no-console, no-unused-vars, no-undef */
self.addEventListener('install', (_event) => {
  console.log('Service Worker installed');
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Offline - Please check your connection', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    })
  );
});
