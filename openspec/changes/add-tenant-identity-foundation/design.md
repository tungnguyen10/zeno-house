## Context

`harden-role-namespace-routing` established `/portal` vs `/dashboard` namespaces, a single `getRedirectByRole`, and a no-op server namespace guard. Internal roles are `admin | owner | manager`, all resolved from `app_metadata.role`. Business data flows through `server/api/** → service → repository → Supabase` using the service-role client (RLS bypassed server-side), so services are the authoritative gate. The `tenants` table holds business records but has no link to a login identity.

This change introduces the tenant identity primitives. It deliberately ships no tenant-facing API surface or UI — only the role, capabilities, linkage, self-scope resolver, RLS baseline, and activation of the API namespace guard.

## Goals / Non-Goals

**Goals:**
- Add an isolated `tenant` role and capability set.
- Add a durable `auth.users ↔ tenants` link with uniqueness/status.
- Provide `resolveTenantId(event, user)` that never trusts client-supplied identifiers.
- Establish a deny-by-default RLS baseline for tenant-readable tables.
- Activate server-side API namespace separation for the tenant role.

**Non-Goals:**
- Tenant self-service endpoints (`/api/tenant/**`) — next change.
- Tenant portal UI, PWA, documents, or support requests.
- Tenant self-signup. Accounts are provisioned by a controlled path.
- Changing internal role/capability behavior.

## Decisions

### D1 — `tenant` is not app-creatable via internal user management

`CREATABLE_ROLES` stays `owner | manager`. Tenant login accounts and their `app_metadata.role = 'tenant'` are set only through a controlled service-role path (admin action or Edge Function), never through the client and never through the existing user-management APIs. This keeps authorization claims outside user-editable metadata.

### D2 — Explicit linkage table `tenant_user_links`

```text
tenant_user_links(
  id            uuid pk,
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  status        text not null default 'active',   -- active | disabled
  created_at    timestamptz default now()
)
unique(auth_user_id)         -- one login maps to one tenant (MVP)
unique(tenant_id)            -- one tenant maps to one login (MVP; revisit for co-tenants)
```

RLS enabled; the service-role path manages rows. A tenant may self-select only their own link row if a direct read path is ever needed.

### D3 — `resolveTenantId` is the only tenant-scope entry point

```ts
// server/utils/scope.ts
export async function resolveTenantId(event, user): Promise<string> {
  // reads tenant_user_links by user.id; throws FORBIDDEN/NOT_FOUND if absent or disabled
}
```

Tenant APIs (next change) MUST derive `tenant_id` from this resolver and MUST ignore any client-supplied `tenant_id`. This is separate from `getAssignedBuildingIds`/`assertBuildingScope`, which remain owner/manager building scope.

### D4 — RLS baseline is deny-by-default

Tenant-readable tables (`tenants`, `contracts`, `invoices`) get explicit tenant self-select policies scoped through `tenant_user_links` only where a direct authenticated read is intended. Everything else stays denied for the tenant role. The server remains the primary gate; RLS is the non-bypassable safety net.

### D5 — Activate the API namespace guard

The server hook from the previous change becomes active: a `tenant`-role JWT hitting internal `/api/**` (non-tenant namespace) is rejected, and internal roles hitting `/api/tenant/**` are rejected. Unknown/out-of-scope share a consistent not-found/forbidden response.
