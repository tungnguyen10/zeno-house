## 1. Database & Types

- [ ] 1.1 Create Supabase migration: `tenants` table (`id`, `profile_id`, `full_name`, `phone`, `cccd`, `cccd_front_url`, `cccd_back_url`, `dob`, `address`, `is_active`, `created_at`)
- [ ] 1.2 Add RLS policies: `tenants_admin_all`, `tenants_manager_select/insert/update` (scoped to own buildings), `tenants_self_select` (tenant reads own record)
- [ ] 1.3 Create private Supabase Storage bucket `cccd` with RLS (admin/manager access only)
- [ ] 1.4 Create `app/types/tenants.ts` — `Tenant` interface, `createTenantSchema`, `updateTenantSchema` with VN phone regex + CCCD 12-digit validation
- [ ] 1.5 Create `locales/vi/tenants.json` + `locales/en/tenants.json`

## 2. API Routes

- [ ] 2.1 Create `server/api/tenants/index.get.ts` — list tenants
- [ ] 2.2 Create `server/api/tenants/index.post.ts` — create tenant
- [ ] 2.3 Create `server/api/tenants/[id].get.ts` — get tenant with current room/contract
- [ ] 2.4 Create `server/api/tenants/[id].put.ts` — update tenant info
- [ ] 2.5 Create `server/api/tenants/[id].delete.ts` — soft delete (set `is_active = false`)
- [ ] 2.6 Create `server/api/tenants/[id]/invite.post.ts` — Supabase Auth invite via service-role
- [ ] 2.7 Create `server/api/tenants/[id]/checkout.post.ts` — terminate contracts, free room
- [ ] 2.8 Create `server/api/upload/cccd.post.ts` — upload CCCD image to Supabase Storage

## 3. Composable

- [ ] 3.1 Create `app/composables/useTenants.ts` — `tenants`, `loading`, `error`, `fetchTenants()`, `getTenant(id)`, `createTenant()`, `updateTenant()`, `deleteTenant()`, `inviteTenant(id)`, `assignRoom(tenantId, roomId)`, `checkout(tenantId)`

## 4. Components

- [ ] 4.1 Create `app/components/features/tenant/Card.vue` — tenant name, phone, current room, is_active badge
- [ ] 4.2 Create `app/components/features/tenant/Form.vue` — 3-step stepper: (1) personal info, (2) CCCD upload, (3) room assignment + placeholder services step
- [ ] 4.3 Create `app/components/features/tenant/Select.vue` — dropdown to pick a tenant
- [ ] 4.4 Create `app/components/features/tenant/CCCDUpload.vue` — front/back image upload, disabled AI button placeholder
- [ ] 4.5 Create `app/components/features/tenant/History.vue` — table of past room assignments

## 5. Pages (Admin)

- [ ] 5.1 Create `app/pages/admin/tenants/index.vue` — list with search
- [ ] 5.2 Create `app/pages/admin/tenants/new.vue` — multi-step form
- [ ] 5.3 Create `app/pages/admin/tenants/[id].vue` — detail + invite button + checkout button
- [ ] 5.4 Create `app/pages/admin/tenants/[id]/edit.vue` — edit form
- [ ] 5.5 Create `app/pages/admin/tenants/[id]/history.vue` — rental history

## 6. Pages (Manager)

- [ ] 6.1 Create `app/pages/manager/tenants/index.vue`
- [ ] 6.2 Create `app/pages/manager/tenants/new.vue`
- [ ] 6.3 Create `app/pages/manager/tenants/[id].vue`
- [ ] 6.4 Create `app/pages/manager/tenants/[id]/edit.vue`
- [ ] 6.5 Create `app/pages/manager/tenants/[id]/history.vue`
