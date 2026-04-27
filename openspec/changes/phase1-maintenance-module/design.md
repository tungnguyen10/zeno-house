## Context

`maintenance_requests` table is shared between tenant portal (create) and this admin module (manage). A `maintenance_status_history` table tracks every status change with timestamp, actor, and notes. Photos are stored in Supabase Storage (`maintenance/` bucket).

> **Schema notes (migration 001 actual fields):** `id`, `room_id`, `tenant_id`, `title`, `description`, `status` (enum: `'open'`, `'in_progress'`, `'resolved'`, `'closed'`), `priority INTEGER` (1=low, 2=medium, 3=high — 3 levels only, NOT 4 text levels, no "urgent"), `resolved_at`, `resolved_by`, `created_at`, `updated_at`. The following do NOT exist in migration 001 and require migration 003: `image_urls TEXT[]`, `assigned_to UUID FK profiles`, `estimated_cost NUMERIC`, `actual_cost NUMERIC`. The `maintenance_status_history` table also does NOT exist in migration 001 — add via migration 003.

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

Actual enum values (migration 001): `'open'`, `'in_progress'`, `'resolved'`, `'closed'`. `open → in_progress → resolved → closed`. Cannot revert from `resolved` or `closed`. Note: `'cancelled'` is NOT in the current enum — add to migration 003 if needed.

**Why**: Prevents data integrity issues; resolved work shouldn't be "un-resolved" — create a new request if needed.

### 3. Assignment via `assigned_to` FK on `maintenance_requests`

`assignTo(id, userId)` sets `assigned_to = userId` (must be a profile with `role = 'manager'`). Note: `assigned_to UUID FK profiles` does NOT exist in migration 001 — add via migration 003.

**Why**: Simple FK; assignee gets a notification (via 1.9 notifications).

### 4. Photos are read-only on the admin detail view

Admin can view photos tenants uploaded but cannot add photos in Phase 1.

**Why**: Scope reduction; admin photo attachment is Phase 2.

### 5. Cost fields: `estimated_cost` and `actual_cost` (nullable decimals)

Set when admin updates the request. Not required. Note: `estimated_cost NUMERIC` and `actual_cost NUMERIC` do NOT exist in migration 001 — add via migration 003.

**Why**: Cost tracking is useful for reporting; but optional so requests can be closed without a cost entry.

## Risks / Trade-offs

- **Notification trigger** → Status change should notify the tenant. This requires the Notifications module (1.9). In Phase 1, the notification call is a no-op until 1.9 is implemented. Mitigation: call `notifyStatusChange()` helper that gracefully does nothing if notifications store isn't ready.
- **Photos URL access** → Maintenance photos are in a private bucket. Admin needs signed URLs. Mitigation: API returns signed URLs for each photo.
