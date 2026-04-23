## Context

`notifications` table has: `id`, `user_id` (FK profiles), `type` (`invoice` | `contract` | `maintenance` | `system`), `title`, `body`, `link` (route to navigate to), `is_read`, `created_at`. Supabase Realtime broadcasts INSERT events filtered by `user_id`.

`useNotificationsStore` initializes a Realtime channel subscription when the user logs in and tears it down on logout. The `NotificationBell` stub in 1.2 already reads `useNotificationsStore().unreadCount` — once the store is real, the bell lights up automatically.

## Goals / Non-Goals

**Goals:**
- Real-time bell badge count via Supabase Realtime
- Dropdown showing 5 most recent, click to navigate
- Full list page with mark-as-read, mark-all-as-read
- Category icons (invoice, contract, maintenance, system)
- Time-ago format (e.g., "5 phút trước")
- Other modules insert notification rows via a `createNotification()` server utility

**Non-Goals:**
- Push notifications (mobile/browser — Phase 2)
- Email notifications (Phase 2)
- Notification preferences per category (Phase 2 — settings page is a stub)
- Notification grouping/threading (Phase 2)

## Decisions

### 1. Realtime subscription in store, not composable

`useNotificationsStore` sets up the Supabase Realtime channel in a `$subscribe`-like pattern, initialized once on first `fetchNotifications()` call.

**Why**: Notifications must be globally available and persistent across navigation. Store is the right level.

### 2. Store teardown on logout via `$reset()`

`$reset()` calls `channel?.unsubscribe()` before clearing state.

**Why**: Prevents cross-user data leakage if a different user logs in within the same browser session.

### 3. Other modules insert notifications via a shared server utility

`server/utils/notifications.ts` exports `createNotification(client, { userId, type, title, body, link })`. Called from contract termination, maintenance status changes, etc.

**Why**: Centralises notification creation logic; modules don't need to know the table schema.

### 4. `NotificationDropdown` shows last 5, links to full list

`useNotificationsStore().recent` computed returns last 5 by `created_at DESC`. Full list is paginated.

**Why**: Dropdown must be fast and not overflow the header.

### 5. Time-ago format uses a lightweight utility

`useTimeAgo()` composable (or Nuxt's built-in `useRelativeTime` if available) formats timestamps as "X phút trước" / "X ngày trước".

**Why**: Avoids heavy date library import for a simple formatting need.

## Risks / Trade-offs

- **Realtime channel quota** → Each user opens a Supabase Realtime channel. On free tier: 200 concurrent connections. Fine for Phase 1 scale.
- **Notification insert performance** → Every status change in maintenance triggers a `createNotification` insert. At low volume this is fine; at scale it's async/queued. Mitigation: acceptable for Phase 1.
- **Missed notifications on reconnect** → If connection drops, Realtime may miss inserts. Mitigation: `fetchNotifications()` is also called on app focus (`document.visibilitychange`).
