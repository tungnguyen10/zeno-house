## 1. Database & Types

- [ ] 1.1 `tenants` table already exists from migration 001 with: `id` (= `profiles.id` FK, NOT a separate `profile_id`), `identity_number` (NOT `cccd`), `identity_issued_date`, `identity_issued_place`, `permanent_address`, `emergency_contact_name`, `emergency_contact_phone`, `created_at`. Note: `full_name` and `phone` are on `profiles`, NOT `tenants`. Fields `cccd_front_url`, `cccd_back_url`, `cccd_verified` are added via migration 003. `dob` and `is_active` do NOT exist in schema — defer `dob` to future migration; use `profiles` active state if needed
- [ ] 1.2 Verify existing RLS policies in migration 001: `tenants_admin_all`, `tenants_manager_select/insert/update` (scoped to own buildings), `tenants_self_select` (tenant reads own record)
- [ ] 1.3 Create private Supabase Storage bucket `cccd` with RLS (admin/manager access only)
- [ ] 1.4 Create `app/types/tenants.ts` — `Tenant` interface, `createTenantSchema`, `updateTenantSchema` with VN phone regex + `identity_number` 12-digit validation
- [ ] 1.5 Fill `i18n/locales/vi/tenants.json` + `i18n/locales/en/tenants.json` with required keys (files already exist)

## 2. API Routes

- [ ] 2.1 Create `server/api/tenants/index.get.ts` — list tenants
- [ ] 2.2 Create `server/api/tenants/index.post.ts` — create tenant
- [ ] 2.3 Create `server/api/tenants/[id].get.ts` — get tenant with current room/contract
- [ ] 2.4 Create `server/api/tenants/[id].put.ts` — update tenant info
- [ ] 2.5 Create `server/api/tenants/[id].delete.ts` — soft delete (deactivate profile; `is_active` field not on tenants table — update `profiles` or use checkout flow)
- [ ] 2.6 Create `server/api/tenants/[id]/invite.post.ts` — Supabase Auth invite via service-role
- [ ] 2.7 Create `server/api/tenants/[id]/checkout.post.ts` — terminate contracts, free room
- [ ] 2.8 Create `server/api/upload/cccd.post.ts` — upload CCCD image to Supabase Storage

## 3. Composable

- [ ] 3.1 Create `app/composables/useTenants.ts` — `tenants`, `loading`, `error`, `fetchTenants()`, `getTenant(id)`, `createTenant()`, `updateTenant()`, `deleteTenant()`, `inviteTenant(id)`, `assignRoom(tenantId, roomId)`, `checkout(tenantId)`

## 4. Components

- [ ] 4.1 Create `app/components/features/tenant/Card.vue` — tenant name (from profiles), phone (from profiles), current room, active status
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
