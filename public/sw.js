const CACHE_NAME = 'guardhq-v2';
const RUNTIME_CACHE = 'guardhq-runtime-v2';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/icon.png',
  '/manifest.json',
];

// Install event - cache core assets
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching core assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first for API, cache first for assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    // Network first for Supabase API calls
    if (url.hostname.includes('supabase.co')) {
      event.respondWith(
        fetch(request)
          .catch(() => new Response('Offline - API unavailable', { status: 503 }))
      );
      return;
    }
    return;
  }

  // Network first for HTML pages (ensures fresh content)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cached => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // Cache first for static assets (CSS, JS, images)
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) {
          // Return cached version and update in background
          fetch(request).then(response => {
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, response);
            });
          }).catch(() => {});
          return cached;
        }

        return fetch(request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseClone);
          });

          return response;
        });
      })
  );
});
