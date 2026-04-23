## ADDED Requirements

### Requirement: NotificationBell shows real unread count via Supabase Realtime
The system SHALL have `NotificationBell.vue` display the live unread notification count from `useNotificationsStore().unreadCount`. The count updates in real-time when new notifications arrive via Supabase Realtime without page refresh.

#### Scenario: New notification increments bell count in real time
- **WHEN** a new notification is inserted for the current user
- **THEN** the bell badge count increments within 1 second without page reload

#### Scenario: Bell shows no badge when count is zero
- **WHEN** a user has no unread notifications
- **THEN** the bell renders without a badge

### Requirement: Notification dropdown shows 5 most recent with navigation
The system SHALL show a dropdown from the bell icon listing the 5 most recent notifications with icon, title, time-ago, and read/unread state. Clicking a notification marks it as read and navigates to its `link` route.

#### Scenario: Clicking notification navigates to linked route
- **WHEN** a user clicks a maintenance notification
- **THEN** they are navigated to `/admin/maintenance/[id]` and the notification is marked as read

#### Scenario: Dropdown shows 5 most recent only
- **WHEN** a user has 10 unread notifications
- **THEN** the dropdown shows 5 items and a "Xem tất cả" link

### Requirement: Full notification list supports mark-as-read and mark-all-as-read
The system SHALL provide a `/notifications` page listing all notifications with a "Mark all as read" action and per-item mark-as-read.

#### Scenario: Mark all as read clears unread count
- **WHEN** a user clicks "Đánh dấu tất cả đã đọc"
- **THEN** all notifications are marked as read and the bell badge disappears

### Requirement: Notification store tears down Realtime on logout
The system SHALL unsubscribe the Supabase Realtime channel when `useNotificationsStore().$reset()` is called (on logout).

#### Scenario: Realtime channel is unsubscribed on logout
- **WHEN** a user logs out
- **THEN** the Realtime channel is unsubscribed before the store state is cleared

### Requirement: Other modules create notifications via shared server utility
The system SHALL have a `server/utils/notifications.ts` utility that other server routes use to insert notification rows. Callers provide `userId`, `type`, `title`, `body`, and `link`.

#### Scenario: Maintenance status change creates tenant notification
- **WHEN** an admin changes a maintenance request to `in_progress`
- **THEN** a `maintenance` type notification is inserted for the request's tenant

#### Scenario: Contract expiry warning creates notification
- **WHEN** a contract is within 7 days of expiry
- **THEN** a `contract` type notification is inserted for the manager and tenant
