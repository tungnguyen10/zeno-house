# contracts-ui Specification

## Purpose
TBD - created by archiving change contracts-overhaul. Update Purpose after archive.
## Requirements
### Requirement: Contracts list toolbar (search/filter/sort)
`app/pages/contracts/index.vue` SHALL render a `ContractListToolbar` component above the list containing a debounced search input (250ms — contract_code / tenant name / room number), a status filter (multi-select chips for `active`, `expired`, `terminated`, `renewed`), a building selector (keeps existing), and a sort selector (`start_date`, `end_date`, `created_at`, `monthly_rent`) with order toggle. Toolbar state SHALL be reflected in URL query (`?q`, `?status`, `?building_id`, `?sort`, `?order`) and restored from URL on mount.

#### Scenario: Search filters list across code / tenant / room
- **WHEN** admin types "A101" in the search box and waits 250ms
- **THEN** the list refetches with `?q=A101` and shows only contracts whose contract_code, primary tenant name, or room number matches

#### Scenario: Status filter chips
- **WHEN** admin clicks the "Đang chạy" chip
- **THEN** URL gains `?status=active` and the list shows only active contracts

#### Scenario: Multi-status filter
- **WHEN** admin selects both "Đang chạy" and "Hết hạn" chips
- **THEN** URL gains `?status=active&status=expired` and the list shows both groups

#### Scenario: Sort selector
- **WHEN** admin picks "Ngày bắt đầu" and toggles to descending
- **THEN** URL gains `?sort=start_date&order=desc` and the list reorders accordingly

#### Scenario: URL state restored on direct navigation
- **WHEN** user opens `/contracts?q=tran&status=active&sort=start_date&order=desc`
- **THEN** the toolbar reflects those values and the list fetches with matching query

#### Scenario: Filter change resets pagination
- **WHEN** user is on page 3 and changes any filter/search/sort
- **THEN** the URL `?page` resets to `1` before refetching

---

### Requirement: Contracts list bulk selection
`app/pages/contracts/index.vue` SHALL provide bulk selection in the list (checkbox per row, "select all on page" checkbox) for admin users. When at least one contract is selected, a `ContractBulkActionsBar` SHALL appear with actions: "Kết thúc" (terminate), "Xoá nhiều" (delete). The bar SHALL show the selected count and a "Bỏ chọn" action.

#### Scenario: Show bulk bar when at least one selected
- **WHEN** admin selects 1 or more contracts
- **THEN** the ContractBulkActionsBar appears at the bottom with action buttons and count

#### Scenario: Bulk terminate confirmation with reason
- **WHEN** admin clicks "Kết thúc" with 3 active contracts selected
- **THEN** a confirm modal appears listing the selected contract codes + a textarea for reason; on confirm, POST `/api/contracts/bulk` runs with action `terminate` and the reason

#### Scenario: Bulk delete confirmation with strong opt-in
- **WHEN** admin clicks "Xoá nhiều"
- **THEN** the confirm modal lists contract codes (max 10 + "...và X khác"), includes a checkbox "Tôi hiểu thao tác này không thể hoàn tác và chỉ áp dụng cho hợp đồng không có dữ liệu hoá đơn", and the delete button is disabled until the checkbox is checked

#### Scenario: Manager does not see bulk selection
- **WHEN** user with role `manager` opens `/contracts`
- **THEN** no checkboxes are rendered and no bulk bar appears

#### Scenario: Partial-success result toast
- **WHEN** bulk delete returns `{ succeeded: ['a'], failed: [{id:'b', reason:'has_billing_history'}, {id:'c', reason:'ACTIVE_CONTRACT'}] }`
- **THEN** a toast summarizes "Đã xoá 1 hợp đồng, 2 bị bỏ qua" and a "Xem chi tiết" link opens a modal listing failures with reason labels

---

### Requirement: Contract detail hero with quick stats
`app/pages/contracts/[code]/index.vue` SHALL render a hero header containing `contract_code`, status pill, building → room → tenant breadcrumb, and four quick stat tiles: tenant name link, room link, months elapsed, total paid amount + deposit balance.

#### Scenario: Quick stats render with values
- **WHEN** detail page loads a contract with tenant "Nguyễn Văn A", room "A101", 5 months elapsed, 10,000,000đ paid, 3,000,000đ deposit balance
- **THEN** the hero shows the four tiles with these values and tenant/room as clickable links

#### Scenario: Hero shows status pill
- **WHEN** the contract has `status='terminated'`
- **THEN** the hero displays a "Đã kết thúc" pill in red/muted color next to the code

#### Scenario: Hero action buttons reflect status
- **WHEN** detail page loads an active contract
- **THEN** the hero shows "Gia hạn" and "Kết thúc sớm" action buttons

#### Scenario: Hero action buttons hidden for non-active
- **WHEN** detail page loads a terminated or expired contract
- **THEN** the action buttons "Gia hạn" and "Kết thúc sớm" are hidden (only "Tạo hợp đồng mới" link is shown when applicable)

---

### Requirement: Contract detail sectioned layout
`app/pages/contracts/[code]/index.vue` SHALL organize the detail body into sections with anchor IDs (preserving existing tab content): `#overview` (dates, rent, deposit, payment_day, terms), `#occupants` (current + history list with add/move-out actions), `#payments` (list + add), `#services` (list + edit), `#renewals` (history + renew button), `#meter-readings` (link to meter workspace + handover summary), `#danger-zone` (Edit, Terminate, Delete actions). A sticky horizontal tab nav SHALL allow jumping to each section.

#### Scenario: Sticky tab nav renders
- **WHEN** detail page loads
- **THEN** a horizontal tab nav is sticky at the top below the hero containing one tab per section; clicking a tab scrolls to its anchor

#### Scenario: Danger zone groups destructive actions
- **WHEN** admin scrolls to the danger zone section
- **THEN** Edit, Terminate (with confirm), and Delete buttons appear inside a card with a warning border tone

#### Scenario: Manager sees read-only sections
- **WHEN** user with role `manager` opens detail
- **THEN** the Danger zone section is hidden entirely; other sections are read-only (no add/edit buttons)

#### Scenario: 409 conflict on delete shows soft-delete option
- **WHEN** admin clicks Delete and the API responds 409 with details
- **THEN** an alert displays which checks blocked deletion (active / billing / payment / readings) with specific counts; if only the active-contract check blocks, offer a "Kết thúc rồi xoá" button calling DELETE with `?force=true`

---

### Requirement: Contracts create wizard with progress indicator
`app/pages/contracts/create.vue` SHALL render a 3-step wizard with a progress indicator (`ContractWizardSteps` component) at the top: 1. Hợp đồng → 2. Khách ở cùng → 3. Dịch vụ. The current step SHALL be highlighted; completed steps SHALL show a check mark. Forward navigation SHALL only proceed when the current step is valid; back navigation SHALL be free.

#### Scenario: Progress indicator highlights current step
- **WHEN** user is on step 2
- **THEN** step 1 shows a check mark, step 2 is highlighted, step 3 is muted

#### Scenario: Forward blocked when current step invalid
- **WHEN** user clicks "Tiếp" on step 1 with required fields missing
- **THEN** validation errors render and navigation does not advance

#### Scenario: Back navigation always allowed
- **WHEN** user clicks "Quay lại" from step 3
- **THEN** they return to step 2 without confirmation (within-wizard nav)

---

### Requirement: Contracts edit form sectioned cards with numbered headings
`app/components/contracts/ContractForm.vue` (in edit mode) SHALL render its field groups as visually distinct cards. Each section SHALL have a numbered badge (1–4), a section title, and a one-line description. Sections SHALL be separated by `border-t border-dark-border` and consistent spacing. The four sections are:
1. **Quan hệ** — `room`, `tenant` (readonly when `status='active'`).
2. **Thời hạn & Giá** — `start_date`, `end_date`, `payment_day`, `monthly_rent`, `deposit`.
3. **Điều khoản** — `occupant_count`, `discounts[]`, `surcharges[]`.
4. **Trạng thái & Ghi chú** — `status` (limited transitions per state machine), `notes`.

#### Scenario: Sections render with numbered badges
- **WHEN** edit form mounts
- **THEN** each of the four sections shows a circular cyan badge with the section number followed by the title text

#### Scenario: Room and tenant readonly when active
- **WHEN** edit form loads a contract with `status='active'`
- **THEN** the room and tenant fields render as disabled inputs with a helper note "Hợp đồng đang chạy — không thể đổi phòng hoặc khách thuê"

---

### Requirement: Contracts form inline validation
`app/components/contracts/ContractForm.vue` SHALL run field-level Zod validation on `blur` and re-validate on `input` only if the field already has an error. On submit, an error summary banner SHALL appear at the top of the form listing field labels with errors and clicking a summary item SHALL focus the corresponding field.

#### Scenario: Field validates on blur
- **WHEN** user focuses then leaves the `start_date` field empty
- **THEN** an inline error message appears under the field and the field gains red border styling

#### Scenario: Error summary on submit failure
- **WHEN** user submits the form with start_date and monthly_rent missing
- **THEN** a banner at the top lists "Ngày bắt đầu", "Giá thuê / tháng" as links, and clicking "Giá thuê / tháng" scrolls to and focuses the rent input

#### Scenario: Error clears on valid input
- **WHEN** an inline error is showing for a field and user types a valid value
- **THEN** the inline error message disappears and the red border is removed

---

### Requirement: Contracts form sticky save bar on mobile
`app/components/contracts/ContractForm.vue` SHALL render a sticky bottom save bar on viewports `< md` (768px), containing "Lưu" and "Huỷ" (edit mode) or "Tiếp" / "Quay lại" (wizard step nav). On `md+` viewports the existing inline footer remains. The sticky bar SHALL respect iOS safe-area inset.

#### Scenario: Sticky save bar visible on mobile
- **WHEN** form renders on a viewport `< md`
- **THEN** the save bar is `fixed bottom-0 left-0 right-0` with `pb-[max(0.75rem,env(safe-area-inset-bottom))]`

#### Scenario: Inline footer used on desktop
- **WHEN** form renders on a viewport `≥ md`
- **THEN** the sticky save bar is hidden and the inline footer holds Save/Cancel or Tiếp/Quay lại

---

### Requirement: Contracts form dirty-state guard
`app/pages/contracts/create.vue` and `app/pages/contracts/[code]/edit.vue` SHALL block navigation away when `useContractForm().isDirty.value === true` unless the user confirms. The guard SHALL trigger on Vue Router navigation (`onBeforeRouteLeave`) and on browser unload (`beforeunload`). Within-wizard step navigation SHALL NOT trigger the guard (only leaving the wizard route).

#### Scenario: Confirm before leaving with unsaved changes
- **WHEN** user changes a field and clicks the back link out of `/contracts/create`
- **THEN** a confirm dialog appears asking to discard changes; canceling stays on the wizard

#### Scenario: No confirm when navigating within wizard steps
- **WHEN** user moves from step 1 to step 2 with the wizard step nav
- **THEN** no confirm appears; the wizard advances

#### Scenario: beforeunload triggers browser native warning
- **WHEN** user tries to reload the page with isDirty=true
- **THEN** the browser shows its native "Leave site?" warning

---

### Requirement: Contracts form draft autosave with restore alert
`app/components/contracts/ContractForm.vue` SHALL display a restore alert at the top when `useContractForm().hasDraft.value === true`. The alert SHALL show the draft timestamp and offer three actions: "Khôi phục" (calls `restoreDraft()`), "Bỏ qua" (dismisses alert), "Xoá bản nháp" (calls `clearDraft()`). For the create wizard, restoring SHALL also restore the `currentStep`, pending occupants, and selected services.

#### Scenario: Restore alert shown when draft exists
- **WHEN** user opens the create wizard and a draft exists in localStorage for the key
- **THEN** an alert banner appears at the top with the three actions

#### Scenario: Restore replaces wizard state
- **WHEN** user clicks "Khôi phục" on a wizard draft saved at step 2 with 2 pending occupants
- **THEN** form fields are replaced with the draft values, the wizard navigates to step 2, and the 2 pending occupants are loaded

#### Scenario: Draft persists across page reload
- **WHEN** user types changes, waits 600ms, then reloads the page
- **THEN** the restore alert appears on the new mount

#### Scenario: Mismatched draft version
- **WHEN** restore detects the stored `draftVersion` differs from current code version
- **THEN** the alert text reads "Bản nháp cũ không tương thích — chỉ có thể xoá" and only the "Xoá bản nháp" action remains active

