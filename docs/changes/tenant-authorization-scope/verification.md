---
type: Verification Record
title: "ZH-SEC-01 — cleanup verification checkpoint"
status: draft
change_state: verification-pending
tags: [change, security, tenants, verification]
---

# ZH-SEC-01 — verification checkpoint (2026-11-10)

## Supported by current evidence

- Implementation exists for shared tenant authorization (`server/services/tenants/authorization.ts`), scoped status RPC migration (`supabase/migrations/20261105032920_tenant_scoped_bulk_status.sql`), service/UI redaction and related tests.
- The implementation plan's 2026-11-05 execution record reported `npm run typecheck` passing, 354 files / 2,022 tests passing and lint with zero errors. This is **historical**, not a test run performed here.
- The archived [production verification record](../../history/2026-11-09-harden-tenant-identity-data/verification.md) reports that `tenant_scoped_bulk_status.sql` executed successfully on the linked production DB on 2026-11-09, including eleven top-level assertion groups.
- Current `app/types/database.types.ts` contains the `bulk_tenant_status_action` function type; the repo's `develop` CI at `999dc929` passed.

## Still open before archive

- [ ] Independently review the effective authorization matrix and XLSX export scope with signed-off acceptance cases, including admin/owner/manager, primary/roommate, full/basic/none and transferred tenants.
- [ ] Execute and record authenticated desktop/mobile tenant flow QA (basic read-only states, denied edit/portal, bulk failure reasons and multi-building export). A prior implementation plan explicitly left visual inspection open.
- [ ] Confirm application deployment and runtime behavior in the intended environment; the 2026-11-09 record proves SQL behavior but does not itself prove app deployment.
- [ ] Attach final verification evidence/results to this change, reconcile the execution plan's stale rollout notes and archive only when gates pass.

Do **not** rerun production mutation/migration as a documentation-cleanup step. The historical unchecked implementation checkboxes remain original TDD steps; they are not evidence of unfinished source work and must not be mass-checked without verification.
