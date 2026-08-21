const CACHE_NAME = 'gymos-mem-v7';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// App shell (HTML/JS/CSS) uses network-first so code updates reach users immediately;
// static media uses cache-first for speed/offline.
function isShell(url, req) {
  if (req.mode === 'navigate') return true;
  return /\.(jsx|js|css|html)$/.test(url.pathname) || url.pathname === '/member/' || url.pathname === '/member';
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Network-first for API and the app shell.
  if (url.pathname.startsWith('/api/') || isShell(url, e.request)) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, c)).catch(() => {}); }
        return r;
      }).catch(() => caches.match(e.request).then(r => r || (url.pathname.startsWith('/api/')
        ? new Response(JSON.stringify({ success: false, error: 'Offline' }), { headers: { 'Content-Type': 'application/json' } })
        : new Response('Offline', { status: 503 }))))
    );
  } else {
    // Cache-first for images/fonts/etc.
    e.respondWith(
      caches.match(e.request).then(r => {
        if (r) return r;
        return fetch(e.request).then(resp => {
          if (resp.ok) { const c = resp.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, c)).catch(() => {}); }
          return resp;
        }).catch(() => new Response('Offline', { status: 503 }));
      })
    );
  }
});

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'GRAMS GYM';
  const options = {
    body: data.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    vibrate: [180, 80, 180],   // haptic buzz on mobile
    silent: false,             // play the device's notification sound
    tag: data.tag || 'gymos',
    renotify: true,
    lang: 'ar',
    dir: 'rtl',
    data: { url: data.url || '/member/', category: data.category || 'general' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Tapping a notification focuses the open app or opens it.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/member/';
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) { if (c.url.includes('/member') && 'focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
