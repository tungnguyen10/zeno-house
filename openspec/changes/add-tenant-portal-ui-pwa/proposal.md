## Why

The tenant backend (identity, core APIs, documents, support requests) is implemented and archived. It now needs a mobile UI that feels like a native app, shipped as one installable PWA on a single domain. This change delivers the tenant portal app shell and pages under `/portal`, gives the portal its own customer-facing visual identity, wires it to the archived tenant APIs, and adds single-app PWA installability with a cache policy that never stores authenticated personal data.

## What Changes

- Add a tenant-only, native-like mobile app shell (`app/layouts/tenant.vue`) with safe-area handling (`viewport-fit=cover` + `env(safe-area-inset-*)`), a fixed bottom tab bar, a compact sticky header, and route transitions — no internal shell leakage (no `AppSidebar`, no internal AI dev chat).
- Give the portal a distinct customer-facing visual identity (not the internal dark operational theme), developed with the `frontend-design` skill, while reusing existing Tailwind + `Ui*` primitives + `nuxt-svgo` (no shadcn-vue).
- Add `/portal` pages: overview, invoices list, invoice detail, room/contract, requests, profile — consuming the archived `/api/tenant/**` surface.
- Wire document UI to the already-agreed storage convention from the archived `add-tenant-documents` change: identity front/back slots go to the shared `tenant-id-images` bucket via `/api/tenant/id-images` (GET, POST `[side]`, DELETE `[side]`); free-form uploads go to `tenant-documents` via `/api/tenant/documents` (GET, POST, DELETE `[id]`). The UI never invents paths or buckets; it consumes these endpoints and renders the returned short-lived signed URLs.
- Add touch-first patterns: skeleton loaders, pull-to-refresh on primary lists, bottom-sheet modals, optimistic UI for light mutations, ≥44px touch targets, portal-scoped toast.
- Add tenant composables under `app/composables/tenant-portal/**` for server state.
- Enable a single-app PWA via `@vite-pwa/nuxt` (Nuxt 4 compatibility mode): manifest, maskable icons, `apple-touch-icon`, iOS add-to-home-screen guidance, custom `beforeinstallprompt` handling, `registerType: autoUpdate`, service worker, and an offline shell fallback.
- Configure Workbox to precache static assets only and to EXCLUDE authenticated personal-data API responses from runtime caching (no blanket `NetworkFirst` on `*.supabase.co` or `/api/tenant/**`).
- Implement profile edit (strict whitelist), identity front/back image capture/replace, and free-form document upload UX (progress/retry/errors) against the archived tenant APIs.
- Update the app `viewport` meta to support safe-area insets for portal routes.

## Capabilities

### New Capabilities
- `tenant-portal-ui`: Defines the native-like tenant app shell (safe areas, bottom tab bar, sticky header, transitions), the portal page set, navigation/visual isolation from the internal app, the distinct customer-facing identity, the document/identity upload UX bound to the agreed storage convention, and mobile UX expectations (skeletons, empty/error, pull-to-refresh, bottom sheets, optimistic UI, ≥44px targets, profile whitelist).
- `pwa-installability`: Defines single-app PWA installability, manifest and iOS requirements, install-prompt UX, service-worker update behavior, offline fallback, and the cache-exclusion rule for authenticated personal-data payloads.

## Impact

- `app/layouts/tenant.vue`, `app/pages/portal/**`, `app/components/portal/**`, `app/composables/tenant-portal/**` — new tenant UI.
- Consumes archived endpoints only: `/api/tenant/me`, `/api/tenant/contract`, `/api/tenant/invoices**`, `/api/tenant/requests`, `/api/tenant/id-images**`, `/api/tenant/documents**`. No new server routes.
- `nuxt.config.ts` — add `@vite-pwa/nuxt` module + manifest + workbox config; update `viewport` meta for `viewport-fit=cover`.
- `package.json` — add `@vite-pwa/nuxt` dev dependency.
- `public/icons/**` — PWA icons (192, 512 maskable) + `apple-touch-icon`.
- `app/assets/scss/**` — portal identity tokens / safe-area utilities if needed.
- Tests/checks for native-shell behavior (safe areas, tab bar, transitions), touch behavior, redirect isolation, identity/document upload against the agreed buckets, manifest validity, SW registration/update, install-prompt/iOS handling, and no caching of authenticated personal data.
