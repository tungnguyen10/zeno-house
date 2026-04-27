## Why

The four layouts exist as stubs but have no navigation, sidebar, or header content. Admin/manager pages cannot be navigated without a working sidebar; tenant pages have no bottom nav. All Phase 1 modules depend on these layouts being functional.

## What Changes

- Implement `app/layouts/default.vue` — sidebar with full admin/manager nav, header with breadcrumb, notification bell, user dropdown, language switcher; mobile hamburger menu
- Implement `app/layouts/tenant.vue` — simplified top header, bottom navigation for mobile
- Add navigation components: `AppSidebar.vue`, `AppHeader.vue`, `AppBreadcrumb.vue`, `NotificationBell.vue` (stub), `UserDropdown.vue`, `LanguageSwitcher.vue`, `MobileNav.vue`
- Add `ui.ts` Pinia store: `sidebarOpen` state, `currentLocale`
- Add `locales/vi/navigation.json` + `locales/en/navigation.json` with all menu labels

## Capabilities

### New Capabilities

- `app-navigation`: Sidebar, header, and mobile nav components wired to auth state and i18n
- `ui-store`: `useUiStore` managing sidebar open/close and locale state

### Modified Capabilities

*(none)*

## Impact

- `app/layouts/default.vue` — full implementation replacing stub
- `app/layouts/tenant.vue` — full implementation replacing stub
- `app/components/layout/` — new folder with all nav components
- `app/stores/ui.ts` — new Pinia store
- `locales/vi/navigation.json`, `locales/en/navigation.json` — new files
- Depends on `phase1-auth-system` (needs `useAuth` for user dropdown and role-based nav items)
