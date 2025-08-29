// Minimal service worker for PWA installability & basic offline shell.
// You can extend this later with smarter caching strategies.
const CACHE_NAME = 'untis-pro-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== CACHE_NAME)
                        .map((k) => caches.delete(k))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    // Only handle GET requests
    if (request.method !== 'GET') return;
    // Network first for API, cache first for same-origin navigation & static assets
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(request).catch(() => caches.match(request)));
        return;
    }
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    // Optionally update shell cache with latest index.html
                    const copy = res.clone();
                    caches
                        .open(CACHE_NAME)
                        .then((c) => c.put('/index.html', copy));
                    return res;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }
    event.respondWith(
        caches.match(request).then(
            (cached) =>
                cached ||
                fetch(request)
                    .then((res) => {
                        // Optionally cache static assets (same-origin, basic request)
                        if (
                            url.origin === location.origin &&
                            res.status === 200
                        ) {
                            const clone = res.clone();
                            caches
                                .open(CACHE_NAME)
                                .then((c) => c.put(request, clone));
                        }
                        return res;
                    })
                    .catch(() => cached)
        )
    );
});
