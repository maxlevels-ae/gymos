const CACHE_NAME = 'gymos-emp-v3';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, c)).catch(() => {}); }
        return r;
      }).catch(() => caches.match(e.request).then(r => r || new Response(JSON.stringify({ success: false, error: 'Offline' }), { headers: { 'Content-Type': 'application/json' } })))
    );
  } else {
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
  const data = e.data ? e.data.json() : { title: 'GymOS', body: 'Notification' };
  e.waitUntil(self.registration.showNotification(data.title || 'GymOS Employee', { body: data.body, icon: 'icons/icon-192.png' }));
});
