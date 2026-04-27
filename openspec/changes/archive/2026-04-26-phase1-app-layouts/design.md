## Context

Layouts are stubs with just `<slot />`. The project uses Nuxt UI for components and TailwindCSS for layout. `@nuxtjs/i18n` is configured. `useAuthStore` (from phase1-auth-system) provides `profile` for the user dropdown. Notification count is a stub (wired in phase1-notifications later).

## Goals / Non-Goals

**Goals:**
- Functional sidebar and header for admin/manager layout
- Mobile-responsive: sidebar collapses, hamburger toggle, bottom nav for tenant
- Language switcher wired to `useI18n().locale`
- User dropdown: show `profile.full_name`, logout action
- Notification bell: renders with count=0 stub (real count wired in 1.9)

**Non-Goals:**
- Real notification count (placeholder only)
- Dynamic breadcrumb from route (static label from route meta)
- Sidebar collapse animation (toggle only)
- Active state persistence across refresh for sidebar

## Decisions

### 1. Component structure under `app/components/layout/`

Nav components live under `layout/` subfolder → auto-import prefix `<Layout*>`. The sidebar and header are separate components composed inside `default.vue`.

**Why**: Keeps `default.vue` thin; each component is independently testable.

### 2. `useUiStore` for sidebar state (not local ref in layout)

`sidebarOpen` lives in a Pinia store rather than a `ref` in `default.vue`.

**Why**: Other components (mobile hamburger button, close-on-route-change) need to toggle it without prop drilling.

### 3. NotificationBell stub pattern

`NotificationBell.vue` renders a `UChip` with count from `useNotificationsStore().unreadCount` — but that store defaults to 0 and is fully implemented in phase1-notifications. No conditional import needed.

**Why**: Avoids rework; the bell works visually from day one and lights up automatically when notifications are implemented.

### 4. Language switcher uses `useI18n().setLocale()`

Switching locale via `setLocale()` triggers a page refresh (Nuxt i18n default). Store `currentLocale` mirrors `useI18n().locale` for SSR consistency.

**Why**: Nuxt i18n handles route-based locale already; we don't need custom locale persistence.

### 5. Breadcrumb reads `route.meta.breadcrumb`

Each page sets `definePageMeta({ breadcrumb: 'rooms.title' })` (i18n key). `AppBreadcrumb` reads this and renders with `$t()`.

**Why**: Simple, no router inspection needed, easy to maintain.

## Risks / Trade-offs

- **NotificationBell depends on 1.9 store** → If the store doesn't exist yet, `unreadCount` defaults to 0. This is safe — the store is initialised lazily. No error.
- **Mobile hamburger UX** → Sidebar overlay on mobile requires a backdrop click to close. Mitigation: use `useUiStore().sidebarOpen = false` in a backdrop div.

## Open Questions

- Should admin and manager see different sidebar items? → Admin sees all items; manager sees all except "Cài đặt". Implement with `isAdmin` from `useAuth`.
