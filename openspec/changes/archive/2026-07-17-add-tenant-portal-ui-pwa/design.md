## Context

The tenant backend is implemented and archived: `harden-role-namespace-routing` (namespaces + guard + `getRedirectByRole`), `add-tenant-identity-foundation` (tenant role, `tenant_user_links`, `resolveTenantId`), `add-tenant-core-apis` (`/api/tenant/me|contract|invoices`), and `add-tenant-documents` (storage convention + `/api/tenant/documents` and `/api/tenant/id-images`). The internal shell (`layouts/default.vue`, `AppSidebar`, `AppAiDevChat`) must not appear in the portal. The app is Nuxt 4 compatibility mode; `@vite-pwa/nuxt` is the PWA integration.

The product decision is one installable PWA for the whole app on a single domain (`home.zenocorp.vn`), a single Vercel deployment, no subdomain split, no dual build. Install once, then `getRedirectByRole` routes the user to `/portal` or `/dashboard`. The tenant portal targets everyday renters on their phones, so it must feel like a native mobile app, not a responsive web page. This change is UI + PWA only; it consumes archived APIs and adds no server routes.

## Goals / Non-Goals

**Goals:**
- A native-like mobile app experience under `/portal` (app-shell, safe-area handling, bottom tab bar, sticky header, route transitions, momentum scroll, pull-to-refresh), isolated from internal components.
- A distinct customer-facing visual identity separate from the internal dark operational theme.
- Wire pages to the archived `/api/tenant/**` with skeleton loading, empty, and error states, plus optimistic UI for lightweight mutations.
- Bind document/identity UI to the agreed storage convention (shared `tenant-id-images` slots + `tenant-documents` free-form), consuming existing endpoints only.
- Single-app installable PWA with correct manifest, iOS/Android install handling, and SW update flow.
- Cache policy that never stores authenticated personal-data payloads, plus an offline shell fallback.

**Non-Goals:**
- Any new tenant backend capability, route, bucket, or storage policy (all delivered/archived earlier).
- Push/Zalo notifications (separate post-MVP change).
- Offline write/sync; offline is limited to a non-sensitive shell fallback.
- A new component library. The portal reuses existing `Ui*` primitives + Tailwind + `nuxt-svgo`; it does NOT introduce shadcn-vue.

## Decisions

### D1 — Isolated tenant shell

`app/layouts/tenant.vue` provides a mobile header + bottom navigation using `app/components/portal/**`. The portal never imports internal shell components. The guard already blocks non-tenant roles from `/portal`; the layout enforces visual isolation.

### D2 — Portal pages map to archived APIs

- `/portal` overview → `/api/tenant/me` + `/api/tenant/contract` + latest invoice.
- `/portal/invoices` and `/portal/invoices/[id]` → `/api/tenant/invoices**`.
- `/portal/room` → `/api/tenant/contract`.
- `/portal/requests` → `/api/tenant/requests`.
- `/portal/profile` → `/api/tenant/me`, plus identity images and documents (see D10).

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

Workbox precaches static assets only (`js/css/html/png/svg/ico`). Runtime caching MUST NOT blanket-cache `*.supabase.co` or `/api/tenant/**`; invoice, profile, contract, and document responses (including signed URLs) are never written to the cache. `navigateFallback` is SPA-aware and does not serve authenticated data.

### D5 — Mobile UX contracts

Profile edit uses the whitelist Zod schema from the archived core-apis change (shared client/server). Document upload shows progress, supports retry on flaky networks, and surfaces mime/size errors before upload.

### D6 — Native-like app shell

The portal is built as an app shell, not a scrolling web page:
- **Safe areas**: `viewport-fit=cover` + `env(safe-area-inset-*)` padding so the sticky header and bottom tab bar respect the notch and home indicator. This requires updating the app `viewport` meta (currently `width=device-width, initial-scale=1`).
- **Bottom tab bar**: primary navigation is a fixed bottom tab bar (Trang chủ / Hoá đơn / Phòng / Yêu cầu / Tài khoản) with ≥44px touch targets and an active indicator; no desktop sidebar.
- **Sticky header**: compact top bar with contextual title and a single primary action; back navigation uses an in-app affordance rather than browser chrome (hidden in `standalone`).
- **Scroll**: momentum scrolling per region; header and tab bar stay fixed; content is the only scroll surface.
- **Transitions**: route/page transitions (slide/fade) give a native navigation feel; respect `prefers-reduced-motion`.

### D7 — Touch-first interaction patterns

- Modals are **bottom sheets** on mobile (drag-to-dismiss where practical), not centered desktop dialogs; the portal does not reuse internal desktop modal/drawer patterns.
- Lists use **skeleton loaders** (not spinners) and support **pull-to-refresh** on the primary lists (invoices, requests).
- Lightweight mutations (profile save, request submit) use **optimistic UI** with rollback on error.
- No hover-only affordances; every action is reachable by tap. Interactive targets meet the ≥44px minimum.
- A portal-scoped toast/feedback surface, distinct from the internal `UiToastHost`.

### D8 — Distinct customer-facing visual identity

The internal app is a dense dark operational tool; the tenant portal is a customer-facing product for everyday renters and SHALL have its own friendlier identity (palette, type scale, spacing, radius, imagery) rather than inheriting the internal dark theme. Developed with the `frontend-design` skill during implementation. The portal keeps the existing Tailwind setup, shared `Ui*` primitives where they fit, and `nuxt-svgo` icons; it does NOT introduce a new component library (no shadcn-vue). Portal-specific components live under `app/components/portal/**`.

### D9 — Install and iOS specifics

- **Android/desktop**: capture `beforeinstallprompt` and present a custom, dismissible "Cài đặt ứng dụng" prompt at an appropriate moment (not on first paint).
- **iOS**: Safari does not fire `beforeinstallprompt`; provide an "Add to Home Screen" instruction sheet, and set `apple-touch-icon`, `apple-mobile-web-app-capable`, status-bar style, and a themed splash/background so the installed app looks native.
- **Standalone detection**: hide the install prompt when already running in `display-mode: standalone`.
- **Offline**: a minimal, non-sensitive offline fallback page (branding + retry), never serving authenticated data.

### D10 — Document and identity UI bound to the agreed storage convention

The archived `add-tenant-documents` change established the storage layout; this UI consumes it and never invents paths or buckets:
- **Identity images** (front/back of CCCD) use the shared `tenant-id-images` bucket and the tenant self-scoped endpoints `GET /api/tenant/id-images`, `POST /api/tenant/id-images/[side]`, `DELETE /api/tenant/id-images/[side]` (`side` ∈ `front|back`). The profile page shows the two slots, lets the tenant capture/replace/remove each, and renders only the returned 5-minute signed URLs.
- **Free-form documents** (e.g. PDFs, receipts) use the `tenant-documents` bucket via `GET /api/tenant/documents`, `POST /api/tenant/documents`, `DELETE /api/tenant/documents/[id]`.
- The UI relies on the server for path/bucket selection, mime/size validation, and signed-URL generation. Signed URLs are treated as ephemeral and are never cached by the service worker (see D4).
