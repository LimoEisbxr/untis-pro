// Enhanced service worker for PWA with notification support
const CACHE_NAME = 'periodix-shell-v2';
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

// Handle push notifications
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);

    let notificationData = {
        title: 'Periodix',
        body: 'You have a new notification',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'periodix-notification',
        requireInteraction: false,
    };

    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                ...notificationData,
                ...data,
            };
        } catch (e) {
            console.error('Failed to parse push notification data:', e);
        }
    }

    event.waitUntil(
        (async () => {
            try {
                const tag = notificationData.data?.notificationId
                    ? `periodix-${notificationData.data.notificationId}`
                    : notificationData.tag;
                if (tag && self.registration.getNotifications) {
                    const existing = await self.registration.getNotifications({
                        tag,
                        includeTriggered: true,
                    });
                    existing.forEach((n) => n.close());
                }
            } catch (e) {
                // ignore errors closing existing notifications
            }

            // Show user-visible notification
            await self.registration.showNotification(notificationData.title, {
                body: notificationData.body,
                icon: notificationData.icon,
                badge: notificationData.badge,
                tag: notificationData.data?.notificationId
                    ? `periodix-${notificationData.data.notificationId}`
                    : notificationData.tag,
                requireInteraction: notificationData.requireInteraction,
                data: notificationData.data,
                actions: [
                    {
                        action: 'view',
                        title: 'View',
                        icon: '/icon-192.png',
                    },
                    {
                        action: 'dismiss',
                        title: 'Dismiss',
                    },
                ],
            });

            // Broadcast a lightweight message to all controlled clients so in-page state can refresh immediately
            try {
                const clientList = await clients.matchAll({
                    type: 'window',
                    includeUncontrolled: true,
                });
                clientList.forEach((client) => {
                    // Only signal if page is same origin
                    try {
                        client.postMessage({
                            type: 'periodix:new-notification',
                            notificationId:
                                notificationData.data?.notificationId || null,
                            nType: notificationData.data?.type || null,
                        });
                    } catch (e) {
                        // ignore individual postMessage errors
                    }
                });
            } catch (e) {
                // ignore broadcast errors
            }
        })()
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    // Open or focus the app when notification is clicked
    event.waitUntil(
        clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Try to focus existing tab
                for (const client of clientList) {
                    if (
                        client.url.includes(self.location.origin) &&
                        'focus' in client
                    ) {
                        return client.focus();
                    }
                }

                // Open new tab if no existing tab found
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('Notification closed:', event);
    // Could send analytics or cleanup here
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
