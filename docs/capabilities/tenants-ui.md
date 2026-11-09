---
type: Capability Specification
title: "tenants-ui"
status: stable
tags: [capability, requirements]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/specs/tenants-ui/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

# tenants-ui Specification

## Purpose
TBD - created by archiving change tenants-overhaul. Update Purpose after archive.
## Requirements
### Requirement: Tenants list toolbar (search/filter/sort)
`app/pages/tenants/index.vue` SHALL render a `TenantListToolbar` component above the list containing a debounced search input (250ms), a status filter (multi-select chips for `active`, `archived`), a building selector (keeps existing), a contract-state selector (keeps existing — `with_contract`, `without_contract`, all), and a sort selector (`full_name`, `created_at`, `code`) with order toggle. Toolbar state SHALL be reflected in URL query (`?q`, `?status`, `?building_id`, `?contract_state`, `?sort`, `?order`) and restored from URL on mount.

#### Scenario: Search filters list across fields
- **WHEN** admin types "nguyen" in the search box and waits 250ms
- **THEN** the list refetches with `?q=nguyen` and shows only tenants whose full_name, phone, email, id_number, or code matches

#### Scenario: Status filter chips
- **WHEN** admin clicks the "Đang hoạt động" chip
- **THEN** URL gains `?status=active` and the list shows only active tenants

#### Scenario: Multi-status filter
- **WHEN** admin selects both "Đang hoạt động" and "Đã lưu trữ" chips
- **THEN** URL gains `?status=active&status=archived` and the list shows both groups

#### Scenario: Sort selector
- **WHEN** admin picks "Tên" and toggles to ascending
- **THEN** URL gains `?sort=full_name&order=asc` and the list reorders accordingly

#### Scenario: URL state restored on direct navigation
- **WHEN** user opens `/tenants?q=tran&status=active&sort=created_at&order=desc`
- **THEN** the toolbar reflects those values and the list fetches with matching query

#### Scenario: Filter change resets pagination
- **WHEN** user is on page 3 and changes any filter/search/sort
- **THEN** the URL `?page` resets to `1` before refetching

---

### Requirement: Tenants list roommate indicator
`app/pages/tenants/index.vue` SHALL keep the existing contract-state badge (`Có HĐ` / `Chưa có HĐ`) and render an additional `Ở chung` badge when the tenant is an active roommate occupant (`activeAssignment.assignmentRole === 'roommate'`).

Roommate rows SHALL also display context text `Ở chung với <primaryTenantName>` when `primaryTenantName` is available.

#### Scenario: Roommate badge appears for active occupant
- **WHEN** a tenant row has `activeAssignment.assignmentRole = 'roommate'`
- **THEN** the row shows badges `Có HĐ` and `Ở chung`

#### Scenario: Primary contract holder does not show roommate badge
- **WHEN** a tenant row has `activeAssignment.assignmentRole = 'primary'`
- **THEN** the row shows `Có HĐ` without `Ở chung`

#### Scenario: Roommate context text includes contract holder name
- **WHEN** a roommate row has `activeAssignment.primaryTenantName = 'Nguyễn Văn A'`
- **THEN** the row displays `Ở chung với Nguyễn Văn A`

---

### Requirement: Tenants list bulk selection
`app/pages/tenants/index.vue` SHALL provide bulk selection in the list (checkbox per row, "select all on page" checkbox) for users with the existing `tenants.delete` capability. When at least one tenant is selected, a `TenantBulkActionsBar` SHALL appear with actions: "Khôi phục" (activate), "Lưu trữ" (archive), "Xoá nhiều" (delete). The bar SHALL show the selected count and a "Bỏ chọn" action.

#### Scenario: Show bulk bar when at least one selected
- **WHEN** admin selects 1 or more tenants
- **THEN** the TenantBulkActionsBar appears at the bottom with action buttons and count

#### Scenario: Bulk archive confirmation
- **WHEN** admin clicks "Lưu trữ" with 3 selected
- **THEN** a confirm modal appears listing the selected full_names; on confirm, POST `/api/tenants/bulk` runs with action `archive`

#### Scenario: Bulk delete confirmation with strong opt-in
- **WHEN** admin clicks "Xoá nhiều"
- **THEN** the confirm modal lists names (max 10 + "...và X khác"), includes a reason textarea and a checkbox "Tôi hiểu thao tác này không thể hoàn tác"
- **AND** the delete button is disabled until both the checkbox is checked and reason is non-empty

#### Scenario: Manager does not see bulk selection
- **WHEN** user with role `manager` opens `/tenants`
- **THEN** no checkboxes are rendered and no bulk bar appears

#### Scenario: Partial-success result toast
- **WHEN** bulk delete returns `{ succeeded: ['a','b'], failed: [{id:'c', reason:'has_active_contracts'}] }`
- **THEN** a toast summarizes “Đã xoá 2 khách, 1 thất bại” and the inline result retains both counts, groups Vietnamese failure reasons, and offers “Xem chi tiết” for individual failures

#### Scenario: Bulk action refreshes latest filtered list
- **WHEN** any bulk action completes (full success or partial success)
- **THEN** the page clears selected ids and refetches the keyed tenant list so current filters render latest data from server

---

### Requirement: Tenant detail hero with quick stats
`app/pages/tenants/[code]/index.vue` SHALL render a hero header for full-access tenants containing the tenant `full_name`, `code`, status pill, phone, and email chips, and three quick stat tiles: active contracts count, current room link (if any), occupancy count.

When the tenant is currently a roommate (`activeAssignment.assignmentRole === 'roommate'`), the detail page SHALL show who they are living with and SHALL not show the "+ Thêm" contract action.

#### Scenario: Quick stats render when active
- **WHEN** detail page loads a tenant with 1 active contract in room A101 and 2 occupancy records
- **THEN** the hero shows three tiles "1 hợp đồng", room link "A101", "2 lượt ở"

#### Scenario: Stats render archived state cleanly
- **WHEN** detail page loads a tenant with `status='archived'`
- **THEN** the hero displays a "Đã lưu trữ" pill in muted color next to the name

#### Scenario: Stats render with no current room
- **WHEN** detail page loads a tenant with no active contract
- **THEN** the current-room stat shows "Chưa ở phòng nào" without a link

#### Scenario: Roommate detail shows primary tenant context
- **WHEN** detail page loads a tenant with `activeAssignment.assignmentRole = 'roommate'` and `primaryTenantName = 'Nguyễn Văn A'`
- **THEN** the page shows context text equivalent to `Đang ở chung với Nguyễn Văn A` and includes room/building information

#### Scenario: Roommate cannot add contract from detail CTA
- **WHEN** detail page loads a tenant with `activeAssignment.assignmentRole = 'roommate'`
- **THEN** the contracts section hides the "+ Thêm" action and shows guidance that the roommate relation must be removed first

---

### Requirement: Tenant detail sectioned layout
`app/pages/tenants/[code]/index.vue` SHALL organize the full-access detail body into sections with anchor IDs: `#personal` (full_name, phone, email, dob, gender, occupation), `#id-document` (id_number, id_issued_date, id_issued_place), `#emergency` (emergency_contact_name, emergency_contact_phone, permanent_address), `#contracts` (active + historical contracts list with links), `#danger-zone` (Edit, Archive, Delete actions). Each section SHALL have a heading and short description.

#### Scenario: Contracts section lists active and historical
- **WHEN** detail page loads
- **THEN** the Contracts section shows the active contract first (if any) with status pill and then historical contracts grouped by year

#### Scenario: Danger zone groups destructive actions
- **WHEN** admin scrolls to bottom of detail page
- **THEN** Edit, Archive (toggle to archived), and Delete buttons appear inside a card with a warning border tone

#### Scenario: Manager sees read-only sections
- **WHEN** user with role `manager` opens detail
- **THEN** the Danger zone section is hidden entirely; other sections remain visible

#### Scenario: 409 conflict on delete shows soft-archive option
- **WHEN** admin clicks Delete and the API responds 409 with `{ activeContracts, activeOccupancies }`
- **THEN** an alert displays the counts and offers a "Lưu trữ thay vì xoá" button that calls DELETE with `?force=true`

#### Scenario: Danger-zone delete requires reason
- **WHEN** admin opens the delete/archive confirmation in danger zone
- **THEN** submit stays disabled until a non-empty reason is entered

---

### Requirement: Tenant edit route exists
`app/pages/tenants/[code]/edit.vue` SHALL exist and render the `TenantForm` pre-filled with the tenant data. On success it SHALL redirect to `/tenants/[code]`. Detail page edit button SHALL navigate to this route.

#### Scenario: Edit page loads with data
- **WHEN** admin navigates to `/tenants/[code]/edit`
- **THEN** the form is pre-filled with the tenant's current values

#### Scenario: Edit success redirects to detail
- **WHEN** admin saves the edit form successfully
- **THEN** the page navigates to `/tenants/[code]`

#### Scenario: Edit page enforces update capability
- **WHEN** user without the update capability navigates to `/tenants/[code]/edit`
- **THEN** route guard redirects them or shows a 403 page

---

### Requirement: Tenants form sectioned cards with numbered headings
`app/components/tenants/TenantForm.vue` SHALL render its field groups as visually distinct cards. Each section SHALL have a numbered badge (1–4), a section title, and a one-line description. Sections SHALL be separated by `border-t border-dark-border` and consistent spacing. The four sections are:
1. **Thông tin cá nhân** — `full_name`, `phone`, `email`, `date_of_birth`, `gender`, `occupation`.
2. **Giấy tờ tuỳ thân** — `id_number`, `id_issued_date`, `id_issued_place`.
3. **Liên hệ khẩn cấp & Địa chỉ** — `emergency_contact_name`, `emergency_contact_phone`, `permanent_address`.
4. **Ghi chú** — `notes`.

#### Scenario: Sections render with numbered badges
- **WHEN** form mounts
- **THEN** each of the four sections shows a circular cyan badge with the section number followed by the title text

---

### Requirement: Tenants form inline validation
`app/components/tenants/TenantForm.vue` SHALL run field-level Zod validation on `blur` and re-validate on `input` only if the field already has an error. On submit, the form SHALL reveal inline errors for every invalid field and SHALL focus the first invalid field.

#### Scenario: Field validates on blur
- **WHEN** user focuses then leaves the `full_name` field empty
- **THEN** an inline error message appears under the field and the field gains red border styling

#### Scenario: Inline errors on submit failure
- **WHEN** user submits the form with full_name and phone missing
- **THEN** inline errors are shown under both fields and focus moves to the first invalid input

#### Scenario: Error clears on valid input
- **WHEN** an inline error is showing for a field and user types a valid value
- **THEN** the inline error message disappears and the red border is removed

---

### Requirement: Tenants form sticky save bar on mobile
`app/components/tenants/TenantForm.vue` SHALL render a sticky bottom save bar on viewports `< md` (768px), containing the "Lưu" and "Huỷ" buttons, fixed to the bottom of the viewport. On `md+` viewports the existing inline footer remains. The sticky bar SHALL respect iOS safe-area inset.

#### Scenario: Sticky save bar visible on mobile
- **WHEN** form renders on a viewport `< md`
- **THEN** the save bar is `fixed bottom-0 left-0 right-0` with `pb-[max(0.75rem,env(safe-area-inset-bottom))]`

#### Scenario: Inline footer used on desktop
- **WHEN** form renders on a viewport `≥ md`
- **THEN** the sticky save bar is hidden and the inline footer holds Save/Cancel

---

### Requirement: Tenants form navigation behavior with drafts
`app/pages/tenants/create.vue` and `app/pages/tenants/[code]/edit.vue` SHALL allow users to leave the page immediately even when `useTenantForm().isDirty.value === true`. The pages SHALL NOT show a custom leave-confirm modal and SHALL NOT register a browser unload warning. Unsaved values rely on draft autosave and can be restored on revisit.

#### Scenario: Leaving while dirty proceeds immediately
- **WHEN** user changes a field and clicks the back link
- **THEN** navigation continues without any confirm dialog

#### Scenario: Clean form navigation still proceeds
- **WHEN** user navigates away without editing any field
- **THEN** navigation proceeds normally

#### Scenario: Browser reload does not show unsaved warning
- **WHEN** user tries to reload the page with isDirty=true
- **THEN** no native "Leave site?" warning is shown

---

### Requirement: Tenants form draft autosave with restore alert
`app/components/tenants/TenantForm.vue` SHALL display a restore alert at the top when `useTenantForm().hasDraft.value === true`. Draft presence SHALL be evaluated after client mount so initial SSR and hydration markup stays aligned. The alert SHALL show the draft timestamp and offer three actions: "Khôi phục" (calls `restoreDraft()`), "Bỏ qua" (dismisses alert), "Xoá bản nháp" (calls `clearDraft()`).

#### Scenario: Restore alert shown when draft exists
- **WHEN** user opens the create form and a draft exists in localStorage for the key
- **THEN** an alert banner appears at the top with the three actions

#### Scenario: Hydration-safe first render
- **WHEN** server renders tenant create/edit form and client hydrates the page
- **THEN** the initial render does not diverge based on localStorage draft presence
- **AND** draft alert visibility is computed after mount

#### Scenario: Restore replaces current form values
- **WHEN** user clicks "Khôi phục"
- **THEN** form fields are replaced with the draft values and the alert disappears

#### Scenario: Draft persists across page reload
- **WHEN** user types changes, waits 600ms, then reloads the page
- **THEN** the restore alert appears on the new mount


### Requirement: Basic-access read-only tenant UI
The dashboard SHALL consume the server's explicit `accessLevel`. For `basic`, detail SHALL show
an existing info `UiAlert` with: “Khách thuê hiện không thuộc tòa nhà bạn quản lý. Bạn chỉ xem
được thông tin cơ bản và lịch sử hợp đồng tại tòa của mình.” The basic hero SHALL show only
name, code, phone, and status; private contact/identity fields, current assignment and quick
metrics SHALL be absent even if stale fields remain in memory. Scoped contract history SHALL
remain available. Basic list rows SHALL indicate “Chỉ xem cơ bản” and SHALL NOT infer absent
assignment data as “Chưa có HĐ”.

Basic detail SHALL hide edit, document, archive/delete and all Portal-account controls and
SHALL NOT fetch Portal account status. Direct basic edit navigation SHALL not mount a form.
Existing capabilities SHALL still gate full controls. Loading/error refresh and access
downgrades SHALL prevent mutation handlers and close destructive confirmations. Async edit
submission SHALL recheck access before subsequent identity-image requests.

#### Scenario: Basic profile with stale sensitive fields
- **WHEN** a basic DTO still has old identity fields or assignment data in client memory
- **THEN** no private profile, roommate context, current-room metrics, document links, edit or destructive controls render
- **AND** the scoped contract history remains accessible without a Portal status request

#### Scenario: Direct basic edit navigation
- **WHEN** a basic-only operator opens the tenant edit URL
- **THEN** the read-only info alert appears and no form or identity-image controls mount

#### Scenario: Full access changes during refresh
- **WHEN** a previously full tenant refreshes or becomes basic
- **THEN** edit and destructive actions are unavailable and pending action handlers cannot start further requests

### Requirement: Truthful grouped tenant bulk feedback
Bulk results SHALL retain both successful and failed counts. Failures SHALL be grouped with
Vietnamese labels: forbidden “Ngoài phạm vi quản lý”, conflict “Dữ liệu vừa thay đổi, hãy thử
lại”, not_found “Không tìm thấy”, has_active_contracts “Đang có hợp đồng”, and
has_active_occupancies “Đang ở ghép”. Unknown reasons SHALL use a generic Vietnamese message
rather than exposing raw server codes. The detail modal SHALL retain per-tenant failures.

#### Scenario: Partial bulk result with unknown failure
- **WHEN** one tenant succeeds and three fail, two forbidden and one unknown
- **THEN** the result displays one success, three failures, a forbidden group of two, and one generic error
- **AND** raw unknown reason codes do not render


### Requirement: Safe tenant drafts and identity feedback
Tenant form drafts SHALL omit `id_number`, `id_issued_date`, `id_issued_place`, `date_of_birth`, `permanent_address`, `emergency_contact_name`, and `emergency_contact_phone`. Reading an existing draft SHALL purge those keys from storage while retaining its timestamp; restoring safe fields SHALL preserve current sensitive form values. Safe fields continue to autosave and restore.

`TENANT_DUPLICATE` field errors SHALL render under the corresponding inputs. Generic identity conflicts SHALL render only the form alert. Rate-limit alerts SHALL include the supplied retry interval. Import previews SHALL compare canonical phone/ID values while retaining the original row presentation.

#### Scenario: Restore a legacy sensitive draft
- **WHEN** a user opens and restores an old tenant draft containing identity fields
- **THEN** those fields are removed from storage and are not restored into the form

#### Scenario: Generic identity error
- **WHEN** the server returns `TENANT_IDENTITY_CONFLICT`
- **THEN** the form displays the generic alert without marking an identity field

Implementation and production rollout evidence: [tenant identity hardening](../changes/harden-tenant-identity-data/index.md). Database rollout remains a separate acceptance gate.
