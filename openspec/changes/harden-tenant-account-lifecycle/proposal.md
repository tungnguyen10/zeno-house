## Why

Tenant deletion and account revocation can currently leave Supabase Auth identities without a tenant link, while the management UI reports that the account and email were removed. Legacy manager RLS policies also allow direct Data API access outside assigned buildings, so the tenant account lifecycle and its database safety net need to be made consistent before more portal accounts are provisioned.

## What Changes

- Make tenant hard-delete reject linked portal accounts and require explicit account revocation first.
- Replace ambiguous Auth deletion fallback with an explicit `deleted` or `deactivated` result, reliable authorization-metadata clearing, session revocation, and truthful UI copy.
- Add account drift detection and an admin reconciliation endpoint for orphaned tenant-role Auth users.
- Change audit actor foreign keys needed for account deletion to preserve audit snapshots while allowing Auth identities to be removed.
- Scope manager RLS policies for tenant, contract, occupant, and invoice data through active building assignments and reduce unnecessary browser-role grants.
- Align support-request RLS with current primary and roommate housing context.
- Make lifecycle audit side effects recoverable and surface partial/deactivated outcomes instead of reporting false success.
- Enforce the accepted tenant profile whitelist by removing self-service legal-identity edits.
- Add complete invoice pagination, searchable tenant selection during approval, and visible profile mutation errors.
- Correct access-request creation audit attribution and extend lifecycle, RLS, reconciliation, and UI test coverage.

## Capabilities

### New Capabilities

- `tenant-account-security`: Database constraints, manager RLS scope, Auth-user deletion compatibility, session revocation, orphan detection, and reconciliation requirements.

### Modified Capabilities

- `tenant-account-provisioning`: Lifecycle actions return truthful outcomes, prevent orphan creation, and support reconciliation.
- `tenants-api`: Tenant deletion is blocked while a portal account link exists.
- `tenant-portal-api`: Legal identity remains operator-managed and invoice pagination is fully consumable.
- `tenant-portal-ui`: Account states, mutation failures, and paginated invoice history are surfaced.
- `tenant-support-requests`: Direct-access RLS matches current primary and roommate housing scope.
- `pending-account-approval`: Creation audit attribution is stable and tenant selection supports the complete tenant set.

## Impact

- Supabase migrations for foreign keys, grants, RLS policies, helper functions, and verification queries.
- Tenant, Auth-user, account-link, audit, invoice, support-request, and access-request repositories/services/APIs.
- Tenant account settings, approval settings, portal profile, and portal invoice pages/composables/types.
- OpenSpec requirements, architecture documentation, API inventory, and Vitest coverage.
- Production rollout requires manual migration review/application and a one-time review of detected orphan accounts; this change does not silently delete existing identities.
