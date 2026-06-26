## Context

Billing currently works end to end, but several surfaces do not use the same source of truth. Draft and draft-grid logic are contract/pricing-aware, while period list and overview still derive reading progress from occupied rooms. Display enrichment resolves tenants, rooms, contracts, periods, and invoices, but actor resolution currently does not load user display data. Issue and close UI components emit parent mutations but close local state immediately because Vue emits are not awaitable.

This change tightens correctness and trust before any broader refactor or transaction hardening work.

## Goals / Non-Goals

**Goals:**
- Make billable contract selection shared and testable.
- Make required reading progress shared and pricing-aware.
- Resolve billing actors and payment recorders to user-facing display values.
- Keep issue/close modal state accurate until server mutations complete.
- Add regression tests around these correctness boundaries.

**Non-Goals:**
- No draft-grid structural refactor.
- No financial transaction/RPC hardening.
- No schema change unless actor names cannot be resolved from existing user/profile data.
- No new billing workflow or status.

## Decisions

### D1 - Shared Billing Eligibility Helper

Create a server-side helper for "billable contracts in period" that accepts building id, period year/month, and optional dependency functions. It should select contracts whose date range overlaps the period and whose status is billable for monthly invoices.

The first implementation should use the status semantics already established by contracts. If there is ambiguity around `expired` or `renewed`, encode the rule in tests before wiring the helper into services.

Alternative considered: keep duplicated Supabase filters in each service. Rejected because drift already exists between draft, overview, and period list.

### D2 - Shared Required Reading Progress Helper

Create a helper that computes required readings from billable contracts and pricing rules:
- electricity requires a reading only when electricity pricing is meter-based (`per_kwh`);
- water requires a reading only when water pricing is meter-based (`per_m3`);
- fixed and per-person pricing do not require current meter entry;
- utility overrides count as complete for the corresponding room/meter.

Use this helper in period list summaries, workspace overview, and draft-grid totals where possible.

Alternative considered: have the grid remain authoritative and let list/overview stay approximate. Rejected because the work queue must be trustworthy.

### D3 - Actor Display Resolution

Extend `BillingDisplayResolver.loadActors()` to load display data from the app's existing user source. Preferred lookup order:
1. local app profile/user table if one exists;
2. a server-side Supabase Admin/auth lookup if supported in the current server environment;
3. safe fallback `{ name: null, email: null }`.

Do not snapshot actor names in billing audit rows in this change. Snapshotting is a separate data-model decision.

### D4 - Async Action Ownership At Parent Boundary

Move issue/close submit ownership to the page or pass explicit async callback props into the child components. The child should only close modal/clear selection after the callback resolves. On rejection, it should keep state visible and show the error.

Alternative considered: keep `emit` and rely on toast in the parent. Rejected because local UI state currently lies about success.

## Risks / Trade-offs

- [Contract status ambiguity] -> Mitigation: add focused tests for every status included/excluded by the billable helper.
- [Actor source unavailable] -> Mitigation: keep safe fallback and document whether a follow-up profile table is needed.
- [More shared helpers can become too broad] -> Mitigation: keep helpers focused on billing period eligibility and reading progress only.
- [Changing queue metrics may surprise users] -> Mitigation: update docs and verify with realistic buildings where water is fixed/per-person.

## Migration Plan

1. Add shared helpers with unit tests.
2. Wire helpers into period list, overview, draft, and grid.
3. Fix actor resolver and DTO enrichment tests.
4. Fix issue/close async action state.
5. Run billing tests, component tests, lint, and typecheck.

Rollback is code-only unless actor resolution requires a new data source. If a schema/data source change is discovered, split it into a separate proposal before implementation.

## Open Questions

- Which user/profile source should actor resolution prefer in production?
- Are `expired` contracts ever intentionally billed for a period they overlap, or should only `active` and specific renewal states be billable?
