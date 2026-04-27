## 1. Database & Types

- [ ] 1.1 `maintenance_requests` table already exists from migration 001 with: `id`, `room_id`, `tenant_id`, `title`, `description`, `status` (enum: `'open'`, `'in_progress'`, `'resolved'`, `'closed'`), `priority INTEGER` (1=low, 2=medium, 3=high), `resolved_at`, `resolved_by`, `created_at`, `updated_at`. Add via migration 003: `image_urls TEXT[] NOT NULL DEFAULT '{}'`, `assigned_to UUID REFERENCES profiles(id)`, `estimated_cost NUMERIC`, `actual_cost NUMERIC`
- [ ] 1.2 `maintenance_status_history` table does NOT exist yet — add via migration 003: `id`, `request_id FK maintenance_requests`, `from_status`, `to_status`, `changed_by FK profiles`, `notes`, `created_at`
- [ ] 1.3 Verify existing RLS policies in migration 001: admin all; manager scoped to own buildings; tenant insert + select own
- [ ] 1.4 Create private Supabase Storage bucket `maintenance` for photo uploads
- [ ] 1.5 Create `app/types/maintenance.ts` — `MaintenanceRequest`, `MaintenanceStatus`, `MaintenancePriority` types, Zod schemas
- [ ] 1.6 Fill `i18n/locales/vi/maintenance.json` + `i18n/locales/en/maintenance.json` with required keys (files already exist)

## 2. API Routes

- [ ] 2.1 Create `server/api/maintenance/index.get.ts` — list with status/priority/building/room/date filters
- [ ] 2.2 Create `server/api/maintenance/index.post.ts` — create request (used by tenant portal)
- [ ] 2.3 Create `server/api/maintenance/[id].get.ts` — detail with photo signed URLs and status history
- [ ] 2.4 Create `server/api/maintenance/[id].patch.ts` — update status (validates transition), assign, set costs
- [ ] 2.5 Create `server/api/upload/maintenance-photo.post.ts` — upload photo to Supabase Storage

## 3. Composable

- [ ] 3.1 Create `app/composables/useMaintenance.ts` — `requests`, `loading`, `error`, `fetchRequests(filters)`, `getRequest(id)`, `createRequest()`, `updateStatus(id, status, notes)`, `assignTo(id, userId)`, `getByRoom(roomId)`, `getByTenant(tenantId)`

## 4. Components

- [ ] 4.1 Create `app/components/features/maintenance/StatusBadge.vue` — priority-colored badge
- [ ] 4.2 Create `app/components/features/maintenance/Card.vue` — title, priority, status, room, tenant, date
- [ ] 4.3 Create `app/components/features/maintenance/Timeline.vue` — chronological status history
- [ ] 4.4 Create `app/components/features/maintenance/Filters.vue` — status, priority, building/room select, date range picker

## 5. Pages (Admin)

- [ ] 5.1 Create `app/pages/admin/maintenance/index.vue` — list with filters
- [ ] 5.2 Create `app/pages/admin/maintenance/[id].vue` — detail, status update, assign, cost fields, photo viewer, timeline

## 6. Pages (Manager)

- [ ] 6.1 Create `app/pages/manager/maintenance/index.vue`
- [ ] 6.2 Create `app/pages/manager/maintenance/[id].vue`
