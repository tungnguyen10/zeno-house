## Context

`harden-role-namespace-routing` created the `/portal` namespace and guard; `add-tenant-identity-foundation`, `add-tenant-core-apis`, `add-tenant-documents`, and `add-tenant-support-requests` provide the tenant role and `/api/tenant/**` surface. The internal shell (`layouts/default.vue`, `AppSidebar`, `AppAiDevChat`) must not appear in the portal. The app is Nuxt 4 compatibility mode; `@vite-pwa/nuxt` is the PWA integration (the incoming spec's "Nuxt 3" wording does not match this repo).

The product decision is one installable PWA for the whole app on a single domain (`home.zenocorp.vn`), a single Vercel deployment, no subdomain split, no dual build. Install once, then `getRedirectByRole` routes the user to `/portal` or `/dashboard`.

## Goals / Non-Goals

**Goals:**
- Mobile-first tenant shell and pages under `/portal`, isolated from internal components.
- Wire pages to `/api/tenant/**` with proper loading/empty/error states.
- Single-app installable PWA with correct manifest and SW update flow.
- Cache policy that never stores authenticated personal-data payloads.
- Profile edit (whitelist) and mobile upload UX.

**Non-Goals:**
- Any new tenant backend capability (delivered by earlier changes).
- Push/Zalo notifications (separate post-MVP change).
- Offline write/sync; offline is limited to a non-sensitive shell fallback.

## Decisions

### D1 — Isolated tenant shell

`app/layouts/tenant.vue` provides a mobile header + bottom navigation using `app/components/portal/**`. The portal never imports internal shell components. The guard already blocks non-tenant roles from `/portal`; the layout enforces visual isolation.

### D2 — Portal pages map to APIs

- `/portal` overview → summary from `/api/tenant/me` + `/api/tenant/contract` + latest invoice.
- `/portal/invoices` and `/portal/invoices/[id]` → `/api/tenant/invoices**`.
- `/portal/room` → `/api/tenant/contract`.
- `/portal/requests` → `/api/tenant/requests`.
- `/portal/profile` → `/api/tenant/me` (+ documents).

Composables in `app/composables/tenant-portal/**` own server state (SSR read via `useFetch`, mutations via the shared `apiFetch` wrapper).

### D3 — Single-app PWA via @vite-pwa/nuxt

```ts
pwa: {
  registerType: 'autoUpdate',
  manifest: {
    name: 'Zeno House', short_name: 'Zeno', lang: 'vi',
    display: 'standalone', theme_color: '#...', background_color: '#...',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: { /* see D4 */ },
}
```

Install is offered app-wide; role redirect decides the landing surface.

### D4 — Cache policy excludes authenticated personal data

Workbox precaches static assets only (`js/css/html/png/svg/ico`). Runtime caching MUST NOT blanket-cache `*.supabase.co` or `/api/tenant/**`; invoice, profile, contract, and document responses are never written to the cache. This resolves the conflict in the incoming spec (its example `NetworkFirst` on all supabase URLs would cache personal data). `navigateFallback` is SPA-aware and does not serve authenticated data.

### D5 — Mobile UX contracts

Profile edit uses the whitelist Zod schema from the core-apis change (shared client/server). Document upload shows progress, supports retry on flaky networks, and surfaces mime/size errors before upload, against `/api/tenant/documents`.
