## Why

Tenants are the people who rent rooms — managing their info, onboarding (check-in flow), and Supabase Auth account creation are essential before contracts and invoices can exist.

## What Changes

- Add `/admin/tenants`, `/manager/tenants` pages: list, create (multi-step), detail, edit, history
- Add `TenantCard.vue`, `TenantForm.vue` (multi-step), `TenantSelect.vue`, `CCCDUpload.vue`, `TenantHistory.vue` components
- Add `useTenants()` composable with CRUD, invite, assignRoom, checkout
- Add server API routes: GET/POST `/api/tenants`, GET/PUT/DELETE `/api/tenants/[id]`, POST `/api/tenants/[id]/invite`, POST `/api/tenants/[id]/checkout`
- Add Zod schemas: `createTenantSchema`, `updateTenantSchema` with VN phone + CCCD validation
- Add `locales/vi/tenants.json` + `locales/en/tenants.json`

## Capabilities

### New Capabilities

- `tenants-crud`: Full CRUD for tenant profiles with multi-step check-in flow (info → room → services → contract trigger → meter reading)
- `tenant-invite`: Admin creates tenant in DB then invites via Supabase Auth email invite; tenant sets password on first login

### Modified Capabilities

*(none)*

## Impact

- `app/pages/admin/tenants/` and `app/pages/manager/tenants/` — new pages
- `app/components/features/tenant/` — new components
- `app/composables/useTenants.ts` — new composable
- `app/types/tenants.ts` — new types + Zod schemas
- `server/api/tenants/` — new API routes
- `locales/vi/tenants.json`, `locales/en/tenants.json`
- Supabase `tenants` table + Supabase Auth invite flow
- Depends on `phase1-rooms-module` (assign room)
