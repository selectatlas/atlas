// Retirement worker for the pre-launch Atlas PWA implementation.
// Keep this file for one release so browsers with the old worker installed can
// activate it, clear the page cache, and unregister. There is deliberately no
// fetch handler: every request falls through to the network.

const RETIRED_CACHE_NAME = 'atlas-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.delete(RETIRED_CACHE_NAME),
      self.registration.unregister(),
    ])
  )
})
