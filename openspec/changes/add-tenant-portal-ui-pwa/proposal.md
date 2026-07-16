## Why

The tenant backend (identity, core APIs, documents, support requests) needs a mobile-first UI, and the product decision is to ship the whole app as one installable PWA on a single domain. This change delivers the tenant portal UI shell and pages under `/portal`, wires them to the tenant APIs, and adds single-app PWA installability with a cache policy that never stores authenticated personal data.

## What Changes

- Add a tenant-only mobile layout (`app/layouts/tenant.vue`) and portal components with no internal shell leakage (no `AppSidebar`, no internal AI dev chat).
- Add `/portal` pages: overview, invoices list, invoice detail, room/contract, requests, profile — consuming `/api/tenant/**`.
- Add tenant composables under `app/composables/tenant-portal/**` for server state.
- Enable a single-app PWA via `@vite-pwa/nuxt` (works with Nuxt 4 compatibility mode): manifest, icons, `registerType: autoUpdate`, service worker.
- Configure Workbox to precache static assets only and to EXCLUDE authenticated personal-data API responses from runtime caching (no blanket `NetworkFirst` on `*.supabase.co` or `/api/tenant/**`).
- Implement profile edit (strict whitelist) and mobile document upload UX (progress/retry/errors) against the existing tenant APIs.

## Capabilities

### New Capabilities
- `tenant-portal-ui`: Defines the tenant mobile shell, portal page set, navigation isolation, and mobile UX expectations (loading/empty/error, touch targets, profile edit whitelist, upload flow).
- `pwa-installability`: Defines single-app PWA installability, manifest requirements, service-worker update behavior, and the cache-exclusion rule for authenticated personal-data payloads.

## Impact

- `app/layouts/tenant.vue`, `app/pages/portal/**`, `app/components/portal/**`, `app/composables/tenant-portal/**` — new tenant UI.
- `nuxt.config.ts` — add `@vite-pwa/nuxt` module + manifest + workbox config.
- `package.json` — add `@vite-pwa/nuxt` dev dependency.
- `public/icons/**` — PWA icons (192, 512 maskable).
- Tests/checks for responsive behavior, redirect isolation, manifest validity, SW registration/update, and no caching of authenticated personal data.
