# Tenant Access & Contract Linking (tenant optimization PR1, P0)

**Status: archived. Source and local tests complete, production migration and secret in place; application deployment, deployed smoke and visual QA remain open (see verification).**

- [Design and decisions](./design.md)
- [Implementation plan](./implementation-plan.md)
- [Verification](./verification.md)

## Follow-up changes (approved scope, not started)

- `tenant-required-profile` — require the 7 contract (DOCX) party fields on every tenant create path; supersedes Tenant V2 UX-02.
- PR2 Tenant lifecycle integrity, PR3 Tenant UX completion, PR4 Reliability & measured optimization (unique index on active primary contracts after data cleanup).

## Capabilities to update on acceptance

- [tenants-api](../../capabilities/tenants-api.md)
- [contracts-api](../../capabilities/contracts-api.md)
- [tenants-ui](../../capabilities/tenants-ui.md)
