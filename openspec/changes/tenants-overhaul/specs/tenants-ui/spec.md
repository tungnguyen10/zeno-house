## ADDED Requirements

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

### Requirement: Tenants list bulk selection
`app/pages/tenants/index.vue` SHALL provide bulk selection in the list (checkbox per row, "select all on page" checkbox) for admin users. When at least one tenant is selected, a `TenantBulkActionsBar` SHALL appear with actions: "Khôi phục" (activate), "Lưu trữ" (archive), "Xoá nhiều" (delete). The bar SHALL show the selected count and a "Bỏ chọn" action.

#### Scenario: Show bulk bar when at least one selected
- **WHEN** admin selects 1 or more tenants
- **THEN** the TenantBulkActionsBar appears at the bottom with action buttons and count

#### Scenario: Bulk archive confirmation
- **WHEN** admin clicks "Lưu trữ" with 3 selected
- **THEN** a confirm modal appears listing the selected full_names; on confirm, POST `/api/tenants/bulk` runs with action `archive`

#### Scenario: Bulk delete confirmation with strong opt-in
- **WHEN** admin clicks "Xoá nhiều"
- **THEN** the confirm modal lists names (max 10 + "...và X khác"), includes a checkbox "Tôi hiểu thao tác này không thể hoàn tác", and the delete button is disabled until the checkbox is checked

#### Scenario: Manager does not see bulk selection
- **WHEN** user with role `manager` opens `/tenants`
- **THEN** no checkboxes are rendered and no bulk bar appears

#### Scenario: Partial-success result toast
- **WHEN** bulk delete returns `{ succeeded: ['a','b'], failed: [{id:'c', reason:'has_active_contracts'}] }`
- **THEN** a toast summarizes "Đã xoá 2 khách thuê, 1 bị bỏ qua" and a "Xem chi tiết" link opens a modal listing failures

---

### Requirement: Tenant detail hero with quick stats
`app/pages/tenants/[code]/index.vue` SHALL render a hero header containing the tenant `full_name`, `code`, status pill, phone, and email chips, and three quick stat tiles: active contracts count, current room link (if any), occupancy count.

#### Scenario: Quick stats render when active
- **WHEN** detail page loads a tenant with 1 active contract in room A101 and 2 occupancy records
- **THEN** the hero shows three tiles "1 hợp đồng", room link "A101", "2 lượt ở"

#### Scenario: Stats render archived state cleanly
- **WHEN** detail page loads a tenant with `status='archived'`
- **THEN** the hero displays a "Đã lưu trữ" pill in muted color next to the name

#### Scenario: Stats render with no current room
- **WHEN** detail page loads a tenant with no active contract
- **THEN** the current-room stat shows "Chưa ở phòng nào" without a link

---

### Requirement: Tenant detail sectioned layout
`app/pages/tenants/[code]/index.vue` SHALL organize the detail body into sections with anchor IDs: `#personal` (full_name, phone, email, dob, gender, occupation), `#id-document` (id_number, id_issued_date, id_issued_place), `#emergency` (emergency_contact_name, emergency_contact_phone, permanent_address), `#contracts` (active + historical contracts list with links), `#danger-zone` (Edit, Archive, Delete actions). Each section SHALL have a heading and short description.

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

---

### Requirement: Tenant edit route exists
`app/pages/tenants/[code]/edit.vue` SHALL exist and render the `TenantForm` pre-filled with the tenant data. On success it SHALL redirect to `/tenants/[code]`. Detail page edit button SHALL navigate to this route.

#### Scenario: Edit page loads with data
- **WHEN** admin navigates to `/tenants/[code]/edit`
- **THEN** the form is pre-filled with the tenant's current values

#### Scenario: Edit success redirects to detail
- **WHEN** admin saves the edit form successfully
- **THEN** the page navigates to `/tenants/[code]`

#### Scenario: Edit page enforces admin role
- **WHEN** user with role `manager` navigates to `/tenants/[code]/edit`
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
`app/components/tenants/TenantForm.vue` SHALL run field-level Zod validation on `blur` and re-validate on `input` only if the field already has an error. On submit, an error summary banner SHALL appear at the top of the form listing field labels with errors and clicking a summary item SHALL focus the corresponding field.

#### Scenario: Field validates on blur
- **WHEN** user focuses then leaves the `full_name` field empty
- **THEN** an inline error message appears under the field and the field gains red border styling

#### Scenario: Error summary on submit failure
- **WHEN** user submits the form with full_name and phone missing
- **THEN** a banner at the top lists "Họ tên", "Số điện thoại" as links, and clicking "Số điện thoại" scrolls to and focuses the phone input

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

### Requirement: Tenants form dirty-state guard
`app/pages/tenants/create.vue` and `app/pages/tenants/[code]/edit.vue` SHALL block navigation away when `useTenantForm().isDirty.value === true` unless the user confirms. The guard SHALL trigger on Vue Router navigation (`onBeforeRouteLeave`) and on browser unload (`beforeunload`).

#### Scenario: Confirm before leaving with unsaved changes
- **WHEN** user changes a field and clicks the back link
- **THEN** a confirm dialog appears asking to discard changes; canceling stays on the form

#### Scenario: No confirm when form is clean
- **WHEN** user navigates away without editing any field
- **THEN** no confirm appears and navigation proceeds

#### Scenario: beforeunload triggers browser native warning
- **WHEN** user tries to reload the page with isDirty=true
- **THEN** the browser shows its native "Leave site?" warning

---

### Requirement: Tenants form draft autosave with restore alert
`app/components/tenants/TenantForm.vue` SHALL display a restore alert at the top when `useTenantForm().hasDraft.value === true`. The alert SHALL show the draft timestamp and offer three actions: "Khôi phục" (calls `restoreDraft()`), "Bỏ qua" (dismisses alert), "Xoá bản nháp" (calls `clearDraft()`).

#### Scenario: Restore alert shown when draft exists
- **WHEN** user opens the create form and a draft exists in localStorage for the key
- **THEN** an alert banner appears at the top with the three actions

#### Scenario: Restore replaces current form values
- **WHEN** user clicks "Khôi phục"
- **THEN** form fields are replaced with the draft values and the alert disappears

#### Scenario: Draft persists across page reload
- **WHEN** user types changes, waits 600ms, then reloads the page
- **THEN** the restore alert appears on the new mount
