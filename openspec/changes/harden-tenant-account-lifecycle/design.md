## Context

Tenant identity spans Supabase Auth and `public.tenant_user_links`, so no single Postgres transaction can cover every lifecycle step. The current implementation assumes Auth hard-delete always succeeds and then removes the link even when the repository fell back to a ban. Tenant hard-delete also cascades the link without deleting the Auth identity. Separately, legacy RLS policies authorize managers by role alone instead of checking `user_building_assignments`.

The application uses service-role repositories and service-layer authorization; RLS remains the direct-Data-API safety net. Production schema changes are applied manually through Supabase Dashboard after migration review.

## Goals / Non-Goals

**Goals:**

- Make every account lifecycle outcome explicit, access-safe, and visible to operators.
- Prevent new Auth/link drift and provide an admin-only way to detect and reconcile existing orphan identities.
- Allow Auth hard deletion despite historical actor references while retaining audit-event snapshots.
- Restore building scope in direct-access RLS and align roommate support-request policy with server behavior.
- Preserve one-time credentials even when a secondary audit write fails.
- Finish portal pagination, profile whitelist enforcement, approval search, and mutation error feedback.

**Non-Goals:**

- Automatically delete the existing production orphan identities during migration.
- Deploy the migration or regenerate cloud database types without the manual production change-control step.
- Redesign the portal or internal design system.
- Guarantee immediate invalidation of an already-issued stateless access JWT; tenant data access is denied immediately through the live Auth/link checks, while the JWT expires according to Supabase Auth configuration.

## Decisions

### 1. Disable access before deleting identity

Revocation first sets the link to `disabled`, then attempts `auth.admin.deleteUser(id)`. This makes `resolveTenantId` deny portal data before any non-transactional Auth operation starts.

If hard-delete is blocked, the service uses Supabase Auth soft-delete rather than trying to remove metadata by omission or applying a long ban. Soft-delete is irreversible, releases the login identity while retaining the Auth row needed by remaining foreign keys, and returns the explicit outcome `deactivated`. The link is then removed explicitly because soft-delete does not fire the Auth-row delete cascade.

Alternative considered: retain the current ban fallback. Rejected because it does not free the email, leaves ambiguous metadata, and makes the UI claim an outcome that did not happen.

### 2. Preserve historical actors with nullable foreign keys

Historical `created_by`, `recorded_by`, `actor_id`, approval, close/reopen, and similar actor references become `ON DELETE SET NULL` where the column is historical attribution rather than resource ownership. Audit rows already carry action/entity/metadata snapshots, so history remains useful after actor deletion. Ownership and conversation tables that intentionally belong to an active user keep their existing cascade behavior.

Alternative considered: hard-delete all history. Rejected because billing and audit history must remain.

### 3. Treat account state as a join invariant

The account service joins tenant links with the complete Auth tenant-role set and exposes:

- `active` or `disabled` for a healthy linked account;
- `missing_auth` for a link whose Auth identity is absent;
- `orphaned` for a tenant-role Auth identity without a link.

Only admins see and reconcile orphan identities. Owners continue to see linked accounts inside their normal tenant scope. Reconciliation never guesses a tenant; it only deletes/soft-deletes the orphan Auth identity after explicit confirmation.

### 4. Make audit failures non-destructive to one-time results

Auth and Postgres cannot share a transaction. Provision/reset/revoke/status operations therefore complete their primary state transition, then append audit through a best-effort helper that emits a structured server error on failure. The API still returns the one-time credentials or actual revoke result, preventing lost credentials and misleading retries. Database-only multi-write paths continue using transaction/RPC patterns where already available.

Alternative considered: compensate every audit failure by undoing Auth changes. Rejected because password changes and Auth deletion cannot be safely or reliably reversed.

### 5. Enforce live tenant account state in tenant namespace

Tenant API namespace validation reads the current Auth account and requires a live `tenant` role before entering tenant routes. Domain services still require an active tenant link. This protects against stale JWT claims after soft-delete/role changes; an issued JWT may remain cryptographically valid until expiry but cannot resolve tenant business data.

### 6. Scope RLS through building assignments

Manager policies for tenants, contracts, occupants, and invoices require an active assignment to the row's building. Tenant scope through active `tenant_user_links` remains unchanged. Unneeded anonymous privileges and manager direct invoice mutation policies are removed; service-role APIs remain the supported write path.

The support-request insert policy accepts either the current primary tenant or a current roommate occupant and enforces active contract dates, matching the service resolver.

### 7. Preserve existing UI direction

UI changes reuse `UiAlert`, `UiStatusBadge`, `UiCombobox`, `UiButton`, and existing portal primitives. Account drift receives danger/warning status language and explicit action copy. Invoice pagination uses a restrained “load more” action with loading, completion, and error states. Legal identity stays visible but read-only in the tenant profile.

## Risks / Trade-offs

- **[Soft-delete behavior differs from hard-delete]** → Return a distinct result and test both branches; never claim that the Auth row was physically removed.
- **[Issued JWT remains valid until expiry]** → Require live Auth role plus active link for tenant APIs; document the residual Auth limitation and keep JWT expiry appropriately short.
- **[Changing actor FKs loses direct actor joins after deletion]** → Preserve actor snapshots in audit metadata and keep the actor column nullable.
- **[RLS changes can accidentally hide valid rows]** → Add SQL verification cases for admin, assigned manager, unassigned manager, primary tenant, roommate, and cross-tenant access.
- **[Best-effort audit can leave an audit gap]** → Emit structured error telemetry with action/entity/outcome and add tests ensuring the primary result is still returned.
- **[Auth user listing is paginated and potentially expensive]** → Reuse the existing paginated admin listing and restrict orphan reconciliation to admins.

## Migration Plan

1. Deploy application code that understands both old and new account outcomes.
2. Review and manually apply the migration in Supabase Dashboard.
3. Run included catalog, RLS, and orphan-detection verification queries.
4. Regenerate `app/types/database.types.ts` from the cloud project if generated types change.
5. Review detected production orphans in the admin UI and reconcile them individually.
6. Monitor Auth deletion, namespace denial, and audit-failure logs.

Rollback restores the previous RLS policies and foreign-key actions from the migration notes. Reconciled Auth soft-deletes are irreversible and are therefore never performed automatically by the migration.

## Open Questions

None. The implementation uses explicit soft-delete fallback and manual orphan reconciliation to avoid destructive assumptions.
