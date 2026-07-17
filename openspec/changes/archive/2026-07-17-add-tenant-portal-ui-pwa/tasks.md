## 1. Tenant Shell

- [x] 1.1 Add `app/layouts/tenant.vue` (sticky header + fixed bottom tab bar) with no internal shell components.
- [x] 1.2 Add `app/components/portal/**` primitives (tab bar, header, card, skeleton, empty/error, bottom sheet, toast).
- [x] 1.3 Ensure `AppSidebar`/`AppAiDevChat` never render in `/portal`.

## 2. Native App Shell

- [x] 2.1 Update the app `viewport` meta in `nuxt.config.ts` to include `viewport-fit=cover`.
- [x] 2.2 Apply `env(safe-area-inset-*)` padding to header and bottom tab bar (notch + home indicator).
- [x] 2.3 Bottom tab bar: 5 tabs (Trang chủ / Hoá đơn / Phòng / Yêu cầu / Tài khoản), ≥44px targets, active indicator.
- [x] 2.4 Sticky header with contextual title + single primary action + in-app back affordance.
- [x] 2.5 Add route/page transitions (slide/fade); respect `prefers-reduced-motion`.
- [x] 2.6 Fixed header/tab bar with content as the only momentum-scroll region.

## 3. Portal Pages + Composables

- [x] 3.1 `app/pages/portal/index.vue` overview (me + contract + latest invoice).
- [x] 3.2 `app/pages/portal/invoices/index.vue` and `[id].vue` from `/api/tenant/invoices**`.
- [x] 3.3 `app/pages/portal/room.vue` from `/api/tenant/contract`.
- [x] 3.4 `app/pages/portal/requests.vue` from `/api/tenant/requests`.
- [x] 3.5 `app/pages/portal/profile.vue` from `/api/tenant/me` + identity images + documents.
- [x] 3.6 Add `app/composables/tenant-portal/**` for server state; handle loading/empty/error on each page.

## 4. Touch-First Patterns

- [x] 4.1 Bottom-sheet component for modals (drag-to-dismiss where practical), replacing desktop dialogs.
- [x] 4.2 Skeleton loaders for list/detail regions instead of spinners.
- [x] 4.3 Pull-to-refresh on invoices and requests lists.
- [x] 4.4 Optimistic UI for profile save and request submit, with rollback on error.
- [x] 4.5 Portal-scoped toast surface (not the internal `UiToastHost`).

## 5. Visual Identity (frontend-design)

- [x] 5.1 Define portal identity tokens (palette, type scale, spacing, radius) distinct from the internal dark theme.
- [x] 5.2 Apply tokens to `app/components/portal/**`; reuse `Ui*` primitives where they fit; no shadcn-vue.

## 6. Profile, Identity Images, And Documents

- [x] 6.1 Profile edit form using the shared whitelist Zod schema; inline validation.
- [x] 6.2 Identity image slots (front/back) consuming `GET /api/tenant/id-images`, `POST /api/tenant/id-images/[side]`, `DELETE /api/tenant/id-images/[side]`; render returned signed URLs only.
- [x] 6.3 Free-form document list/upload/delete consuming `/api/tenant/documents**`.
- [x] 6.4 Upload UX: progress, retry on flaky networks, and clear type/size errors before upload; never invent paths/buckets (server owns them).

## 7. PWA

- [x] 7.1 Add `@vite-pwa/nuxt` to `package.json` and register in `nuxt.config.ts`.
- [x] 7.2 Configure manifest (name, short_name, lang vi, standalone, theme/background, icons 192/512 maskable) and add icons + `apple-touch-icon` to `public/icons`.
- [x] 7.3 Set `registerType: 'autoUpdate'`.
- [x] 7.4 Configure Workbox to precache static assets only.
- [x] 7.5 Ensure runtime caching EXCLUDES authenticated personal-data responses (no blanket cache of `*.supabase.co` or `/api/tenant/**`, including signed URLs).
- [x] 7.6 Make `navigateFallback` SPA-aware and non-sensitive; add an offline shell fallback page.

## 8. Install UX And iOS

- [x] 8.1 Capture `beforeinstallprompt` and show a custom, dismissible install prompt (not on first paint).
- [x] 8.2 iOS: set `apple-mobile-web-app-capable`, status-bar style, themed splash/background; add an "Add to Home Screen" instruction sheet.
- [x] 8.3 Hide install prompt when running in `display-mode: standalone`.

## 9. Tests / Checks

- [x] 9.1 Portal pages render mobile-first with skeleton/empty/error states.
- [x] 9.2 Native shell: safe-area insets applied, bottom tab + sticky header fixed, transitions respect reduced-motion, touch targets ≥44px.
- [x] 9.3 Non-tenant roles cannot reach `/portal`; tenant cannot reach `/dashboard` (guard regression).
- [x] 9.4 Identity/document upload hits the agreed endpoints and renders signed URLs; no client-invented paths.
- [x] 9.5 Manifest valid; service worker registers and auto-updates; install prompt + iOS A2HS behavior correct.
- [x] 9.6 Verify no authenticated personal-data payload (including signed URLs) is written to the cache; offline fallback is non-sensitive.

## 10. Verification

- [x] 10.1 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [x] 10.2 Run `openspec validate --specs`.
- [x] 10.3 Verify single deployment on `home.zenocorp.vn`: install once, role redirect to `/portal` or `/dashboard`.
