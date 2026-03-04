// Omniscreen Player - Service Worker
// Strategy: Cache-First for media assets, Network-First for API calls
const CACHE_NAME = 'omniscreen-media-v1';

// Install: claim clients immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept GET requests for media files (MinIO / static assets)
  // We identify MinIO URLs by checking for common media file extensions
  const isMedia = /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi)(\?.*)?$/i.test(url.pathname);

  if (event.request.method !== 'GET' || !isMedia) {
    // Let non-media requests pass through normally (including API calls)
    return;
  }

  // Cache-First strategy for media
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request.clone());
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (err) {
        // Offline and not cached - return empty response
        return new Response('Offline: media not cached', { status: 503 });
      }
    })
  );
});

// Pre-cache a list of URLs sent from the player page
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PRECACHE_URLS') {
    const urls = event.data.urls;
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of urls) {
        const cached = await cache.match(url);
        if (!cached) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (e) {
            // Ignore individual failures during pre-cache
          }
        }
      }
      // Notify the client that pre-caching is complete
      const clients = await self.clients.matchAll();
      clients.forEach((client) =>
        client.postMessage({ type: 'PRECACHE_DONE', count: urls.length })
      );
    });
  }
});
