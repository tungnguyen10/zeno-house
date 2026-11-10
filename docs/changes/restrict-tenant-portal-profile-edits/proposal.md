---
type: Change Proposal
title: "Restrict tenant portal profile edits"
status: draft
change_state: implementation-verification
tags: [change, tenants, portal, authorization, privacy]
---

## Why

Tenant Portal currently accepts identity/profile changes beyond the intended operator-managed boundary. Hiding controls alone would leave callable PATCH, image endpoints and direct Storage policies available. Internal `tenants.notes` is also selected and returned in the profile/bootstrap DTO, and raw authenticated table SELECT can bypass an API-only omission.

The user approved keeping just four self-editable contact fields and routing identity corrections/evidence to staff verification.

## Scope

- Self-edit only `phone`, `occupation`, `emergency_contact_name`, `emergency_contact_phone`.
- Read-only own identity/personal/contract information; login email/password retain separate account flows.
- Remove internal notes from portal DTOs, bootstrap and UI, and close direct raw-table reads that could expose them.
- Deny tenant canonical identity-image mutations in API/service and direct Storage. Preserve own image reads and authorized staff updates.
- Offer “Yêu cầu chỉnh sửa” through the existing support request model and private attachment storage. Evidence never overwrites canonical image slots.
- Provide the missing scoped staff intake/status surface so requests have an actual recipient. Staff validate and apply changes through existing internal tenant controls; resolving a request never applies a profile mutation automatically.
- Reconcile accepted specs and record separate source, SQL/cloud and visual evidence.

## Out of scope

- OCR/Claude extraction, automatic identity verification, automatic approval or automatic profile application.
- A second tenant/profile model, new approval entity or evidence bucket.
- Phone-based login, OTP verification of the contact phone, changing Auth email through profile PATCH.
- Historical audit backfill, a general support messaging/notification system, or a new document retention policy.

## Alternatives considered

1. **Four-field edit + existing support-request intake (recommended):** aligns contact self-service with staff-owned identity, reuses private uploads/statuses, and adds a small staff queue. Manual verification/application is intentional.
2. Lock every profile field: smaller implementation but forces staff involvement for ordinary contact changes.
3. Build a new structured approval engine: richer review history and multi-file workflows, but duplicates request/storage infrastructure and exceeds this change's goal.
