const CACHE_NAME = 'tarifapp-v1';
const CORE_ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE_ASSETS)));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.origin !== location.origin) return; // deja pasar Google Maps/BCV tal cual
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
