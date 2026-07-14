## Why

The accepted AI foundation can read billing context and enforce a server-owned action lifecycle, but it cannot yet resolve a naturally named building or perform the first monthly billing operation. This change adds the narrowest useful mutation—opening a billing period—through the accepted plan/confirm contract while fixing the existing period-create/audit split so retries and races remain safe.

## What Changes

- Resolve a building reference by scoped UUID, slug, or exact natural name without revealing buildings outside the authenticated user's scope.
- Add a scoped building-list tool and allow meter-status reads to use the resolved building reference.
- Add `plan_open_billing_period`, which creates a server-owned pending action plan and never opens a period during chat generation.
- Register an `open_billing_period` action executor reached only through the direct confirm endpoint.
- Revalidate capability, building scope, building version, period state, and action expiry at confirmation time.
- Replace separate period insert and audit writes with one idempotent database operation that handles concurrent opens and writes exactly one audit event when it creates a period.
- Return a prior/existing period on retries without creating duplicate periods or audit rows.
- Add focused security, ambiguity, planning, executor, transaction, replay, and concurrency tests.
- Update current-state AI and billing docs only after the behavior exists.

## Capabilities

### New Capabilities

- `ai-billing-period-operations`: Scoped building discovery/resolution and plan-confirm opening of a monthly billing period through the AI assistant.

### Modified Capabilities

- `billing-api`: Make open-or-get period creation and its `period.opened` audit event one idempotent transactional operation for all callers.

## Impact

- AI validators, tool policy, planners, executor registry, action lifecycle, and tests.
- Building repository/service queries used for scope-safe exact reference resolution.
- Billing period service/repository and a new additive Supabase RPC migration.
- Generated Supabase database types after the migration is applied.
- `docs/architecture/ai-agent.md`, `docs/features/billing.md`, `docs/project-status.md`, and API inventory only if handlers change.
