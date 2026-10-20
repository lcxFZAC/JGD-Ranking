/* Cache only the public page shell and content-hashed images, never live data. */
const CACHE = 'spotlight-shell-__REVISION__';
const ROOT = new URL('./', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.add(new Request(ROOT, {cache:'reload'}));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('spotlight-shell-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url), root = new URL(ROOT);
  if (event.request.method !== 'GET' || url.origin !== root.origin) return;
  const navigation = event.request.mode === 'navigate' &&
    (url.pathname === root.pathname || url.pathname === root.pathname + 'index.html');
  const immutable = url.pathname.startsWith(root.pathname + 'static/');
  if (!navigation && !immutable) return;
  const key = navigation ? ROOT : event.request;
  const cached = caches.open(CACHE).then(cache => cache.match(key));
  // Start refresh in the background, retaining the last good page on failure.
  const refresh = (async () => {
    if (immutable) {
      const hit = await cached;
      if (hit) return hit;
    }
    const response = await fetch(event.request);
    if (response.ok && (immutable || response.headers.get('content-type')?.includes('text/html'))) {
      const cache = await caches.open(CACHE);
      await cache.put(key,response.clone());
    }
    return response;
  })();
  event.waitUntil(refresh.catch(() => {}));
  event.respondWith(cached.then(hit => hit || refresh));
});
