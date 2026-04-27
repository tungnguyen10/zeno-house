## 1. i18n & Store

- [x] 1.1 Create `locales/vi/navigation.json` — all sidebar and tenant bottom nav labels
- [x] 1.2 Create `locales/en/navigation.json` — identical key set in English
- [x] 1.3 Create `app/stores/ui.ts` — `sidebarOpen`, `toggleSidebar()`, `closeSidebar()`

## 2. Shared Layout Components

- [x] 2.1 Create `app/components/layout/Header.vue` — top bar with breadcrumb slot, notification bell slot, user dropdown, language switcher
- [x] 2.2 Create `app/components/layout/Breadcrumb.vue` — reads `route.meta.breadcrumb` i18n key
- [x] 2.3 Create `app/components/layout/UserDropdown.vue` — shows `profile.full_name`, profile link, logout action
- [x] 2.4 Create `app/components/layout/LanguageSwitcher.vue` — vi/en toggle via `useI18n().setLocale()`
- [x] 2.5 Create `app/components/layout/NotificationBell.vue` — UChip with `useNotificationsStore().unreadCount` (defaults to 0)

## 3. Admin/Manager Default Layout

- [x] 3.1 Create `app/components/layout/Sidebar.vue` — nav items list, active state, role-filtered (hide Cài đặt for manager)
- [x] 3.2 Create `app/components/layout/MobileNav.vue` — hamburger button, overlay backdrop, close on outside click
- [x] 3.3 Implement `app/layouts/default.vue` — compose Sidebar + Header, mobile responsive, watcher to close sidebar on route change

## 4. Tenant Layout

- [x] 4.1 Create `app/components/layout/TenantBottomNav.vue` — 6-item bottom nav with icons, active state
- [x] 4.2 Implement `app/layouts/tenant.vue` — simplified header + TenantBottomNav, mobile-first spacing

## 5. Unspecified — Implemented During Verification

- [x] 5.1 Create `app/stores/notifications.ts` — `useNotificationsStore` stub with `unreadCount = 0`; wires `NotificationBell` so it lights up automatically when `phase1-notifications` is done (per design.md Decision 3, but no task existed)
- [x] 5.2 Create `app/composables/useLogout.ts` — shared `logout()` logic (reset store + signOut + redirect); removes duplication between `UserDropdown.vue` and `tenant.vue`
- [x] 5.3 Replace all `UIcon name="i-lucide-*"` with custom SVG components per `svg.md` rule — create 13 missing icons in `app/assets/icons/`: `dashboard`, `building`, `door-open`, `file-text`, `receipt`, `zap`, `wallet`, `wrench`, `bar-chart`, `bell`, `home`, `log-out`, `user`; reuse 5 existing: `menu`, `x`, `chevron-down`, `settings`, `users`
- [x] 5.4 Fix `nuxt.config.ts` — `storesDirs: ["./app/stores/**"]` sai path với Nuxt 4 (`srcDir = app/`); đổi thành `storesDirs: ["./stores/**"]` và thêm `imports.dirs: ["stores"]` để `useAuthStore`, `useUiStore`, `useNotificationsStore` được auto-import đúng
