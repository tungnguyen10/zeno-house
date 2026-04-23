## Context

Tenant portal uses the `tenant.vue` layout (bottom navigation). Tenants access the system after accepting an invite and setting a password. Their `profile_id` links to `tenants` table. The portal is mobile-first.

## Goals / Non-Goals

**Goals:**
- Dashboard: room info card, active contract summary (days remaining), unpaid invoice count (stub = 0), quick action buttons
- Contract view: read-only rendered HTML (`content_html`), disabled PDF button
- Maintenance: create request (title, description, priority, up to 3 photos), view own request list + status
- Profile: view/edit personal info, change password
- Mobile-first with bottom navigation from tenant layout

**Non-Goals:**
- Invoice payment (Phase 2)
- Real-time chat with manager
- Document upload by tenant
- Viewing other tenants' data

## Decisions

### 1. Dedicated `/api/tenant/me/*` routes instead of reusing admin routes

Tenant portal calls `GET /api/tenant/me/room` and `GET /api/tenant/me/contract` — separate from `/api/rooms/[id]`.

**Why**: These routes fetch data scoped to the authenticated tenant without requiring the tenant to know their own IDs. Simpler and more secure.

### 2. Dashboard uses `useTenantDashboard()` composable (portal-specific)

Fetches room + contract + pending invoices count in parallel via `Promise.all`.

**Why**: Dashboard needs multiple data sources; a single composable keeps the page thin.

### 3. Maintenance form submits to `POST /api/maintenance` (shared with admin module)

Tenant maintenance form uses the same API as the admin Maintenance module. Photos are uploaded to Supabase Storage.

**Why**: Single source of truth for maintenance records; admin and tenant write to the same table.

### 4. Profile edit updates `profiles` + `tenants` tables

`PATCH /api/tenant/me/profile` updates `profiles.full_name` and `tenants` (phone, address). Password change calls Supabase Auth client-side.

**Why**: Two tables need updating; handled in a single server route for atomicity.

### 5. Invoice page is an explicit stub

`/tenant/invoices` renders a `UEmptyState` with message "Tính năng đang phát triển" and a Phase 2 indicator.

**Why**: Bottom nav includes Invoices; the page must exist to avoid 404. Placeholder is better than hiding the nav item.

## Risks / Trade-offs

- **Photos in maintenance requests** → S3/Storage upload on mobile can be slow. Mitigation: show upload progress; limit to 3 images, 5MB each.
- **Contract HTML rendering** → `content_html` rendered with `v-html` requires sanitization. Mitigation: use DOMPurify before render.

## Open Questions

- Should tenants be able to edit their own profile photo? → Not in Phase 1; avatar from Supabase Auth initials only.
