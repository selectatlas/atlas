// Atlas — PWA Service Worker (MVP)
// Caches the app shell for offline support.

const CACHE_NAME = 'atlas-v1'
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/login',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Skip Supabase API and auth requests — always network-first
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone)
          })
        }
        return response
      })
      return cached || fetched
    })
  )
})
