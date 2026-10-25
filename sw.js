// Lake Life offline helper (a "service worker").
// The first time you open the game with internet, this saves a copy on the device.
// After that the game opens even with no Wi-Fi. When there IS internet, it quietly
// downloads any newer version so the next launch is up to date.
const CACHE = 'lake-life-v21'; // change this number whenever the icon or files change, so devices grab fresh copies
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts from other websites: use the internet if we can, otherwise the saved copy
  if (url.origin !== location.origin) {
    e.respondWith(caches.open(CACHE).then(async c => {
      try {
        const r = await fetch(req);
        if (r.ok || r.type === 'opaque') c.put(req, r.clone());
        return r;
      } catch (err) {
        return (await c.match(req)) || Response.error();
      }
    }));
    return;
  }

  // The game's own files: open the saved copy right away, and grab a newer one for next time
  e.respondWith(caches.open(CACHE).then(async c => {
    const saved = await c.match(req, {ignoreSearch: true});
    const fresh = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return saved || (await fresh) || (await c.match('./index.html')) || Response.error();
  }));
});
