## 1. Database & Types

- [ ] 1.1 `notifications` table already exists from migration 001 with: `id`, `user_id`, `title`, `body`, `type TEXT`, `reference_id UUID`, `reference_type TEXT`, `is_read`, `created_at`. No `link` column exists — navigation is computed from `reference_id` + `reference_type`. Verify Realtime is enabled on the table
- [ ] 1.2 Verify existing RLS policies in migration 001: users can only select/update their own notifications; service-role for insert
- [ ] 1.3 Enable Supabase Realtime on `notifications` table
- [ ] 1.4 Create `app/types/notifications.ts` — `Notification`, `NotificationType` types
- [ ] 1.5 Fill `i18n/locales/vi/notifications.json` + `i18n/locales/en/notifications.json` with required keys (files already exist at `i18n/locales/`, NOT `locales/`)

## 2. Server Utility & API

- [ ] 2.1 Create `server/utils/notifications.ts` — `createNotification(client, { userId, type, title, body, referenceId, referenceType })` utility (no `link` field — use `reference_id` + `reference_type`)
- [ ] 2.2 Create `server/api/notifications/index.get.ts` — paginated list for current user
- [ ] 2.3 Create `server/api/notifications/[id]/read.patch.ts` — mark single notification as read
- [ ] 2.4 Create `server/api/notifications/read-all.patch.ts` — mark all as read for current user

## 3. Store & Composable

- [ ] 3.1 Expand existing `app/stores/notifications.ts` (already exists with minimal `unreadCount` + `$reset()`) — add `notifications`, `recent` (computed top 5), `fetchNotifications()`, `markAsRead(id)`, `markAllAsRead()`, Realtime subscription setup, update `$reset()` to unsubscribe channel
- [ ] 3.2 Create `app/composables/useNotifications.ts` — thin wrapper exposing store + formatted helpers (time-ago)

## 4. Components

- [ ] 4.1 Create `app/components/features/notification/Item.vue` — icon by type, title, body, time-ago, unread dot
- [ ] 4.2 Create `app/components/features/notification/Dropdown.vue` — recent 5 list + "Xem tất cả" link
- [ ] 4.3 Create `app/components/features/notification/List.vue` — full paginated list with mark-all button
- [ ] 4.4 Update `app/components/layout/NotificationBell.vue` — wire to `useNotificationsStore().unreadCount` (replace hardcoded 0)

## 5. Pages

- [ ] 5.1 Create `app/pages/admin/notifications/index.vue` — uses `NotificationList`
- [ ] 5.2 Create `app/pages/manager/notifications/index.vue`
- [ ] 5.3 Implement `app/pages/tenant/notifications.vue` — uses `NotificationList`

## 6. Wire Notifications into Other Modules

- [ ] 6.1 Call `createNotification()` in `server/api/maintenance/[id].patch.ts` when status changes (notify tenant)
- [ ] 6.2 Call `createNotification()` in `server/api/contracts/[id]/terminate.post.ts` (notify tenant)
- [ ] 6.3 Add contract expiry check: cron or on-fetch check in `GET /api/contracts` to create expiry notifications
