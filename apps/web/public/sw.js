// Offline app shell. Reads come from IndexedDB (see lib/db/repo.ts), so the only
// thing the network owes us is the shell itself — cache it and the app opens on
// a plane.
//
// ponytail: one cache, refreshed on activate, no build-manifest precaching. Swap
// in Serwist when hashed chunk names need precise invalidation.

const CACHE = "tarhino-shell-v1"
const SHELL = ["/", "/today", "/week", "/settings", "/login", "/register"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  // API calls must never be served stale; sync owns their failure handling.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api"))
    return

  // Navigations: network first so a fresh deploy lands, cache as the fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() =>
          caches.match(request).then((hit) => hit ?? caches.match("/today"))
        )
    )
    return
  }

  // Static assets: cache first, they are content-hashed.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(request, copy))
          return response
        })
    )
  )
})
