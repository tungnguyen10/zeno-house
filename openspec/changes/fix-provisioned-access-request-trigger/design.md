## Context

The access-request trigger currently executes immediately after `auth.users` insertion and trusts `NEW.raw_app_meta_data`. Supabase Admin Auth creates the row first, then applies custom `app_metadata` later in the same database transaction, so an immediate trigger observes provider metadata but not the provisioned application role. The resulting request is private but appears in the admin approval queue despite the user already having access.

The migration must preserve self-registration and OAuth behavior, avoid deleting any request that has entered a decision lifecycle, keep audit history append-only, and remain compatible with Supabase-managed Auth writes.

## Goals / Non-Goals

**Goals:**

- Evaluate access-request eligibility against the final Auth user state in the creation transaction.
- Preserve exactly-one pending request behavior for unprovisioned email and OAuth users.
- Remove only untouched stale pending requests belonging to users with valid roles.
- Record a secret-free system reconciliation audit before stale request deletion.
- Reproduce the Supabase insert-then-update sequence in rollback-safe SQL verification.

**Non-Goals:**

- Changing approval, rejection, or pending-user APIs.
- Reopening rejected requests or reclaiming processing requests.
- Changing table shapes or generated database types.
- Deleting historical audit events.

## Decisions

### Defer the insert trigger and query current state

Replace the ordinary trigger with an `AFTER INSERT` constraint trigger that is `DEFERRABLE INITIALLY DEFERRED`. At deferred execution, the trigger function selects the current email, application metadata, and user metadata from `auth.users` by `NEW.id`; it does not make the role decision from the captured `NEW` tuple. This sees Supabase's later metadata update while keeping request creation in the same Auth transaction.

An application-side cleanup after `admin.createUser` was rejected because it is non-atomic and can fail independently. An `AFTER UPDATE` deletion trigger was rejected because approval intentionally writes a role while a request is processing and could delete a valid lifecycle row.

### Reconcile only untouched stale requests

The data correction targets `pending` requests with no claim token, reviewer, review timestamp, decision role, decision scope, tenant decision, or rejection reason, joined to Auth users whose current application role is one of `admin`, `owner`, `manager`, or `tenant`. Processing, approved, and rejected rows are excluded regardless of current Auth metadata.

The migration appends `user.access_request.reconciled` with a null actor to represent an explicit system actor, then deletes the same materialized target set. Metadata contains only the reason, current role, and access-request id.

### Keep the UI change copy-only

The shared audit action catalog gains the new action and the existing audit formatter maps it to “Đối soát yêu cầu truy cập”. No page structure, status styling, interaction, or API response changes.

## Risks / Trade-offs

- **Deferred trigger errors fail Auth creation at transaction end** → Keep the function minimal, schema-qualified, idempotent, and covered by rollback-safe SQL verification.
- **Cleanup could remove a legitimate request after an out-of-band role grant** → That request is stale because the user already has access; strict untouched predicates prevent removal after any decision work begins.
- **Managed Auth behavior may change** → Verification models both role-at-insert and role-updated-later cases and reads final persisted state rather than relying on a specific intermediate payload.
- **Production rollback cannot restore deleted stale rows automatically** → Reconciliation audits retain affected user and request identifiers; rollback restores the old trigger only if required, while data restoration remains an explicit operator action.

## Migration Plan

1. Apply the migration to staging in one transaction: replace the trigger function, replace the trigger, append reconciliation audits, and delete the targeted stale rows.
2. Run `supabase/verification/pending_account_approval.sql` and inspect that no untouched pending request belongs to a role-bearing Auth user.
3. Exercise application provisioning and public email/Google registration in staging.
4. Apply the same migration and verification to production.

## Open Questions

None.
