## 1. Database & Types

- [ ] 1.1 Create Supabase migration: `maintenance_requests` table (`id`, `tenant_id`, `room_id`, `title`, `description`, `priority`, `status`, `assigned_to`, `estimated_cost`, `actual_cost`, `photo_urls`, `created_at`, `updated_at`)
- [ ] 1.2 Create Supabase migration: `maintenance_status_history` table (`id`, `request_id`, `from_status`, `to_status`, `changed_by`, `notes`, `created_at`)
- [ ] 1.3 Add RLS policies: admin all; manager scoped to own buildings; tenant insert + select own
- [ ] 1.4 Create private Supabase Storage bucket `maintenance` for photo uploads
- [ ] 1.5 Create `app/types/maintenance.ts` — `MaintenanceRequest`, `MaintenanceStatus`, `MaintenancePriority` types, Zod schemas
- [ ] 1.6 Create `locales/vi/maintenance.json` + `locales/en/maintenance.json`

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
