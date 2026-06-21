// Self-destruct service worker.
// The previous cache-first worker was serving stale bundles and causing
// old↔new flicker. This version takes over, clears every cache, unregisters
// itself, and reloads any controlled tabs so they load fresh from the network.
// No fetch handler is registered, so all requests go straight to the network.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    } catch (e) {
      // ignore
    }
  })());
});
