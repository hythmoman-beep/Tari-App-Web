const CACHE_NAME = 'tari-production-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-155.png',
  // Add other local files if you have them (e.g., icons, css)
];

// 1. INSTALL: Cache the "Shell" (The HTML file)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Caching App Shell...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => Promise.all(
      keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('🧹 Clearing Old Cache:', key);
          return caches.delete(key);
        }
      })
    ))
  );
  return self.clients.claim();
});

// 3. FETCH: The Smart Strategy
self.addEventListener('fetch', (event) => {
  // A. IGNORE API & SUPABASE (Let them go straight to network)
  if (
    event.request.method === 'POST' || 
    event.request.url.includes('supabase') || 
    event.request.url.includes('ipify')
  ) {
    return;
  }

  // B. NAVIGATION REQUESTS (HTML) -> Network First, Fallback to Cache
  // This ensures users get updates, but the app still opens if offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // If offline, return the cached index.html!
          return caches.match('./index.html');
        })
    );
    return;
  }

  // C. ASSETS (Images/JS) -> Stale-While-Revalidate
  // Try cache first (fast), but update it in the background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});
