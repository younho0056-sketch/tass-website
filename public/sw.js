const CACHE_NAME = 'tass-pwa-v2';

// Install event: immediately activate new Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event: claim client tabs immediately and clear legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Network-First Caching Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only intercept GET requests with http/https schemes
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) return;

  // Skip Next.js hot module reloading & dev server internal routes
  if (request.url.includes('/_next/webpack-hmr') || request.url.includes('hot-reloader')) return;

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // If network response is valid, update cache asynchronously
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If offline or network fails, fallback to cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Default offline fallback response if needed
          return new Response('Network unavailable and resource not cached.', {
            status: 533,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
          });
        });
      })
  );
});
