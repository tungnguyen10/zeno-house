## Context

Tenants are both DB records (`tenants` table with personal info) and Supabase Auth users (auth.users). The invite flow uses `supabase.auth.admin.inviteUserByEmail()` from the service-role client — this sends an email so the tenant can set their password. The `profiles` table (already exists from Phase 0) links auth.users to roles; tenants get `role = 'tenant'`.

## Goals / Non-Goals

**Goals:**
- Multi-step check-in form: personal info → CCCD upload → room selection → (services placeholder) → note for contract creation
- Invite tenant via Supabase email; tenant arrives at `/tenant/login` to set password
- `checkout()` flow: marks tenant inactive, frees the room, marks contracts as terminated
- CCCD upload stored in Supabase Storage (manual entry only; AI OCR is Phase 2 placeholder)

**Non-Goals:**
- AI-powered CCCD reading (Phase 2 — button exists but is disabled)
- Multiple tenants per room simultaneously
- Tenant self-registration (admin/manager always creates the account)

## Decisions

### 1. Two separate tables: `tenants` (personal info) and `profiles` (auth/role)

The `tenants` table stores: `full_name`, `phone`, `cccd`, `cccd_front_url`, `cccd_back_url`, `dob`, `address`, `profile_id` (FK to profiles). The `profiles` table has `role = 'tenant'`.

**Why**: Separates auth identity from personal/rental data. A tenant's auth account can exist before their personal info is complete.

### 2. Multi-step form is a client-side stepper, single API call

`TenantForm.vue` has 3 visible steps but submits all data at once on the final step. No partial saves mid-flow.

**Why**: Simpler — no draft state management, no partial record cleanup. Form state lives in component until final submit.

### 3. Invite via service-role API route

`POST /api/tenants/[id]/invite` uses `serverSupabaseServiceRole` to call `supabase.auth.admin.inviteUserByEmail()` with `redirectTo: '/tenant/login'`.

**Why**: Invite requires service-role; must not be called from client.

### 4. CCCDUpload component stores images in Supabase Storage

`CCCDUpload.vue` calls `POST /api/upload/cccd` which stores in `storage/cccd/` bucket and returns public URL. The URL is stored in `tenants.cccd_front_url`.

**Why**: Keeps blob out of DB; Supabase Storage has built-in access control.

### 5. Checkout sets room status to `available`

`POST /api/tenants/[id]/checkout` terminates active contracts and sets `rooms.status = 'available'` in a single transaction.

**Why**: Atomicity — room shouldn't be freed if contract termination fails.

## Risks / Trade-offs

- **Invite email deliverability** → Supabase dev/staging email limits. Mitigation: configure custom SMTP in Supabase settings.
- **CCCD Storage bucket security** → Must be private with signed URLs for access. Mitigation: migration creates private bucket with RLS policy.
- **Step 3 "services"** → Services module doesn't exist in Phase 1. The step renders a "coming soon" placeholder.

## Open Questions

- Should checking out a tenant also delete their auth.users entry? → No. Keep account so audit trail is preserved; just mark profile inactive.
