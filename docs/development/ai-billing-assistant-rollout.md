# AI Billing Assistant Rollout

Use this runbook after deploying the additive AI hardening migration. The repository does not require a committed Supabase CLI dependency: apply the SQL through the project's configured cloud workflow or Supabase Dashboard, then run the read-only verification file.

## Environment

```env
NUXT_PUBLIC_AI_DEV_CHAT_ENABLED=true
NUXT_AI_PROVIDER=openrouter
NUXT_AI_OPENROUTER_API_KEY=...
NUXT_AI_MODEL=nvidia/nemotron-3-super-120b-a12b:free
NUXT_AI_MODEL_FALLBACK=google/gemma-4-31b-it:free
NUXT_AI_GLOBAL_DAILY_LIMIT=40

# Server rollout switches: start with all false in production.
NUXT_AI_CHAT_ENABLED=false
NUXT_AI_READ_TOOLS_ENABLED=false
NUXT_AI_MUTATION_PLANNING_ENABLED=false
NUXT_AI_MUTATION_EXECUTION_ENABLED=false
NUXT_AI_INVOICE_ISSUE_ENABLED=false
NUXT_AI_INVOICE_VOID_ENABLED=false
NUXT_AI_INVOICE_REISSUE_ENABLED=false
NUXT_AI_INVOICE_ADJUSTMENT_ENABLED=false
NUXT_AI_INVOICE_PAYMENT_ENABLED=false
```

`NUXT_PUBLIC_AI_DEV_CHAT_ENABLED` only renders the dashboard UI. `NUXT_AI_CHAT_ENABLED` authorizes the server route. Both models go through OpenRouter, so this configuration does not need `NUXT_AI_GOOGLE_API_KEY`.

## Release Gates

1. Run `npm run verify:ai-models`. It must find both exact `:free` IDs, zero prompt/completion pricing, and `tools` support.
2. Apply `supabase/migrations/20260802080015_harden_ai_billing_assistant_flow.sql`, then `supabase/migrations/20260803042715_add_ai_invoice_payments.sql`, to staging.
3. Run `supabase/verification/ai_billing_assistant_flow.sql` and `supabase/verification/ai_invoice_payments.sql` in the SQL editor. Every result marked `expect zero` must be empty; verify only `service_role` can execute the payment RPC.
4. Regenerate `app/types/database.types.ts` through the established cloud schema workflow after the migration is applied. Do not edit the generated file manually.
5. Run `openspec validate --specs`, the AI tests, `npm run typecheck`, `npm test`, and `npm run lint`.

## Staging Smoke

1. Enable UI, private chat, and read tools. Send a scoped read-only billing question and verify the terminal SSE model, stored metadata, and telemetry name the primary model with `fallbackUsed=false`.
2. Temporarily configure an unavailable free primary while keeping Gemma as fallback. Verify the request completes before streaming through Gemma and reports `fallbackUsed=true`. Restore the primary immediately.
3. Verify tenant and missing-role users are rejected. Verify owner/manager can see only assigned buildings and admin can use global scope.
4. Enable mutation planning only. Create an action card and confirm chat text cannot execute it.
5. Enable execution for one mutation class. Confirm with staging data, retry the succeeded card, and verify one domain result and one audit correlation.
6. Simulate a completion failure after the domain commit. Confirm during the lease must return retry timing; confirming after expiry must replay the same idempotent result and complete the plan.
7. Check OpenRouter usage is zero-cost and logs/telemetry contain no prompt, message body, raw tool payload, or secret.
8. Enable `NUXT_AI_INVOICE_PAYMENT_ENABLED` in staging and smoke-test one room, an explicit mixed room list, all unpaid rooms, missing building with multiple scoped buildings, a stale confirmation, and replay after a simulated completion failure. Verify full balances, one parent audit correlation, one child audit per payment, and no partial batch.

If catalog, privacy routing, RLS/grants, role scope, fallback, or idempotent recovery cannot be verified, keep the next flag disabled. Roll out in this order: UI + chat, read tools, mutation planning, mutation execution, then each invoice flag; enable `NUXT_AI_INVOICE_PAYMENT_ENABLED` only after its migration and payment smoke suite pass. During an incident, disable the affected invoice flag first, followed by execution, planning, and chat.
