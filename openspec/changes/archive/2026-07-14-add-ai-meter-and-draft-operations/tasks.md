## 1. Deterministic Meter Import Domain

- [x] 1.1 Add shared AI meter-import schemas and DTOs that exclude raw paste and model-supplied reading arrays from tool inputs.
- [x] 1.2 Implement the pure delimited-message parser with header aliases, bounded rows, exact numeric validation, and line diagnostics.
- [x] 1.3 Add scoped exact room resolution and preview classification for valid rows, warnings, blockers, duplicates, and billing locks.
- [x] 1.4 Add focused parser and preview tests proving numeric fidelity and that blocked previews create no action.

## 2. Transactional Meter Write Contract

- [x] 2.1 Create a Supabase migration through the CLI for the server-only atomic meter-save-and-audit RPC with stable locks, version checks, period/invoice locks, grants, and rollback notes.
- [x] 2.2 Add repository RPC mapping and normalized database-error mapping for locked and optimistic-conflict outcomes.
- [x] 2.3 Route meter create, bulk create, and update services through the atomic RPC while preserving permission, scope, handover, and conflict-key behavior.
- [x] 2.4 Require and propagate `expected_updated_at` for PATCH callers and update affected composables/components/tests.
- [x] 2.5 Add service/repository tests for all-or-nothing bulk writes, atomic audits, direct-API locks, idempotent upserts, and concurrent update conflicts.

## 3. AI Meter Operations

- [x] 3.1 Retain the stored current user-message ID in server-only AI tool context and reload it through ownership-checked conversation services.
- [x] 3.2 Implement `preview_meter_import` and `plan_meter_reading_update` planners that store exact normalized payloads and resource versions.
- [x] 3.3 Register `import_meter_readings` and `update_meter_reading` executors with confirmation-time scope, lock, and version revalidation.
- [x] 3.4 Register the new tools and executors in the deny-by-default policy and update the system prompt/action-card presentation without adding chat confirmation.
- [x] 3.5 Add AI tests proving the model cannot supply numeric paste, preview and commit payloads match, foreign messages are hidden, and stale plans write nothing.

## 4. Billing Draft Explanation

- [x] 4.1 Implement a pure draft summarizer over existing billing draft DTOs with authoritative totals, warning/blocker groups, and next-step categories.
- [x] 4.2 Register the scoped read-only `calculate_billing_draft` tool using the existing draft service and `billing.read` capability.
- [x] 4.3 Add deterministic summarizer and tool-policy tests, including blocked drafts and denial without capability.

## 5. Utility Usage Override Operations

- [x] 5.1 Extend the Supabase migration with a server-only atomic utility-override-save-and-audit RPC using expected version/absence and period/invoice locks.
- [x] 5.2 Route direct override save through the RPC and enforce matching locks on save/delete/approve service paths.
- [x] 5.3 Implement and register `plan_utility_usage_override` plus the confirmed `save_utility_usage_override` executor using the exact stored payload.
- [x] 5.4 Add direct-service and AI tests for atomic audit persistence, stale versions, active-invoice/closed-period rejection, and confirmation-only execution.

## 6. Database Verification

- [x] 6.1 Have the migration applied to the linked project, regenerate `app/types/database.types.ts` from remote schema, and remove local CLI artifacts.
- [x] 6.2 Run focused RPC contract checks and remote Supabase database lint at error level.

## 7. Documentation

- [x] 7.1 Update current architecture docs.
- [x] 7.2 Update affected feature docs.
- [x] 7.3 Regenerate API inventory when routes change.
- [x] 7.4 Update project status and rollout state.
- [x] 7.5 Check docs against source before archive.

## 8. Final Verification

- [x] 8.1 Validate the active OpenSpec change and accepted specs.
- [x] 8.2 Run focused tests, `npm run typecheck`, full `npm test`, and `npm run lint`.
- [x] 8.3 Verify implementation, migration, tests, specs, and current-state docs are coherent and ready for archive.
