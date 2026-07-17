## 1. Tenant Shell

- [ ] 1.1 Add `app/layouts/tenant.vue` (sticky header + fixed bottom tab bar) with no internal shell components.
- [ ] 1.2 Add `app/components/portal/**` primitives (tab bar, header, card, skeleton, empty/error, bottom sheet, toast).
- [ ] 1.3 Ensure `AppSidebar`/`AppAiDevChat` never render in `/portal`.

## 2. Native App Shell

- [ ] 2.1 Update the app `viewport` meta in `nuxt.config.ts` to include `viewport-fit=cover`.
- [ ] 2.2 Apply `env(safe-area-inset-*)` padding to header and bottom tab bar (notch + home indicator).
- [ ] 2.3 Bottom tab bar: 5 tabs (Trang chủ / Hoá đơn / Phòng / Yêu cầu / Tài khoản), ≥44px targets, active indicator.
- [ ] 2.4 Sticky header with contextual title + single primary action + in-app back affordance.
- [ ] 2.5 Add route/page transitions (slide/fade); respect `prefers-reduced-motion`.
- [ ] 2.6 Fixed header/tab bar with content as the only momentum-scroll region.

## 3. Portal Pages + Composables

- [ ] 3.1 `app/pages/portal/index.vue` overview (me + contract + latest invoice).
- [ ] 3.2 `app/pages/portal/invoices/index.vue` and `[id].vue` from `/api/tenant/invoices**`.
- [ ] 3.3 `app/pages/portal/room.vue` from `/api/tenant/contract`.
- [ ] 3.4 `app/pages/portal/requests.vue` from `/api/tenant/requests`.
- [ ] 3.5 `app/pages/portal/profile.vue` from `/api/tenant/me` + identity images + documents.
- [ ] 3.6 Add `app/composables/tenant-portal/**` for server state; handle loading/empty/error on each page.

## 4. Touch-First Patterns

- [ ] 4.1 Bottom-sheet component for modals (drag-to-dismiss where practical), replacing desktop dialogs.
- [ ] 4.2 Skeleton loaders for list/detail regions instead of spinners.
- [ ] 4.3 Pull-to-refresh on invoices and requests lists.
- [ ] 4.4 Optimistic UI for profile save and request submit, with rollback on error.
- [ ] 4.5 Portal-scoped toast surface (not the internal `UiToastHost`).

## 5. Visual Identity (frontend-design)

- [ ] 5.1 Define portal identity tokens (palette, type scale, spacing, radius) distinct from the internal dark theme.
- [ ] 5.2 Apply tokens to `app/components/portal/**`; reuse `Ui*` primitives where they fit; no shadcn-vue.

## 6. Profile, Identity Images, And Documents

- [ ] 6.1 Profile edit form using the shared whitelist Zod schema; inline validation.
- [ ] 6.2 Identity image slots (front/back) consuming `GET /api/tenant/id-images`, `POST /api/tenant/id-images/[side]`, `DELETE /api/tenant/id-images/[side]`; render returned signed URLs only.
- [ ] 6.3 Free-form document list/upload/delete consuming `/api/tenant/documents**`.
- [ ] 6.4 Upload UX: progress, retry on flaky networks, and clear type/size errors before upload; never invent paths/buckets (server owns them).

## 7. PWA

- [ ] 7.1 Add `@vite-pwa/nuxt` to `package.json` and register in `nuxt.config.ts`.
- [ ] 7.2 Configure manifest (name, short_name, lang vi, standalone, theme/background, icons 192/512 maskable) and add icons + `apple-touch-icon` to `public/icons`.
- [ ] 7.3 Set `registerType: 'autoUpdate'`.
- [ ] 7.4 Configure Workbox to precache static assets only.
- [ ] 7.5 Ensure runtime caching EXCLUDES authenticated personal-data responses (no blanket cache of `*.supabase.co` or `/api/tenant/**`, including signed URLs).
- [ ] 7.6 Make `navigateFallback` SPA-aware and non-sensitive; add an offline shell fallback page.

## 8. Install UX And iOS

- [ ] 8.1 Capture `beforeinstallprompt` and show a custom, dismissible install prompt (not on first paint).
- [ ] 8.2 iOS: set `apple-mobile-web-app-capable`, status-bar style, themed splash/background; add an "Add to Home Screen" instruction sheet.
- [ ] 8.3 Hide install prompt when running in `display-mode: standalone`.

## 9. Tests / Checks

- [ ] 9.1 Portal pages render mobile-first with skeleton/empty/error states.
- [ ] 9.2 Native shell: safe-area insets applied, bottom tab + sticky header fixed, transitions respect reduced-motion, touch targets ≥44px.
- [ ] 9.3 Non-tenant roles cannot reach `/portal`; tenant cannot reach `/dashboard` (guard regression).
- [ ] 9.4 Identity/document upload hits the agreed endpoints and renders signed URLs; no client-invented paths.
- [ ] 9.5 Manifest valid; service worker registers and auto-updates; install prompt + iOS A2HS behavior correct.
- [ ] 9.6 Verify no authenticated personal-data payload (including signed URLs) is written to the cache; offline fallback is non-sensitive.

## 10. Verification

- [ ] 10.1 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [ ] 10.2 Run `openspec validate --specs`.
- [ ] 10.3 Verify single deployment on `home.zenocorp.vn`: install once, role redirect to `/portal` or `/dashboard`.
