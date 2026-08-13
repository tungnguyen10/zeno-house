## 1. Database safety

- [x] 1.1 Add a reviewable Supabase migration for historical Auth-user foreign keys, manager building-scoped RLS, least-privilege grants, and roommate support-request RLS
- [x] 1.2 Add migration verification queries and document production apply/rollback/orphan-review steps

## 2. Auth and tenant account lifecycle

- [x] 2.1 Extend Auth user repository models with current deletion/soft-deletion state and reliable metadata clearing
- [x] 2.2 Implement disable-first hard-delete with soft-delete fallback and explicit `deleted`/`deactivated` outcomes
- [x] 2.3 Add best-effort lifecycle audit telemetry so successful credentials and actual outcomes are not discarded
- [x] 2.4 Add admin-only orphan detection and reconciliation repository/service/API paths
- [x] 2.5 Enforce live Auth tenant role in the tenant API namespace
- [x] 2.6 Block tenant hard-delete while a portal account link exists

## 3. Tenant portal and approval behavior

- [x] 3.1 Enforce the tenant self-service profile whitelist and render legal identity as read-only
- [x] 3.2 Add paginated invoice loading with refresh/reset, completion, loading, and error states
- [x] 3.3 Replace the fixed tenant approval list with server-backed searchable selection
- [x] 3.4 Attribute access-request creation audit to the requester/system rather than the first viewer

## 4. Account management UI

- [x] 4.1 Expose linked, missing-Auth, orphaned, deleted, and deactivated account outcomes through DTOs and composables
- [x] 4.2 Update tenant account settings with truthful revoke copy, drift states, admin reconciliation, and credential cleanup
- [x] 4.3 Complete focused responsive, keyboard, disabled, in-flight, success, and error-state polish

## 5. Verification and documentation

- [x] 5.1 Add lifecycle, orphan, tenant-delete, namespace, RLS-policy, profile, pagination, approval-search, and audit-attribution tests
- [x] 5.2 Update accepted specs and architecture/API documentation
- [x] 5.3 Run OpenSpec validation, narrow tests, typecheck, full tests, lint, and review the final diff
