## Context

Contracts currently store only the latest commercial terms. The tenant room page exposes those flat fields as an “adjustment” and also exposes `contracts.notes`, even though the internal form defines that value as an operator note. Billing, contract detail, renewals, and the tenant portal all read the current `contracts` row, so replacing it with a fully temporal read model would require a risky cross-domain rewrite.

The amendment model must preserve legal history, support a future effective date, keep issued invoices immutable, and work with service-role repositories plus service-layer authorization. Production scheduling already uses Supabase `pg_cron`/`pg_net` to wake private Nitro workers.

## Goals / Non-Goals

**Goals:**

- Represent contract amendments as durable, structured, auditable records.
- Schedule at most one future amendment per contract and apply it automatically and idempotently.
- Preserve `contracts` as the current effective snapshot consumed by billing and existing UI.
- Expose published amendment history only to the primary tenant while keeping roommates on effective terms only.
- Remove internal contract notes from tenant-facing data and resolve inherited payment due days accurately.

**Non-Goals:**

- PDF generation or upload, tenant acknowledgement, consent, or electronic signatures.
- Retroactive amendments, mid-month proration, multiple simultaneously scheduled amendments, or arbitrary contract-field changes.
- Recomputing or modifying issued invoice snapshots.

## Decisions

### Store a strict change set plus immutable snapshots

`contract_amendments.changes` is JSONB validated at the API and database boundaries. Allowed keys are `monthly_rent`, `deposit`, `payment_due_day`, `occupant_count`, `discount_amount`, and `surcharge_amount`. A missing key means unchanged; `payment_due_day: null` explicitly restores building inheritance. Publication stores full `before_terms` and `after_terms` snapshots so later reads never reinterpret the amendment against a changed contract.

Typed nullable columns were rejected because they cannot distinguish an omitted change from an explicit null due-day override. A generic unvalidated JSON document was rejected because it would allow unsupported contract mutations.

### Materialize effective terms onto contracts

An idempotent security-invoker RPC locks the amendment and contract, applies the snapshotted `after_terms`, marks the amendment `applied`, and appends correlated amendment and contract audit events in one transaction. Publishing an amendment effective today uses the same transaction; future amendments become `scheduled`.

Read-time overlays were rejected because every billing and operational consumer would need temporal awareness. Manual application was rejected because delayed operator action could make billing use stale terms.

### Use the scheduler as wake-up, not correctness authority

Supabase Cron calls a private Nitro endpoint with a Vault-backed secret. The endpoint invokes the idempotent RPC for due amendments. Billing draft preparation invokes the same due-application service before loading mutable contract terms, so a delayed cron wake-up cannot cause a draft to use stale terms.

### Bound v1 lifecycle and conflicts

Drafts are editable/deletable with `expectedUpdatedAt`. Published amendments are immutable. A partial unique index permits only one `scheduled` amendment per contract. Financially relevant changes, including occupant count because it affects per-person billing, require the first day of a month. Publication rejects inactive contracts, dates before publication or after contract end, and effective months with an existing non-void invoice.

Renewal and termination cancel a scheduled amendment with a system reason from a contract-table trigger, so cancellation and the lifecycle mutation commit or roll back together. Contract deletion uses the same database guard to reject published history and atomically audit/remove drafts. Corrections use a new amendment rather than rewriting history. Draft create/update/delete RPCs also commit their audit event in the same transaction, and one failed due row is isolated from the rest of an apply batch.

### Keep tenant disclosure explicit

The portal contract DTO contains effective terms and `paymentDueDaySource: contract | building | unset`; it never contains internal contract notes. The bootstrap includes scheduled/applied amendment summaries only when `assignmentRole = primary`. A roommate receives current applied terms but an empty amendment list.

## Risks / Trade-offs

- **Scheduler delay** → use an idempotent worker, retryable cron wake-ups, and a billing pre-draft safety call.
- **Publish/apply race** → lock amendment and contract rows and use status/version predicates inside RPCs.
- **Invoice inconsistency** → reject publication when a non-void invoice already exists for the effective month and never mutate invoice snapshots.
- **Active audit hardening overlap** → reuse the repository's current transactional audit shape and keep amendment actions correlated with the resulting contract update.
- **Cloud schema drift** → apply the migration manually, regenerate database types from the configured project, and run SQL verification plus advisors before enabling cron.

## Migration Plan

1. Apply the additive table/RPC/audit-constraint migration in the Supabase Dashboard.
2. Regenerate `app/types/database.types.ts` from the configured cloud project; do not hand-edit it before generation.
3. Deploy server APIs and the disabled worker endpoint, then run amendment SQL and API staging verification.
4. Configure the worker secret and schedule URL in Supabase Vault and install the cron wake-up.
5. Enable the schedule only after idempotency, audit, portal-scope, and billing safety checks pass.

Rollback disables the cron job and worker first. The additive table remains for retained history; application code can be rolled back without dropping applied audit evidence. An applied amendment is corrected through a new amendment, never by reverting stored history.

## Open Questions

None for v1.
