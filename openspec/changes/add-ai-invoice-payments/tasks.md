## 1. Tool Contract And Runtime Policy

- [x] 1.1 Add failing schema and policy tests for bounded room/all-unpaid selection, paired period fields, forbidden model authority, capability exposure, and payment kill switches.
- [x] 1.2 Implement the strict payment planner input contract, tool registry entry, prompt guidance, and production-default-off runtime flag.

## 2. Scoped Payment Planning

- [x] 2.1 Add failing planner tests for building clarification, exact room resolution, period selection, classification, all-unpaid selection, default method, and message-derived date.
- [x] 2.2 Implement repository queries and the server-authoritative payment planner, canonical snapshot, preview warnings, and action-plan creation.

## 3. Atomic Payment Execution

- [x] 3.1 Add failing executor and SQL contract tests for capability/scope, stale snapshots, transaction rollback, stable locks, full locked balances, grants, audit correlation, and idempotent replay.
- [x] 3.2 Generate an additive Supabase migration with the CLI and implement the service-role-only `record_ai_invoice_payments_with_audit` RPC plus verification SQL.
- [x] 3.3 Implement the payment repository/service adapter and `record_invoice_payments` executor with normalized conflict/failure mapping.

## 4. Action Card And Confirmation Feedback

- [x] 4.1 Add failing component/composable tests for single/batch previews, skipped warnings, success/replay toasts, and no success toast on errors.
- [x] 4.2 Implement the payment-specific action-card presentation and confirmation toast behavior using existing Zeno House UI primitives.

## 5. Documentation And Verification

- [x] 5.1 Update accepted AI invoice requirements, architecture, user guidance, rollout configuration, and local environment example without editing generated database types.
- [x] 5.2 Run focused AI/payment/UI tests and SQL contract checks, then validate OpenSpec, typecheck, full tests, and lint.
- [x] 5.3 Review the final diff for role/scope isolation, financial confirmation safety, atomicity, idempotency, and unrelated changes.
