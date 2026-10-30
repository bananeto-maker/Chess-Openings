/* Service Worker: macht die App offline nutzbar. Bei Änderungen VERSION erhöhen. */
const VERSION = 'v1.2.0';
const CACHE = 'eroeffnungstrainer-' + VERSION;
const FILES = [
  './', 'index.html', 'styles.css', 'app.js', 'chess-core.js', 'openings.json',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('eroeffnungstrainer-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Eröffnungsdaten: zuerst Netz (damit Änderungen an openings.json ankommen), sonst Cache
  if (url.origin === location.origin && url.pathname.endsWith('/openings.json')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('openings.json', copy));
        return res;
      }).catch(() => caches.match('openings.json'))
    );
    return;
  }

  // Schriften von Google: nach dem ersten Laden aus dem Cache
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => new Response('', { status: 504 })))
    );
    return;
  }

  // App-Dateien: zuerst Cache, dann Netz
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() => caches.match('index.html')))
    );
  }
});
