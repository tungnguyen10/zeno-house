## Context

Change 2 established scoped AI reads and a server-owned plan/confirm executor for opening billing periods. Meter operations still use direct PostgREST writes followed by separate audit inserts, PATCH has no version precondition, and utility overrides only check the closed-period state. The draft-grid read model already marks rows non-editable when a period is closed or a non-void invoice exists, so write paths currently permit states that the UI presents as locked.

This wave spans AI orchestration, meter and billing services, existing API clients, and Postgres transactions. The model must never become the parser or source of truth for pasted numeric data.

## Goals / Non-Goals

**Goals:**

- Parse a bounded tabular meter block deterministically from the stored current user message.
- Resolve every room inside one authorized building and classify preview rows as valid, warning, or blocker.
- Persist the exact previewed normalized meter payload and resource versions in an action plan.
- Route direct API and AI-confirmed meter writes through one atomic, lock-aware, audited transaction contract.
- Detect stale meter and override writes using `updated_at` preconditions.
- Expose server-computed billing drafts and deterministic explanations as a read tool.
- Plan and confirm utility-usage overrides through the same action lifecycle.

**Non-Goals:**

- OCR, spreadsheet-file upload, free-form locale guessing, fuzzy room matching, or model-generated numeric rows.
- Invoice issue, void/reissue, paid-invoice correction, production rollout controls, or retention scheduling; those remain Change 4.
- Replacing the existing billing calculator or changing charge formulas.
- Allowing chat text to confirm a mutation.

## Decisions

### 1. Parse the authoritative stored message, not tool arguments

`streamAiChat` will retain the `AiMessage` returned by `appendUserMessage` and pass its ID in the server-only tool context. `preview_meter_import` accepts building/month/date metadata but no array of readings and no raw pasted text. The planner reloads that owned message and applies a pure parser.

The parser accepts a header row plus tab, comma, or semicolon-delimited rows. Required columns are a room reference and at least one of electricity or water; documented English and Vietnamese header aliases are normalized. Decimal input uses `.` and values must be finite and non-negative. Blank cells mean “not supplied”, not zero. This constrained format is deterministic and testable; broader spreadsheet/OCR parsing is deferred.

Alternative considered: ask the model to reproduce the parsed rows in tool arguments. Rejected because it makes numeric integrity depend on token generation and can silently alter pasted data.

### 2. Preview is a server-owned normalized snapshot

Room references resolve by exact UUID, code, slug, or case-insensitive room number within the already resolved building. Unknown and ambiguous rooms, duplicate room/meter cells, malformed numbers, missing required columns, and active write locks are blockers. Missing optional utility cells and usage anomalies relative to the prior reading are warnings unless existing billing rules require a blocker.

If blockers exist, the tool returns the preview without creating an action. Otherwise it stores one `import_meter_readings` action whose payload contains UUID room IDs, meter types, period, reading date, values, and each row's expected `updated_at` (or explicit absence). The executor commits this payload without reparsing the conversation.

Alternative considered: store only a message reference and parse again on confirm. Rejected because preview and commit could diverge after parser or data changes.

### 3. One server-only RPC owns meter writes and audits

A service-role-only `save_meter_readings_with_audit` RPC will validate the full JSON payload before writes, lock affected period/reading rows in deterministic order, enforce building/room consistency, enforce period and active-invoice locks for monthly readings, compare expected versions, upsert all readings, and append `reading.saved` audits in one transaction. Any invalid or stale row aborts the entire batch.

`MeterReadingService.create`, `bulkCreate`, and `update` will normalize their input and use this RPC, so direct APIs and AI confirmation share the same domain rules. The service continues to own permission and building-scope checks; the RPC is revoked from `public`, `anon`, and `authenticated` and executable only by `service_role`.

Alternative considered: keep repository upserts and compensate when audit insertion fails. Rejected because compensation cannot provide transactional visibility or safe concurrency.

### 4. `updated_at` is the optimistic concurrency token

PATCH requests carry `expected_updated_at`. Bulk/direct services read current versions before calling the RPC; AI previews persist those same versions. The RPC compares versions while holding row locks. A row that appeared when absence was expected, disappeared, or changed returns a normalized conflict and writes nothing. Successful writes receive a new database timestamp.

This reuses existing columns and avoids a schema-wide integer-version migration. Timestamp comparison is performed by Postgres, not JavaScript formatting.

### 5. Write locks match the draft-grid contract

Monthly meter and utility-override mutations are rejected when the billing period is `closed` or when the affected room already has a non-void invoice in that period. The check lives in services and is repeated inside mutation RPCs to close time-of-check/time-of-use races. Reads and draft calculation remain available.

An issued period without an active invoice for the affected room is not treated as a blanket lock; the row-level invoice rule matches the current grid behavior. Change 4 will define correction orchestration for issued/paid invoices.

### 6. Draft explanation is deterministic and read-only

`calculate_billing_draft` calls the existing `BillingDraftService.calculateDraft` after scope and capability checks. A pure summarizer derives counts, totals, line groups, blockers, warnings, and next-step categories from the returned DTO. The model may explain that structured result, but does not calculate money or mutate draft state.

### 7. Utility override planning uses a dedicated atomic RPC

`plan_utility_usage_override` resolves the building, period, and room; validates the existing override and relevant readings; applies the same lock rules; and creates a `save_utility_usage_override` action. Its payload includes the complete normalized override and expected existing override version or absence.

`save_utility_usage_override_with_audit` performs the upsert and `utility_override.saved` audit atomically and returns a conflict for stale state. Existing direct save uses the same path. Delete and approval paths receive the same period/invoice lock checks; they are not exposed as AI actions in this wave.

### 8. Tool exposure remains deny-by-default

New tools are registered individually with existing capabilities:

- `preview_meter_import` and `plan_meter_reading_update`: `meter-readings.write`
- `calculate_billing_draft`: `billing.read`
- `plan_utility_usage_override`: `billing.write`

Only `import_meter_readings`, `update_meter_reading`, and `save_utility_usage_override` executors are added. The action-card confirm/cancel endpoints remain the sole mutation dispatch path.

## Risks / Trade-offs

- [Strict tabular grammar rejects messy paste] → Return line/column diagnostics and a short accepted-format example; do not guess numeric intent.
- [Large JSON RPC payload increases transaction time] → Retain the 500-reading validator bound, lock rows in stable order, and add rollback/concurrency tests.
- [Timestamp versions can be awkward for clients] → Return `updatedAt` in all reading/override DTOs and centralize precondition mapping in composables/services.
- [Service-role RPC bypasses RLS] → Keep authorization and scope checks in services, validate all building/room relationships again in SQL, revoke execution from browser roles, and run remote database lint.
- [Existing callers omit PATCH precondition] → Update all repository clients and tests in this change; return validation/conflict errors rather than silently overwriting.
- [Invoice state can change after preview] → Recheck period, invoice, and row versions inside the commit transaction and mark the AI plan stale on normalized optimistic conflicts.

## Migration Plan

1. Add the server-only meter and utility override RPCs with explicit revokes/grants and verification comments.
2. Generate remote database types after the user applies the migration.
3. Switch direct services and AI executors to the RPCs, then update clients to send version preconditions.
4. Add focused parser, planner, service, repository/RPC contract, concurrency, lock, and rollback tests.
5. Update current-state docs and API inventory only after implementation exists.
6. Run OpenSpec validation, focused tests, typecheck, full tests, lint, and remote database lint before archive.

Rollback keeps the additive RPCs harmless while application code is reverted. Drop the RPCs only after no deployed server references them; no table data migration is required.

## Open Questions

None. Invoice correction actions and broader import formats are intentionally deferred to Change 4 or a later dedicated change.
