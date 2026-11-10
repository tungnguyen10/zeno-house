---
type: Implementation Plan
title: "Restrict tenant portal profile edits implementation plan"
status: draft
change_state: implementation-verification
tags: [change, plan, portal, tenants, security]
---

# Restrict Tenant Portal Profile Edits Implementation Plan

> Use Superpowers executing-plans or subagent-driven-development at implementation time. This is the single execution checklist; do not create a parallel tasks.md. Source implementation is present; see the execution record for separate cloud and visual gates.

**Goal:** Allow exactly four contact fields to be self-edited, keep verified identity operator-managed, hide internal notes, and deliver a private correction/evidence request to authorized staff without mutating the canonical identity.

**Architecture:** Shared strict Zod boundary → tenant service authorization → repository allowlist/DTO. Existing support requests/private attachments provide correction intake; a small internal queue/status endpoint provides a real recipient. SQL closes raw-read/Storage bypasses and commits request status/audit atomically.

**Stack:** Nuxt 4, Vue 3, Zod, Vitest, existing portal/dashboard primitives, Supabase cloud PostgreSQL/Storage. No new dependency or runtime is needed to write this plan.

**Design:** [design.md](./design.md). **Scope rationale:** [proposal.md](./proposal.md).

## Global constraints

- Writable keys, verbatim: `phone`, `occupation`, `emergency_contact_name`, `emergency_contact_phone`.
- Forbidden or mixed payload → 422 `VALIDATION_ERROR`, no mutation or conflict lookup. Empty body also rejects.
- Canonical image POST/DELETE → 403 before parsing/upload/delete/path mutation; GET stays self-scoped.
- Generic phone conflict remains `TENANT_IDENTITY_CONFLICT`; existing 429 budget/retry and phone normalization stay unchanged.
- `notes` is absent from portal JSON, including bootstrap and PATCH responses; do not alter dashboard tenant notes or invoice-note types.
- Services own permissions/business rules/audit, repositories own persistence, client data flows through server APIs.
- No identity values or proposed changes in route query strings, localStorage, audit snapshots or telemetry.
- Request evidence stays in private `tenant-documents` under server-derived tenant/request paths; never automatically updates `id_card_front_path`/`id_card_back_path`.
- Existing account email/password flow and general document uploads remain separate; no broad removal of `tenant.documents.write`.
- Scope-check staff before returning correction text or signing evidence. Never trust client building/tenant IDs.
- Ask for cloud-write/runtime/dependency permission when not already authorized for this change. The previous change's specific production approval does not authorize this new migration.
- Never hand-edit generated database types. UI follows `.agents/skills/zeno-house/references/ui-polish-workflow.md`, frontend-design and Hallmark with existing themes/primitives.
- Vietnamese copy has diacritics. Use fictional data for tests/screenshots.

## Task 1 — Four-field server contract and private read DTO

**Files**

- Modify `app/utils/validators/tenant-portal.ts`, `app/types/tenant-portal.ts`, `app/utils/mappers/tenant-portal.ts`.
- Modify `server/repositories/tenant-portal/profile.ts`, `server/services/tenant-portal/profile.ts`.
- Modify `tests/server/tenant-portal/core.test.ts`, `services.test.ts`, `api.test.ts`, `repositories.test.ts`, `bootstrap-service.test.ts` in that same test directory.
- Create `tests/server/tenant-portal/profile-edit-permissions.test.ts` for the boundary matrix.

- [x] **1. Write failing boundary tests.** For each forbidden key below, test forbidden-only and mixed `{ phone: '0900000000', [key]: value }` payloads. Assert no repository update, identity lookup or audit. Cover handler and direct service calls, tenant-ID injection, disabled account, GET/PATCH/bootstrap absence of `notes` even when the DB row contains it, and internal tenant notes remaining unchanged.

```ts
const forbiddenProfileValues = {
  full_name: 'Fixture Person', gender: 'other', date_of_birth: '1990-01-01',
  permanent_address: 'Fixture address', id_number: 'FAKE0001',
  id_issued_date: '2020-01-01', id_issued_place: 'Fixture office',
  notes: 'Private staff fixture', email: 'fixture@example.test',
  tenant_id: 'other-tenant', code: 'OTHER', status: 'archived',
}
for (const [key, value] of Object.entries(forbiddenProfileValues)) {
  it(`rejects mixed payload containing ${key}`, () => {
    expect(tenantProfileUpdateSchema.safeParse({ phone: '0900000000', [key]: value }).success).toBe(false)
  })
}
```

Run `npx vitest run tests/server/tenant-portal/profile-edit-permissions.test.ts tests/server/tenant-portal/core.test.ts tests/server/tenant-portal/services.test.ts tests/server/tenant-portal/api.test.ts tests/server/tenant-portal/bootstrap-service.test.ts`; confirm RED for currently accepted forbidden fields/notes serialization.

- [x] **2. Replace the shared mutation schema.** Keep existing field messages/limits; use this complete boundary shape:

```ts
export const tenantProfileUpdateSchema = z.object({
  phone: tenantPhoneSchema.optional(),
  occupation: z.string().trim().max(100, 'Nghề nghiệp quá dài').nullable().optional(),
  emergency_contact_name: z.string().trim().max(100, 'Tên liên hệ khẩn cấp quá dài').nullable().optional(),
  emergency_contact_phone: z.string().trim().max(20, 'SĐT khẩn cấp quá dài').nullable().optional(),
}).strict().refine(input => Object.keys(input).length > 0, {
  message: 'Cần ít nhất một trường liên hệ hợp lệ',
})
```

Keep `tenantIdNumberSchema` wherever other schemas use it; remove only genuinely unused imports. In `TenantProfileService.update`, safe-parse and map failure through `throwValidationError` before side effects. Build the conflict candidate as `{ phone: whitelisted.phone, excludeId: id }`; retain unique-race fallback and redacted audit on successful updates.

- [x] **3. Remove internal notes at serialization boundaries.** Remove only `TenantProfile.notes`, the profile row/select entry and `mapTenantProfile` assignment. Keep profile read-only identity properties. Review every `TenantProfile` fixture/consumer and bootstrap path; no spread of a raw row into a response. Avoid deleting `notes` from unrelated DTOs.

- [x] **4. Run boundary tests GREEN**, plus `npx vitest run tests/server/tenant-portal tests/server/tenants tests/server/tenants.api.test.ts`. Update old tests that expected editable identity or silent stripping to expect full rejection. Confirm phone normalized-equivalent duplicates, self-exclusion, generic races and 429 still pass. Commit as `fix(portal): restrict profile writes and exclude internal notes`.

## Task 2 — Close canonical-image and raw-data bypasses

**Files**

- Modify `server/api/tenant/id-images/[side].post.ts`, `[side].delete.ts`; keep `index.get.ts` working.
- Modify `server/services/tenant-portal/identity-images.ts` with explicit read-only portal mutation denial.
- Create `supabase/migrations/20261110000326_restrict_tenant_portal_profile.sql` (reserve this filename; if already taken at execution, use the installed CLI's next migration name and update this plan).
- Create `supabase/verification/restrict_tenant_portal_profile.sql`.
- Modify `supabase/verification/tenant_identity_rls.sql` to test server-owned profile reads instead of raw tenant SELECT success.
- Modify `tests/server/tenant-portal/identity-images-api.test.ts`, `identity-images-service.test.ts`, `sql-rls.test.ts`, `documents-sql.test.ts` as affected.
- Create `tests/server/tenant-portal/profile-edit-sql.test.ts`.

- [x] **1. Add failing tests** for direct portal POST/DELETE and direct service calls: 403 and zero multipart parse/upload/remove/updatePath/audit calls; own GET still returns signed images. Add migration checks for the exact two Storage policies removed and table-read revokes. Retain generic document/request attachment upload tests. Run the named tests and confirm RED.

- [x] **2. Deny mutations before work.** Both portal handlers authenticate/resolve the live tenant then return `throwForbidden('Ảnh định danh do ban quản lý xác minh. Vui lòng gửi yêu cầu chỉnh sửa.')` before multipart parsing or repository calls. Services enforce the same denial so handler bypass is ineffective. Preserve the internal `TenantService` image mutation path and its full-access authorization.

- [x] **3. Add the restrictive SQL portion.** Start one transaction and include:

```sql
revoke select on public.tenants from public, anon, authenticated;
revoke select on public.support_requests from public, anon, authenticated;
drop policy if exists tenant_id_images_self_insert on storage.objects;
drop policy if exists tenant_id_images_self_delete on storage.objects;
```

Also inspect/revoke any preexisting column-level SELECT grants on those two tables that would retain a read bypass; verify with `has_any_column_privilege`. Retain service-role grants, RLS, own image SELECT, admin image policy and unrelated Storage policies. Tighten `support_requests_tenant_insert_own` to require `status = 'new'` while preserving its complete active primary/roommate context checks, so direct INSERT cannot manufacture an already-resolved request. Do not drop tables, objects, documents or existing image paths. Add the atomic status RPC from Task 5 to this same migration before its final commit.

- [x] **4. Write executable rollback verification** with linked tenant A/B and scoped staff fixtures. Test raw tenant/support-request SELECT fails for authenticated/anon; service-role API read remains viable; raw canonical Storage INSERT/UPDATE/upsert/DELETE is denied; own image SELECT remains allowed; cross-tenant SELECT denied; authorized staff server path and generic document/request attachment policies remain available; direct tenant INSERT with `in_progress`/`resolved` is denied. Assert no canonical path changes and roll everything back. Update old SQL expectations intentionally rather than weakening the new checks.

- [x] **5. Run the named SQL-contract/image/document tests GREEN** and commit as `fix(portal): protect canonical identity storage and private reads`. Cloud application is Task 6, not inferred from these static tests.

## Task 3 — Four-field portal form and read-only identity dossier

**Files**

- Modify `app/utils/portal-profile.ts`, `app/composables/tenant-portal/usePortalProfile.ts`.
- Modify `app/pages/portal/profile/edit.vue`, `app/pages/portal/profile/index.vue`, `app/components/portal/PortalProfileDossier.vue`.
- Modify `tests/utils/portal-profile.test.ts`, `tests/composables/tenant-portal.test.ts`, `tests/pages/portal-profile-ui.spec.ts`, `portal-profile-route-structure.spec.ts`.

- [x] **1. Add failing behavior tests.** Exact form keys/changes/optimistic mapping contain only the four allowed fields. Legal profile values never enter a submitted body. Dirty/cancel/refresh/rollback tests preserve allowed edits; generic phone conflict has no identity field hint, 429 includes retry wait. Dossier shows own read-only identity, no internal notes and no canonical upload/delete controls. Run the named tests RED.

- [x] **2. Reduce the edit model** to the following explicit data contract and map only these keys in `toTenantProfileEditForm`, normalization, changes and optimistic update:

```ts
export interface TenantProfileEditForm {
  phone: string
  occupation: string
  emergency_contact_name: string
  emergency_contact_phone: string
}
```

Phone cannot be empty; optional fields clear to null. Continue to submit only changed values, using the shared schema for canonical phone normalization. Retain the unsaved-change guard, loading/error/empty states and rollback.

- [x] **3. Reshape existing composition.** Keep two editable groups: contact/work and emergency contact. Remove full name, gender, DOB, address, legal ID/issue controls, notes and image mutation handlers/imports from the edit page. Keep read-only identity and previews on the dossier without inventing a verified badge or retroactively attesting old tenant uploads; remove its notes section. Add the correction CTA described in Task 4 and the copy “Thông tin định danh được ban quản lý đối chiếu trước khi cập nhật. Bạn có thể gửi yêu cầu nếu thông tin chưa đúng.” Rename the ordinary edit action “Sửa thông tin liên hệ”. Reuse portal primitives/theme; do not add a parallel visual system.

- [ ] **4. Run the named tests and `npx vitest run tests/pages tests/composables/tenant-portal.test.ts` GREEN.** Inspect desktop/mobile/error/disabled/focus/sticky-safe-area states under the UI polish workflow. Commit as `feat(portal): separate contact edits from verified identity`.

## Task 4 — Private correction submission using existing support requests

**Files**

- Modify `app/pages/portal/requests.vue`, `app/composables/tenant-portal/usePortalRequests.ts`.
- Modify `server/services/tenant-portal/requests.ts`; keep existing tenant request routes/context resolution.
- Modify `tests/pages/portal-requests-ui.spec.ts`, `tests/server/tenant-portal/requests-service.test.ts`, `requests-api.test.ts`, `tests/composables/tenant-portal.test.ts`.

- [x] **1. Add failing tests.** `?intent=profile-correction` opens create mode and prefills the fixed title without inserting identity values into URLs/storage. Attachment submit stores only a request/evidence object; canonical image/profile repositories remain untouched. No active housing context rejects with actionable feedback and no orphan upload. Audit contains neither supplied title/description nor bytes/path/URL/filename. Rejected submit preserves text for retry in memory.

- [x] **2. Implement the intent adapter.** Read only the literal intent value. Call existing `openCreate()` once when the intent is consumed, set title “Yêu cầu chỉnh sửa hồ sơ”, and keep generic support requests working. Do not watch arbitrary query changes in a way that resets an in-progress form. Display single-file/5 MB limits and explain a two-sided document may be one PDF. Use existing POST/refresh/status flow; successful copy is “Đã gửi yêu cầu, thông tin hồ sơ chưa thay đổi”. Do not call canonical image upload from this flow.

- [x] **3. Harden support-request audit.** Replace its after snapshot with an allowlist of `id`, `tenant_id`, `building_id`, `contract_id`, `status`, `created_at`, `has_attachment`. No title/description/attachment filename is copied to audit for any request. Tenant/private operator request DTOs still contain business text after their own scope checks.

- [x] **4. Verify request self-scope/primary/roommate/no-context/MIME/size/failed-upload rollback**, then run all named tests GREEN. The CTA is released only with Task 5's staff receiving surface; do not ship a request path nobody can receive. Commit as `feat(portal): submit identity corrections as private support evidence`.

## Task 5 — Scoped staff intake and atomic handling status

**Files**

- Create `server/api/tenant-support-requests/index.get.ts`, `[id].patch.ts`.
- Extend `server/services/tenant-portal/requests.ts`, `server/repositories/tenant-portal/requests.ts`.
- Extend `app/types/tenant-portal.ts`, `app/utils/validators/tenant-portal.ts`, `app/utils/mappers/tenant-portal.ts`.
- Create `app/composables/useTenantSupportRequestQueue.ts`, `app/pages/dashboard/tenant-support-requests.vue`.
- Modify `app/utils/constants/navigation.ts`, `app/utils/constants/audit.ts`, `app/utils/audit/display.ts`.
- Extend Task 2's migration/rollback verification; create `tests/server/tenant-portal/operator-requests.test.ts`, `tests/pages/tenant-support-request-queue.spec.ts`.

- [x] **1. Add failing service/API tests** for admin, owner and manager; visible-building/full vs basic/none tenant access; tenant/anonymous rejection; direct URL access; attachment-signing happens only after full authorization; unknown/stale status; repeat delivery; no automatic profile mutation. Test pagination total/items only count full-authorized requests, not rows later filtered from a broader page. Run these new tests RED.

- [x] **2. Implement read contracts.** Shared query schema: `page` default1/min1, `limit` default20/min1/max100, optional existing request status. First query lean candidate IDs/tenant IDs/building IDs in visible buildings; resolve full tenant contexts before selecting text/signing attachments/counting/paginating. Fetch the authorized page ordered `created_at desc, id desc`. Return `{ data, meta: { total, page, limit, totalPages } }`. Separate `OperatorTenantSupportRequest` DTO adds canonical tenant/building/contract IDs and tenant label to the request display fields. Empty permitted scope returns an empty page; it never falls back to unscoped queries.

- [x] **3. Implement atomic status contract.** Define:

```ts
export const tenantSupportRequestStatusUpdateSchema = z.object({
  status: z.enum(['in_progress', 'resolved']),
  expected_status: z.enum(['new', 'in_progress', 'resolved']),
}).strict()
```

Service requires `tenants.update`, visible building and full tenant access. Repository invokes `update_tenant_support_request_status_with_audit(p_request_id uuid, p_expected_status text, p_status text, p_actor_id uuid)` only after those checks. The SQL function locks the row, rejects invalid transitions/stale expected status, treats already-at-target delivery as a no-op, updates status and inserts exactly one `support_request.status_updated` audit with actual building/tenant context and before/after status in the same transaction. It never updates a tenant or image slot. Use empty search_path, revoke EXECUTE from PUBLIC/anon/authenticated, grant only service_role. Map stale status to safe 409; nonexistent/unauthorized target to consistent404. A temporary narrow RPC cast may exist only at the repository boundary until Task6 generates types; remove it before completion.

- [x] **4. Implement the receiving surface.** Add “Yêu cầu người thuê” to the existing rental navigation using an existing icon, not a new primitive. Read access follows `tenants.read`; status controls additionally require `tenants.update` and full tenant context. Use `UiListToolbar`, `UiTable`/existing mobile list, existing drawer/alert/button primitives, status filter and pagination. A missing/deleted attachment produces a safe per-row “Tệp đính kèm không còn khả dụng” state instead of breaking the entire list or suggesting verification succeeded. Detail shows private request text/evidence and links to existing tenant detail/edit controls. Staff manually verify/apply there, then mark “Đang xử lý”/“Đã xử lý”; no button calls a profile update merely by resolving a request. Loading, empty, forbidden, error/retry, stale409 and in-flight states have explicit copy.

- [x] **5. Extend executable SQL verification.** Assert function ACL and actual denied execution; legal transitions, duplicate retry no duplicate event, stale conflict no overwrite, and rollback when audit insertion is fault-injected to fail. Confirm canonical tenant/profile/image state unchanged by every status operation. Keep fixtures synthetic and rolled back.

- [x] **6. Run new API/UI tests plus existing support-request/audit suites GREEN**, and commit as `feat(tenants): receive and track scoped correction requests`.


## Task 6 — Integrated security verification, cloud rollout and promotion

- [ ] **1. Run narrow suites, then full checks:** `npx vitest run tests/server/tenant-portal tests/utils/portal-profile.test.ts tests/composables/tenant-portal.test.ts tests/pages`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check`, `git diff --check`. Fix source regressions; keep baseline warnings distinct.
- [ ] **2. Independent security review:** trace every profile/identity write and every portal/bootstrap/private-text read. Check direct SQL/Storage bypasses, staff full-access checks before evidence signing, and audit leakage. Verify existing internal tenant editing, account security, invoices/contracts and generic document uploads remain functional. Resolve important findings before rollout.
- [ ] **3. With explicit cloud authorization, run read-only catalog preflight** for grants/column grants, all permissive policies, RLS/helper dependencies and migration history. Apply only the reviewed migration after a dry-run. Coordinate API/UI deployment so unsupported older payloads fail clearly; do not silently restore forbidden edits for old clients.
- [ ] **4. Run rollback verification on approved cloud target**, including actual tenant and service-role privilege behavior; no fixture cleanup against real tenant IDs. Verify no remaining fixture rows/objects and no changed canonical image paths. Capture the returned booleans/errors as sanitized evidence.
- [ ] **5. Generate DB types from cloud using existing CLI**, remove the temporary status RPC cast, rerun typecheck and affected repository/service tests. Never fabricate schema/type completion from static tests.
- [ ] **6. With authorized runtime, inspect representative 375px mobile and desktop states** for four-field edits, read-only dossier/no notes, generic409/429, correction request/no active context, evidence upload errors, and staff queue/scoped detail/stale status. Keep only synthetic screenshots and document what was actually exercised. Apply frontend-design/Hallmark polish, then stop owned QA servers.
- [ ] **7. Reconcile accepted docs:** `tenant-portal-api`, `tenant-portal-ui`, `tenant-documents`, `tenant-support-requests`, `tenants-database`, `entity-audit-log`, `docs/features/tenant-portal.md` and `docs/architecture/auth-permissions.md`. Explicitly replace old twelve-field/self-image-edit requirements and raw SELECT expectations. Update the predecessor's divergence through a new provenance link, without rewriting its historical verification record. Archive this completed change with preserved links only after evidence passes. Run `npm run knowledge:check`.
- [ ] **8. Commit completion evidence** with actual test/SQL/visual outputs; keep unrelated workspace changes separate. Do not claim application deployment merely because a migration or branch commit succeeded.

## Planning self-review

- Product matrix covers four writable fields, identity-only read, private internal notes, account separation and evidence pending staff handling.
- Bypasses include direct service calls, bootstrap/PATCH response serialization, raw table/column grants and canonical Storage policies.
- Existing requests are reused, but the missing staff receiver/status path is explicitly included; there is no pretend approval workflow or automatic profile application.
- No active-housing fallback invents a recipient. One-file evidence limitation is explicit and uses current MIME/size rules.
- One canonical checklist; accepted capabilities and historical hardening evidence remain unchanged during planning. No implementation success is claimed.

## Execution record

2026-11-10: plan drafted after source/capability inspection and user approval of the product direction. Source, SQL migrations, cloud data, dependencies and runtimes were not modified by this planning task.


## Implementation execution — 2026-11-10

- Implemented Tasks1–5 source and tests. Focused new types/validators/mappers/operator service files keep the staff queue separate from the portal profile DTO. One consolidated implementation commit records the integrated source instead of intermediate non-deployable commits.
- Kept unrelated Tenant V2/contract edits out of this commit. Generated types reflect the actual shared cloud schema rather than manual changes.
- 388 test files / 2,420 tests passed; typecheck exit0; scoped lint exit0; full lint has one unrelated concurrent contract-file error and one preexisting warning. Knowledge and diff checks passed.
- Independent review covered privacy/SQL/staff scope and found the in-flight queue selection race. Root reproduced/fixed it with a mounted component test; no blanket final independent-review claim is made after subagents became unavailable.
- Read-only production state confirms the primary migration and exact RPC source. Approved rollback verification uncovered a preexisting contracts/occupants RLS cycle. Prepared the minimal no-grant follow-up migration; persistent policy approval and a clean live rerun remain pending.
- Native visual QA attempted through isolated mocked components but blocked by computer-use `Transport closed`. Runtime stopped; representative screenshot gate remains open. Task3's combined automated/visual step is only partially complete despite its automated portion passing.
- Details: [verification.md](./verification.md). No accepted-deployment/archive claim is made for incomplete external gates.
