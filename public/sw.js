const CACHE_NAME = 'sim-c-simulator-v1';
const CORE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './questions.json',
    './manifest.json',
    './icon.svg'
];

// Install Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Pre-caching core app shell...');
                return cache.addAll(CORE_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Service Worker & Clean Old Caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Requests
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    
    // Cache-first strategy for images, network-falling-back-to-cache for other requests
    if (requestUrl.pathname.includes('/images/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(response => {
                    if (response) {
                        return response; // Return cached image
                    }
                    // Fetch from network, cache it, then return
                    return fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    }).catch(() => {
                        // Image fetch failed (offline)
                        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                    });
                });
            })
        );
    } else {
        // Network-first with cache fallback for HTML, CSS, JS, JSON to ensure updates are fetched first
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // Update cache for core files
                    if (networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Offline fallback
                    return caches.match(event.request);
                })
        );
    }
});
