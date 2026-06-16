const CACHE_NAME = 'tarifapp-v1';
const CORE_ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE_ASSETS)));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

/* Red primero (siempre trae la versión más nueva); si no hay internet, usa la copia guardada */
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.origin !== location.origin) return; // deja pasar Google Maps/BCV tal cual
    e.respondWith(
        fetch(e.request)
            .then(resp => {
                const copy = resp.clone();
                caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
                return resp;
            })
            .catch(() => caches.match(e.request))
    );
});
