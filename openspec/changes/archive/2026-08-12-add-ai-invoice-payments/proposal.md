## Why

The AI Billing Assistant can issue and correct invoices but cannot safely record collections, forcing operators to leave the chat workflow for a common billing task. Recording one or many full-balance payments needs the same scoped, previewed, confirmed, atomic, and replay-safe guarantees as the existing financial actions.

## What Changes

- Add a server-authoritative AI planner for one room, an explicit room list, or all unpaid rooms in one building and billing period.
- Classify requested rooms before planning and include only eligible issued invoices while clearly reporting paid, missing, invalid, and blocked rows.
- Add a confirmed `record_invoice_payments` action that revalidates its snapshot and records the eligible batch atomically and idempotently.
- Add a dedicated service-role-only Supabase RPC that locks and validates the complete batch before recording full remaining balances and correlated audits.
- Add a production-default-off invoice-payment kill switch, payment-specific action-card preview, and success/replay toasts.
- Document the assistant guidance, environment configuration, verification, and staged rollout.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-invoice-operations`: Extend AI invoice operations with scoped payment planning, confirmation-time snapshot validation, and atomic idempotent batch collection.

## Impact

This affects the AI tool registry, invoice-payment planner and executor services, billing repositories, Nuxt runtime configuration, the AI action card/composable, Supabase migrations and verification SQL, AI tests, and AI billing documentation. It adds no new package dependency and does not expose database access to the browser.
