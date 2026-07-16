## 1. Tenant Shell

- [ ] 1.1 Add `app/layouts/tenant.vue` (mobile header + bottom nav) with no internal shell components.
- [ ] 1.2 Add `app/components/portal/**` primitives (nav, header, card, empty/error states).
- [ ] 1.3 Ensure `AppSidebar`/`AppAiDevChat` never render in `/portal`.

## 2. Portal Pages + Composables

- [ ] 2.1 `app/pages/portal/index.vue` overview (me + contract + latest invoice).
- [ ] 2.2 `app/pages/portal/invoices/index.vue` and `[id].vue` from `/api/tenant/invoices**`.
- [ ] 2.3 `app/pages/portal/room.vue` from `/api/tenant/contract`.
- [ ] 2.4 `app/pages/portal/requests.vue` from `/api/tenant/requests`.
- [ ] 2.5 `app/pages/portal/profile.vue` from `/api/tenant/me` (+ documents).
- [ ] 2.6 Add `app/composables/tenant-portal/**` for server state; handle loading/empty/error on each page.

## 3. Profile + Upload UX

- [ ] 3.1 Profile edit form using the shared whitelist Zod schema; inline validation.
- [ ] 3.2 Document upload with progress, retry, and clear type/size errors against `/api/tenant/documents`.

## 4. PWA

- [ ] 4.1 Add `@vite-pwa/nuxt` to `package.json` and register in `nuxt.config.ts`.
- [ ] 4.2 Configure manifest (name, short_name, lang vi, standalone, theme/background, icons 192/512 maskable) and add icons to `public/icons`.
- [ ] 4.3 Set `registerType: 'autoUpdate'`.
- [ ] 4.4 Configure Workbox to precache static assets only.
- [ ] 4.5 Ensure runtime caching EXCLUDES authenticated personal-data responses (no blanket cache of `*.supabase.co` or `/api/tenant/**`).
- [ ] 4.6 Make `navigateFallback` SPA-aware and non-sensitive.

## 5. Tests / Checks

- [ ] 5.1 Portal pages render mobile-first with loading/empty/error states.
- [ ] 5.2 Non-tenant roles cannot reach `/portal`; tenant cannot reach `/dashboard` (guard regression).
- [ ] 5.3 Manifest valid; service worker registers and auto-updates.
- [ ] 5.4 Verify no authenticated personal-data payload is written to the cache.

## 6. Verification

- [ ] 6.1 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [ ] 6.2 Run `openspec validate --specs`.
- [ ] 6.3 Verify single deployment on `home.zenocorp.vn`: install once, role redirect to `/portal` or `/dashboard`.
