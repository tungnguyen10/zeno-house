## 1. Transactional period opening

- [x] 1.1 Add an additive, service-role-only Supabase RPC that atomically opens-or-gets a billing period and writes exactly one `period.opened` audit event
- [x] 1.2 Apply the migration, regenerate database types, and switch the billing period repository/service to the typed transactional result

## 2. Scoped building resolution

- [x] 2.1 Add repository queries and an AI building resolver for scoped UUID, slug, and exact case-insensitive name matches with ambiguity results
- [x] 2.2 Add safe scoped building summaries and adapt meter-status reads to resolve a natural building reference without out-of-scope disclosure

## 3. AI plan and executor

- [x] 3.1 Add validators and a capability-filtered `list_buildings` plus `plan_open_billing_period` tool with structured clarification/existing/planned results
- [x] 3.2 Create period action plans with normalized UUID/month payload, preview, resource version, server idempotency, and no chat-time mutation
- [x] 3.3 Register only the `open_billing_period` executor, revalidate building version/scope/capability, and return durable created-or-existing results

## 4. Verification coverage

- [x] 4.1 Add migration/RPC tests for grants, atomic audit, existing-period replay, audit rollback, and concurrent unique-key handling
- [x] 4.2 Add resolver/tool tests for scope filtering, UUID/slug/name resolution, ambiguity, not-found equivalence, and read-tool behavior
- [x] 4.3 Add planner/executor/action tests for no mutation before confirm, stale building conflicts, direct confirmation, replay, cancellation, and concurrent claims

## 5. Focused integration checks

- [x] 5.1 Verify existing direct period opening now uses the atomic repository path without regressing permissions, scope, or response DTOs
- [x] 5.2 Run focused AI/billing/security tests and resolve all failures before documenting the behavior

## 6. Documentation

- [x] 6.1 Update current architecture docs
- [x] 6.2 Update affected feature docs
- [x] 6.3 Regenerate API inventory when routes change
- [x] 6.4 Update project status and rollout state
- [x] 6.5 Check docs against source, run OpenSpec/typecheck/full-test/lint/database gates, verify the change, and archive only when all pass
