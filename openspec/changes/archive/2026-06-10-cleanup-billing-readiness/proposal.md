## Why

Monthly billing is the primary recurring workflow for a property manager, but the current product surface is not ready to support it cleanly. The codebase already has most billing inputs: building rates and schedules, active contracts, contract services, occupancy count, handover readings, and monthly meter readings. However, several pieces are either misleading, inconsistent with the architecture, or not reliable enough to become billing sources of truth.

The main issue is not missing UI polish. It is that billing-related work is currently spread across Building detail, Room detail, Contract detail, and a placeholder `/billing` route. Before building the Monthly Billing Workspace, the foundation should be cleaned so each domain has clear ownership and billing can compute from trustworthy data.

## What Changes

- **Clean OpenSpec drift** around meter devices, room assignments, room-centric meter readings, and billing workspace ownership
- **Fix contract billing readiness** by persisting `payment_day`, removing invalid `building_id` fallback behavior, and tightening contract lifecycle side effects
- **Close room status full-lifecycle sync gap** so `ContractService.update()` claims/releases rooms in both directions (active ↔ inactive) and on room reassignment, not only when an active contract becomes inactive
- **Establish room as the single source of truth for monthly rent** so the contract form prefills from the room, the backend falls back to the room's rent when input is zero (or refuses with 409 when both are zero), and the room detail page surfaces the active contract's rent as the effective price
- **Make renewal log integrity transactional** so `contract_renewals` rows are inserted before mutating the contract and rolled back on failure, fixing the regression where `renewal_count` could be bumped without a matching log row
- **Normalize server auth** so `requireAuth()` derives `user.id` from the JWT `sub` claim (Supabase `serverSupabaseUser` returns claims, not a `User`), fixing the latent bug where `created_by` was silently `undefined`
- **Clarify room/utility boundaries** so monthly readings are treated as workspace inputs, not a room-detail workflow
- **Clarify payment boundaries** so contract-level payments remain for deposit/prepaid records, while future monthly rent collection belongs to invoice/payment allocation
- **Prepare navigation and wording** so `/billing` is the entry point for monthly operations rather than a vague placeholder

## Capabilities

### Modified Capabilities

- `product-architecture`: tighten domain boundaries for utility readings and monthly payments
- `product-flow-foundation`: remove stale meter-device lifecycle language and align with simplified meter readings
- `rooms-client`: remove room-centric monthly meter reading workflow from Room detail
- `contracts-database`: require contract `payment_day` to persist through API/repository paths
- `contracts-api`: define lifecycle behavior for active contract delete/termination/renewal readiness
- `contracts-client`: clarify handover readings as contract onboarding/offboarding data, not monthly billing entry
- `contract-payments`: define the temporary boundary between contract-level payments and future invoice payments
- `meter-readings-api`: clarify readings as billing inputs scoped by building + period, with room detail read-only usage only

### New Capabilities

_(none — this is a cleanup/readiness change, not billing runtime)_

## Impact

- No invoice generation in this change
- No debt tracking in this change
- No tenant portal or online payment in this change
- **Database changes must be explicit**: any ADD/DROP/ALTER/constraint/index change must be listed with table, column, type, default, constraint, backfill, rollback note, and expected data impact
- **Database application is manual**: SQL must be prepared for Supabase Dashboard SQL Editor review/execution; this change must not rely on automatic `supabase db push`
- Expected implementation touches:
  - `server/repositories/contracts/index.ts`
  - `server/services/contracts/index.ts`
  - `server/services/contract-renewals.ts`
  - contract services/occupants repositories for renewal carry-forward
  - `app/pages/rooms/[id]/index.vue`
  - `app/pages/buildings/[id]/index.vue`
  - `app/pages/billing/index.vue`
  - relevant OpenSpec specs and project status docs
