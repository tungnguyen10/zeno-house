## Context

`maintenance_requests` table is shared between tenant portal (create) and this admin module (manage). A `maintenance_status_history` table tracks every status change with timestamp, actor, and notes. Photos are stored in Supabase Storage (`maintenance/` bucket).

## Goals / Non-Goals

**Goals:**
- Admin/manager list view with filters (status, priority, building/room, date range)
- Detail page: view request, update status, assign to manager, add estimated/actual cost, notes
- Timeline component showing full status change history
- Notifications triggered on status change (wired to 1.9 notifications)

**Non-Goals:**
- Scheduling/calendar view for maintenance work (Phase 2)
- Vendor management or external contractor assignment (Phase 2)
- Automated cost reporting/export (Phase 2)

## Decisions

### 1. `maintenance_status_history` table for audit trail

Every status change writes a row: `request_id`, `from_status`, `to_status`, `changed_by`, `notes`, `timestamp`.

**Why**: `MaintenanceTimeline.vue` needs the full history. Storing only current status loses the audit trail.

### 2. Status transitions: only forward, no going back

`pending → in_progress → completed`. `pending → cancelled`. Cannot revert from `completed` or `cancelled`.

**Why**: Prevents data integrity issues; completed work shouldn't be "un-completed" — create a new request if needed.

### 3. Assignment via `assigned_to` FK on `maintenance_requests`

`assignTo(id, userId)` sets `assigned_to = userId` (must be a profile with `role = 'manager'`).

**Why**: Simple FK; assignee gets a notification (via 1.9 notifications).

### 4. Photos are read-only on the admin detail view

Admin can view photos tenants uploaded but cannot add photos in Phase 1.

**Why**: Scope reduction; admin photo attachment is Phase 2.

### 5. Cost fields: `estimated_cost` and `actual_cost` (nullable decimals)

Set when admin updates the request. Not required.

**Why**: Cost tracking is useful for reporting; but optional so requests can be closed without a cost entry.

## Risks / Trade-offs

- **Notification trigger** → Status change should notify the tenant. This requires the Notifications module (1.9). In Phase 1, the notification call is a no-op until 1.9 is implemented. Mitigation: call `notifyStatusChange()` helper that gracefully does nothing if notifications store isn't ready.
- **Photos URL access** → Maintenance photos are in a private bucket. Admin needs signed URLs. Mitigation: API returns signed URLs for each photo.
