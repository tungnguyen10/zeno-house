## Why

All modules (contracts, maintenance, invoices) need to push notifications to relevant users in real-time. The notification bell in the layout (1.2) is currently a stub with count=0. This change wires everything together.

## What Changes

- Add `notifications` table with Supabase Realtime subscription
- Add `NotificationDropdown.vue`, `NotificationItem.vue`, `NotificationList.vue`, `NotificationSettings.vue` components
- Wire `NotificationBell.vue` to real `unreadCount` from store
- Add `useNotifications()` composable and `useNotificationsStore` Pinia store
- Add `/notifications` full list page and `/settings/notifications` settings page
- Add `locales/vi/notifications.json` + `locales/en/notifications.json`
- Add helper utilities in other modules to insert notification rows on key events

## Capabilities

### New Capabilities

- `notifications-inapp`: Real-time in-app notification system with Supabase Realtime, per-user filtering, mark-as-read, and category-based display

### Modified Capabilities

*(none)*

## Impact

- `app/components/layout/NotificationBell.vue` — wired to real store (replaces stub)
- `app/components/features/notification/` — new components
- `app/composables/useNotifications.ts` — new composable
- `app/stores/notifications.ts` — new Pinia store with Realtime subscription
- `app/pages/admin/notifications/index.vue`, `app/pages/manager/notifications/index.vue`, `app/pages/tenant/notifications.vue` — implemented
- `server/api/notifications/` — new API routes
- `locales/vi/notifications.json`, `locales/en/notifications.json`
- Supabase `notifications` table + Realtime channel (migration required)
- Depends on all prior modules (notification types reference contracts, maintenance)
