---
type: Change Proposal
title: "harden-tenant-identity-data: proposal.md"
status: deprecated
change_state: completed
tags: [superpowers, change, migration, security, tenants]
---

## Why

Tenant V2 (Quick Create, then Claude identity autofill) relies on "one person = one reusable tenant profile". The current `develop` baseline does not guarantee that and leaks identity data:

- `tenants.phone` and `tenants.id_number` have **no unique constraint** (`20260514000004_create_tenants.sql`); uniqueness is a service-level check-then-insert, so concurrent submits can create duplicates.
- Phone numbers are not normalized: `0901 234 567`, `0901234567` and `+84901234567` are treated as different values.
- Duplicate checks in create, update, bulk import and the tenant portal search **all tenants** regardless of caller scope and return field-specific messages, so any caller can probe whether a phone/ID number exists anywhere in the system.
- The tenant portal profile update does not check phone duplicates at all.
- `useTenantForm` persists the whole form, including ID number, DOB and address, into `localStorage` drafts.
- Tenant audit events store full `before_data`/`after_data`, and `/dashboard/settings/history` renders them as raw JSON.

## What Changes

- Normalize phone and ID number with one shared rule set (TypeScript + SQL), stored normalized.
- Add DB unique indexes on normalized `phone` and non-null `id_number`, guarded by a read-only preflight and a migration that aborts when duplicates remain.
- Centralize duplicate handling: callers with `full` access get a specific 409 with the existing tenant ID; callers with `basic`/`none` access (and tenant-portal users) get a generic, non-disclosing 409.
- Rate-limit duplicate-conflict responses per user.
- Exclude sensitive identity fields from tenant form drafts and purge them from existing drafts.
- Redact sensitive tenant fields in new audit snapshots.

## Out of Scope

- Tenant Quick Create UI, inline tenant selection in Room/Contract (change A).
- Claude/Anthropic identity extraction, image handling, OCR quota (change C).
- A standalone `/api/tenants/identity/check` endpoint (decided in change A).
- Allowing shared phone numbers between tenants.
- Automatic merging of duplicate tenant profiles; rewriting historical audit rows.
- New tenant columns or type changes.

## Dependencies

- Builds on the `full/basic/none` model of [tenant-authorization-scope](../../changes/tenant-authorization-scope/design.md); its cloud rollout verification should be signed off first.
- Overlaps with the redaction goal of [harden-event-audit](../../changes/harden-event-audit/proposal.md); this change only covers tenant snapshots and must reuse any shared redaction helper if that change lands first.

## Capabilities

Modified: `tenants-api`, `tenants-database`, `tenants-ui`, `tenant-portal-api`, `entity-audit-log`.
