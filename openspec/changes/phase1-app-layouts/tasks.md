## 1. i18n & Store

- [ ] 1.1 Create `locales/vi/navigation.json` — all sidebar and tenant bottom nav labels
- [ ] 1.2 Create `locales/en/navigation.json` — identical key set in English
- [ ] 1.3 Create `app/stores/ui.ts` — `sidebarOpen`, `toggleSidebar()`, `closeSidebar()`

## 2. Shared Layout Components

- [ ] 2.1 Create `app/components/layout/Header.vue` — top bar with breadcrumb slot, notification bell slot, user dropdown, language switcher
- [ ] 2.2 Create `app/components/layout/Breadcrumb.vue` — reads `route.meta.breadcrumb` i18n key
- [ ] 2.3 Create `app/components/layout/UserDropdown.vue` — shows `profile.full_name`, profile link, logout action
- [ ] 2.4 Create `app/components/layout/LanguageSwitcher.vue` — vi/en toggle via `useI18n().setLocale()`
- [ ] 2.5 Create `app/components/layout/NotificationBell.vue` — UChip with `useNotificationsStore().unreadCount` (defaults to 0)

## 3. Admin/Manager Default Layout

- [ ] 3.1 Create `app/components/layout/Sidebar.vue` — nav items list, active state, role-filtered (hide Cài đặt for manager)
- [ ] 3.2 Create `app/components/layout/MobileNav.vue` — hamburger button, overlay backdrop, close on outside click
- [ ] 3.3 Implement `app/layouts/default.vue` — compose Sidebar + Header, mobile responsive, watcher to close sidebar on route change

## 4. Tenant Layout

- [ ] 4.1 Create `app/components/layout/TenantBottomNav.vue` — 6-item bottom nav with icons, active state
- [ ] 4.2 Implement `app/layouts/tenant.vue` — simplified header + TenantBottomNav, mobile-first spacing
