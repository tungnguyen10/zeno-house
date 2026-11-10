---
type: Change Design
title: "Tenant portal profile permissions and correction intake"
status: draft
change_state: implementation-verification
tags: [change, tenants, portal, security, design]
---

# Decisions

User-approved product direction: tenant self-service is limited to contact maintenance. This document makes the implementation choices concrete; implementation has not started.

## 1. Field and action matrix

| Data/action | Tenant access |
| --- | --- |
| Contact phone | Edit; existing normalization, global uniqueness, generic 409 and conflict budget remain |
| Occupation | Edit; optional, nullable |
| Emergency contact name/phone | Edit; optional, nullable; emergency phone is not a globally unique identity |
| Full name, DOB, gender, permanent address | Own read only; correction request |
| ID/passport number, issue date/place | Own read only; correction request |
| Canonical front/back identity images | Own read only; evidence goes through request attachments |
| Internal `tenants.notes` | Neither read nor write through portal/bootstrap/raw authenticated table reads |
| Login email/password | Login email stays read-only; password uses the existing separate flow; no email-change feature is added |
| Room, contract, rent, deposit, record status/code/linkage | Own authorized read only; never profile mutations |

Canonical images mean the currently stored slots, not proof of historical verification. Existing tenant-uploaded images are not retroactively marked verified; no verified badge/status is invented by this change. No new tenant-authored notes field is introduced. Tenant-written explanations belong to the support request, not internal notes.

## 2. API and DTO boundary

`tenantProfileUpdateSchema` becomes a strict, nonempty Zod object with exactly the four writable keys. Unknown keys, including mixed allowed+forbidden payloads, reject the entire operation with 422 `VALIDATION_ERROR`; nothing is silently partially saved. Both handler and service validate before any conflict lookup, persistence or audit side effect. Unknown-key errors use safe field names/messages, never supplied values.

Remove `notes` entirely from `TenantProfile`, the profile repository SELECT/mapper and every portal payload, including `/api/tenant/me`, PATCH responses and `/api/tenant/bootstrap`. Keep dashboard tenant DTOs/internal notes unchanged. Tests must assert absence, not `notes: null` or merely hidden text.

Keep own legal identity fields in the read DTO; remove them from edit-form types, changes builders and optimistic update mapping. Phone remains a contact field and does not update Auth phone or alter account linkage. Existing password/email behavior is not expanded.

The portal conflict service candidate becomes `{ phone, excludeId }`; legal ID normalization/checks stay available to authorized internal mutation paths. Phone 409/429 handling and audit redaction from change B remain intact.

## 3. Canonical image protection and direct access

Keep tenant GET identity images. Tenant POST/DELETE identity-image endpoints and service methods return 403 before upload/delete, path update or audit. Staff use existing internal tenant document permissions/full-access checks. Do not remove the broad `tenant.documents.write` capability, because generic personal documents and request attachments still use it; deny canonical identity writes specifically.

A new migration drops `tenant_id_images_self_insert` and `tenant_id_images_self_delete`. Retain `tenant_id_images_self_select`, `tenant_id_images_admin_all`, private bucket settings and existing files/path columns. Verify INSERT, upsert/UPDATE and DELETE are denied with actual tenant credentials; verify own read and staff server-owned access still work. Inspect all live policies first so another permissive policy cannot reopen this path.

To protect notes and correction text, revoke raw table SELECT from PUBLIC/`anon`/`authenticated` on `public.tenants` and `public.support_requests`, retaining service-role access and RLS. This aligns with the repository's server-owned business-data rule. API-scoped reads remain available; tests/specs that previously expected authenticated raw SELECT must be reconciled explicitly. Preserve support-request housing/ownership INSERT safety-net rules and require tenant-created rows to have status `new`; preserve existing generic document policies; do not revoke table/Storage permissions globally across unrelated resources. Rollout preflight checks application reads, SQL helpers and policies for dependencies on raw SELECT.

## 4. Correction request and evidence

Use existing `support_requests` fields/statuses (`new`, `in_progress`, `resolved`) and `/api/tenant/requests`. A “Yêu cầu chỉnh sửa” action opens `/portal/requests?intent=profile-correction` in create mode with a fixed title “Yêu cầu chỉnh sửa hồ sơ” and neutral instructions. Query parameters carry only this intent, never existing/new names, identity values, notes or file paths. Do not persist correction text/images to localStorage.

The tenant explains the requested correction and can attach one JPEG/PNG/WebP/PDF up to 5 MB, matching existing validation. A two-sided document can be one PDF; there is no new multi-file editor. The attachment stays under `${tenantId}/requests/...` in private `tenant-documents`; it is evidence pending staff handling, not a canonical front/back slot. No OCR is invoked. User copy says “Đã gửi yêu cầu, thông tin hồ sơ chưa thay đổi”.

Existing housing resolution still supplies tenant/building/contract scope for primary tenants and roommates. If there is no active housing context, explain “Hồ sơ chưa có nơi tiếp nhận yêu cầu. Vui lòng liên hệ trực tiếp ban quản lý”; do not create a falsely routed request or invent contact details. Contact self-edits still work independently.

## 5. Staff receiving and manual handling

Current `TenantSupportRequestService.listForOperator` is only a read hook: there is no internal request endpoint/page or status mutation. Add the minimal receiving surface before shipping the correction CTA:

- `GET /api/tenant-support-requests`: paginated, default page 1/limit 20, max 100; server-derived visible buildings and full tenant access. Exclude basic/none tenant rows before returning descriptions or signing attachments. Return a separate operator DTO with canonical tenant/building/contract IDs and a safe tenant label.
- `/dashboard/tenant-support-requests`: list/detail using existing list/table/drawer primitives, status filters and an existing-permissions navigation entry. Staff can read the correction, open the private evidence, and navigate to the existing tenant edit/document controls when authorized.
- `PATCH /api/tenant-support-requests/:id`: strict `{ status: 'in_progress' | 'resolved', expected_status: 'new' | 'in_progress' | 'resolved' }`. Require `tenants.update`, building scope and full tenant access; nonauthorized targets return the same not-found response. Supported transitions are `new -> in_progress`, `in_progress -> resolved`, and `resolved -> in_progress`; same-status retry is a no-op. A stale expected status returns 409 without overwriting newer work.
- Status update + `support_request.status_updated` audit commit atomically through a service-role-only RPC. Profile mutation remains a separate explicit existing staff action, with its own existing permission/audit checks. “Đã xử lý” never means “Tự động phê duyệt” or promises the profile changed.

Do not show evidence or correction text to an operator with merely historical/basic tenant access, even when they have a related building. Tenant request lists remain self-scoped; tenant calls to operator endpoints are forbidden.

Request creation audit currently copies title/description. Since corrections can contain identity values, change audit snapshots to safe IDs/scope/status/time/has-attachment only for all support requests. Never copy request text, attachment filenames/paths, signed URLs or bytes into audit. The actual request remains private business data for the tenant and authorized staff.

## 6. Portal composition and affected states

Keep the current portal theme, typography, safe areas, primitives and unsaved-change guard. `/portal/profile/edit` contains only four editable fields grouped as contact/work and emergency contact. The profile dossier retains read-only personal/legal data and images; remove its internal-notes section. A short explanation distinguishes staff-verified identity from contact edits.

Keep phone conflict generic; no foreign tenant identifier or field hint. Keep 429 retry interval, disabled/in-flight controls, error rollback and loading/empty/retry states. Correction submission has no “approved” state; use the existing request timeline/status copy. Provide accessible field errors, focus-visible actions and contained long text on mobile. Follow the Zeno House UI polish workflow with frontend-design and Hallmark before implementation and representative desktop/mobile verification afterward.

## 7. Verification and release boundary

Tests cover strict payload rejection, forbidden service inputs, exact DTO absence across GET/PATCH/bootstrap, optimistic updates only for four fields, canonical-image API/Storage denial, staff scope, request attachment isolation, safe audit snapshots and atomic/stale status handling. Existing internal tenant edits and generic document/request uploads must remain usable.

Deploy coordinated server/UI and the reviewed privilege/Storage/RPC migration; stale old clients receive a clear validation error and refresh guidance, not partial success. Cloud preflight/apply/rollback verification and generated types are distinct from unit tests. No cloud write, dependency install or local runtime is authorized merely by this planning artifact. Do not promote accepted capabilities or archive the bundle until implementation and evidence pass.
