## 1. Atomic Invoice Transaction Contracts

- [x] 1.1 Create a Supabase CLI migration that makes issue replay idempotent by server operation key and preserves concurrent active-invoice invariants.
- [x] 1.2 Add service-only atomic void-with-audit, reissue-with-charges/link/audit, and adjustment-with-total-update/audit RPCs with stable locks, version checks, grants, and rollback notes.
- [x] 1.3 Add repository RPC mappings and normalized database-error mappings for stale, locked, paid, duplicate-replacement, and invalid-adjustment outcomes.
- [x] 1.4 Route direct invoice issue, void, reissue, and adjustment services through the shared transaction contracts while preserving capabilities and building scope.
- [x] 1.5 Add focused service/repository/SQL tests for rollback, replay, concurrency, version conflicts, audit atomicity, and correction correlation.

## 2. Authoritative Invoice Issue Planning

- [x] 2.1 Add strict AI issue tool/payload schemas and DTOs that exclude model-supplied totals and charge lines.
- [x] 2.2 Implement canonical invoice draft snapshot construction and hashing over period, targets, authoritative lines/totals, blockers, and existing invoice state.
- [x] 2.3 Implement `plan_invoice_issue` with scope/capability checks, blocker classification, exact normalized payload, and action-card preview.
- [x] 2.4 Add tests proving model totals are ignored, selected targets are exact, blocked drafts create no executable target, and canonical hashes are deterministic.

## 3. Invoice Correction Planning

- [x] 3.1 Add strict void, reissue, and paid-adjustment tool/payload schemas with bounded reason/amount fields and expected resource versions.
- [x] 3.2 Implement scoped `plan_void_invoice` with unpaid/open-period validation and authoritative before-state preview.
- [x] 3.3 Implement scoped `plan_reissue_invoice` using a fresh bound draft, active-replacement checks, and inherited correction correlation context.
- [x] 3.4 Implement scoped `plan_paid_invoice_adjustment` with before/after total, balance, and status preview and no implicit payment mutation.
- [x] 3.5 Add planner tests for out-of-scope hiding, payment-state strategy, closed periods, stale versions, invalid adjustments, and explicit payment guidance.

## 4. Confirmed Invoice Executors

- [x] 4.1 Implement issue executor revalidation and execution using the stored snapshot and plan idempotency key.
- [x] 4.2 Implement void, reissue, and paid-adjustment executors using only stored normalized payloads and confirmation-time state checks.
- [x] 4.3 Register invoice planners and executors in the deny-by-default policy with `billing.write` or `billing.corrections` as appropriate.
- [x] 4.4 Extend action-card presentation and system guidance for invoice financial previews without adding chat confirmation.
- [x] 4.5 Add executor/action tests proving stale plans write nothing, replay is idempotent, chat text cannot confirm, and correlation IDs survive composite correction steps.

## 5. Production Runtime Controls

- [x] 5.1 Add private runtime config for AI chat/read/planning/execution enablement, per-invoice-action switches, provider timeout, rate budgets, circuit threshold/cooldown, and retention-task enablement with production-safe defaults.
- [x] 5.2 Enforce server enablement before chat persistence/model calls and enforce current planning/execution switches inside tool construction and confirmation dispatch.
- [x] 5.3 Add distributed per-user chat/action rate limiting through bounded service-role database storage/RPC and normalized retry responses.
- [x] 5.4 Add provider abort timeout and bounded circuit breaker with correlated telemetry that excludes prompts, tool payloads, and secrets.
- [x] 5.5 Add a bounded Nitro retention task and daily schedule for `cleanup_expired_ai_conversations`, including rate-bucket cleanup and safe count/duration telemetry.
- [x] 5.6 Add focused runtime tests for disabled routes/tools/executors, rate limits, timeouts, circuit open/reset behavior, and cleanup retries.

## 6. Security and Rollout Verification

- [x] 6.1 Harden system guidance so stored business labels and conversation content are explicitly untrusted data while schemas/services remain the authorization boundary.
- [x] 6.2 Add prompt-injection regression tests for unregistered tools, policy override text, fabricated confirmations, out-of-scope identifiers, and model-supplied financial values.
- [x] 6.3 Add feature-flag rollout tests proving public UI visibility cannot enable private server behavior and invoice mutation can be killed independently.

## 7. Database Verification

- [x] 7.1 Have the migration applied to the linked project, regenerate `app/types/database.types.ts` from remote schema, and remove local CLI artifacts.
- [x] 7.2 Run focused invoice RPC contract checks and remote Supabase database lint at error level.

## 8. Documentation

- [x] 8.1 Update current architecture docs, including runtime configuration, feature flags, troubleshooting, and kill-switch operation.
- [x] 8.2 Update affected billing feature docs with implemented AI issue/correction flows and explicit payment limitations.
- [x] 8.3 Update auth/permission notes for invoice tool exposure where needed.
- [x] 8.4 Regenerate API inventory when routes change.
- [x] 8.5 Update project status and rollout state.
- [x] 8.6 Check docs against source before archive.

## 9. Final Verification

- [x] 9.1 Validate the active OpenSpec change and accepted specs.
- [x] 9.2 Run focused tests, `npm run typecheck`, full `npm test`, and `npm run lint`.
- [x] 9.3 Verify implementation, migration, tests, specs, security controls, and current-state docs are coherent and ready for archive.
