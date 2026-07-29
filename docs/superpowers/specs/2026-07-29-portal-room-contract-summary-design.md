# Portal Room Contract Summary Design

## Goal

Let a tenant review the material terms of their currently active lease from
`/portal/room`, without adding a second workflow, changing access scope, or
turning the mobile screen into a dense contract form.

## Scope

The existing active-contract summary gains the contract fields that are already
stored on `contracts`: payment day, occupant count, discount amount, surcharge
amount, and notes. The tenant portal API remains self-scoped and returns only
the active primary contract or current roommate occupancy selected by the
existing housing resolver.

## Design

The screen retains its room identity card, followed by one divider-separated
lease statement. The statement uses two groups rather than nested cards:

1. **Điều khoản chính** — term dates, monthly rent, payment day, deposit, and
   occupant count. These are always visible for a signed active contract.
2. **Điều chỉnh hợp đồng** — discount, surcharge, and notes. This group only
   renders when at least one value is meaningful, so zero-value adjustments and
   empty notes do not create visual noise.

Money values keep the existing portal statement treatment. Dates use the
Vietnamese locale. A roommate stays explicitly labelled and sees the primary
tenant as the contract holder; the UI does not infer that the roommate owns the
lease.

## Data Flow

`TenantHousingRepository` extends its existing contract selection with the
stored fields. `mapTenantContractSummary` maps them into
`TenantContractSummary`, which is already transported through the SSR-safe
portal bootstrap payload and exposed by `usePortalContract`. No new endpoint,
database migration, browser-side table query, or permission is needed.

## States and Constraints

- Preserve loading, error/retry, no-active-contract, primary tenant, and
  roommate states.
- Long notes and values wrap inside their rows; labels and values never force
  horizontal scrolling at 320, 375, 414, or 768 pixels.
- Preserve the existing portal token system, typography, primitives, and
  reduced-motion behavior.
- Do not expose historic, future, terminated, expired, or another tenant's
  contract data.

## Verification

Add regression tests for the enriched DTO mapping and for the room-page
hierarchy, optional adjustment visibility, and roommate disclosure. Run focused
tests, typecheck, lint, OpenSpec validation, and the relevant browser pass when
an authenticated portal runtime is available.
