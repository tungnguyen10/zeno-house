# Tenant Portal

The tenant portal supports both the person named on a contract and active roommates. Every login
still maps one-to-one to its own `tenants` row through `tenant_user_links`; account provisioning,
temporary-password onboarding, reset, disable, and revoke APIs are unchanged.

## Housing context

The server resolves housing context for every shared read:

1. Prefer the linked tenant's current active primary contract.
2. Otherwise use an active `contract_occupants` row whose move-in date has arrived and whose
   `move_out_date` is null, provided the contract is active and within its date range.
3. Return no shared context for future, moved-out, expired, or terminated assignments.

The contract DTO includes `assignmentRole` (`primary` or `roommate`) and `primaryTenantName`.
Overview and room pages display this role so a roommate is not presented as the contract holder.

## Data boundaries

- Profile, CCCD images, and documents always belong to the linked tenant record.
- Primary tenants read invoices by `tenant_id`, preserving their invoice history.
- Active roommates read all invoices for the current shared `contract_id`, including invoices
  issued before their move-in date. Invoice detail uses the same server-derived scope.
- Support requests keep the sender's own `tenant_id` and personal timeline, while the active
  housing context supplies `contract_id` and `building_id`.
- `move_out_date`, contract termination, or contract expiry removes shared contract and invoice
  access immediately. The portal account remains available for personal profile access.

RLS mirrors these rules as a direct-access safety net. Apply
`supabase/migrations/20260722085743_tenant_roommate_portal_access.sql` manually through the
Supabase Dashboard, then run `supabase/verification/tenant_identity_rls.sql`.
