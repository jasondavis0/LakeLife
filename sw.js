// Lake Life offline helper (a "service worker").
// The first time you open the game with internet, this saves a copy on the device.
// With internet, the game always loads the NEWEST version; with no Wi-Fi it opens the saved copy.
const CACHE = 'lake-life-v34'; // change this number whenever the icon or files change, so devices grab fresh copies
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  // {cache:'reload'} skips the browser's own cache, so we never save an old copy
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, {cache: 'reload'})))).then(() => self.skipWaiting()));
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

  // The game itself (the page): get the newest version from the internet first (wait up to 5 seconds),
  // and only use the saved copy when there's no internet
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isPage) {
    e.respondWith(caches.open(CACHE).then(async c => {
      try {
        const r = await Promise.race([fetch(req, {cache: 'no-store'}), new Promise((_, rej) => setTimeout(() => rej('slow'), 5000))]);
        if (r && r.ok) { c.put('./index.html', r.clone()); return r; }
      } catch (err) {}
      return (await c.match(req, {ignoreSearch: true})) || (await c.match('./index.html')) || Response.error();
    }));
    return;
  }

  // Icons and other small files: saved copy right away, and grab a newer one for next time
  e.respondWith(caches.open(CACHE).then(async c => {
    const saved = await c.match(req, {ignoreSearch: true});
    const fresh = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return saved || (await fresh) || Response.error();
  }));
});
