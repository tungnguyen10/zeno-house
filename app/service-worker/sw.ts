// Custom PWA service worker (injectManifest). The app is server-rendered and
// pages may contain authenticated personal data, so navigations use NetworkOnly
// and are NEVER cached. Only the injected static build assets + the non-sensitive
// offline shell are precached. When a navigation fails (offline), we serve the
// precached offline shell instead of any authenticated content.
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

interface PrecacheEntry {
  url: string
  revision: string | null
}

interface ExtendableEventLike {
  waitUntil: (promise: Promise<unknown>) => void
}

interface ServiceWorkerScope {
  // workbox-build injects the precache manifest at the literal `self.__WB_MANIFEST`.
  __WB_MANIFEST: PrecacheEntry[]
  skipWaiting: () => void
  clients: { claim: () => Promise<void> }
  addEventListener: (type: 'activate', listener: (event: ExtendableEventLike) => void) => void
}

// Module-scoped ambient declaration shadows the DOM `self` with the SW surface
// we use, without pulling in the webworker lib globally. Keeps the literal
// `self.__WB_MANIFEST` that workbox-build searches for when injecting the manifest.
declare const self: ServiceWorkerScope

const OFFLINE_URL = '/offline.html'

self.skipWaiting()
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Navigations always hit the network; fall back to the offline shell when down.
const networkOnly = new NetworkOnly()
registerRoute(
  new NavigationRoute(
    async (options) => {
      try {
        return await networkOnly.handle(options)
      }
      catch {
        const cached = await matchPrecache(OFFLINE_URL)
        return cached ?? Response.error()
      }
    },
    { denylist: [/^\/api\//, /^\/auth\//] },
  ),
)
