# rooms-ui Specification

## Purpose
TBD - created by archiving change rooms-overhaul. Update Purpose after archive.
## Requirements
### Requirement: Rooms list toolbar (search/filter/sort)
`app/pages/rooms/index.vue` SHALL render a `RoomListToolbar` component above the grid containing a debounced search input (250ms), a status filter (multi-select chips for `available`, `occupied`, `maintenance`, `archived`), a building selector (keeps existing), a floor filter, and a sort selector (`room_number`, `floor`, `monthly_rent`, `created_at`) with order toggle. Toolbar state SHALL be reflected in URL query (`?q`, `?status`, `?building_id`, `?floor`, `?sort`, `?order`) and restored from URL on mount.

#### Scenario: Search filters list by room_number / code / description
- **WHEN** admin types "a101" in the search box and waits 250ms
- **THEN** the list refetches with `?q=a101` and shows only rooms whose room_number, code, or description matches

#### Scenario: Status filter chips
- **WHEN** admin clicks the "Trống" chip
- **THEN** URL gains `?status=available` and the list shows only available rooms

#### Scenario: Multi-status filter
- **WHEN** admin selects both "Trống" and "Đang ở" chips
- **THEN** URL gains `?status=available&status=occupied` and the list shows both groups

#### Scenario: Sort selector
- **WHEN** admin picks "Giá thuê" and toggles to descending
- **THEN** URL gains `?sort=monthly_rent&order=desc` and the list reorders accordingly

#### Scenario: URL state restored on direct navigation
- **WHEN** user opens `/rooms?q=b&status=occupied&sort=room_number&order=asc`
- **THEN** the toolbar reflects those values and the list fetches with matching query

#### Scenario: Filter change resets pagination
- **WHEN** user is on page 3 and changes any filter/search/sort
- **THEN** the URL `?page` resets to `1` before refetching

---

### Requirement: Rooms list bulk selection
`app/pages/rooms/index.vue` SHALL provide bulk selection in the list (checkbox per card, "select all on page" checkbox) for admin users. When at least one room is selected, a `RoomBulkActionsBar` SHALL appear with actions: "Đánh dấu trống" (activate), "Bảo trì" (set_maintenance), "Lưu trữ" (archive), "Xoá nhiều" (delete). The bar SHALL show the selected count and a "Bỏ chọn" action.

#### Scenario: Show bulk bar when at least one selected
- **WHEN** admin selects 1 or more rooms
- **THEN** the RoomBulkActionsBar appears at the bottom with action buttons and count

#### Scenario: Bulk archive confirmation
- **WHEN** admin clicks "Lưu trữ" with 3 selected
- **THEN** a confirm modal appears listing the selected room numbers; on confirm, POST `/api/rooms/bulk` runs with action `archive`

#### Scenario: Bulk delete confirmation with strong opt-in
- **WHEN** admin clicks "Xoá nhiều"
- **THEN** the confirm modal lists room numbers (max 10 + "...và X khác"), includes a checkbox "Tôi hiểu thao tác này không thể hoàn tác", and the delete button is disabled until the checkbox is checked

#### Scenario: Manager does not see bulk selection
- **WHEN** user with role `manager` opens `/rooms`
- **THEN** no checkboxes are rendered and no bulk bar appears

#### Scenario: Partial-success result toast
- **WHEN** bulk delete returns `{ succeeded: ['a','b'], failed: [{id:'c', reason:'has_active_contracts'}] }`
- **THEN** a toast summarizes "Đã xoá 2 phòng, 1 phòng bị bỏ qua" and a "Xem chi tiết" link opens a modal listing failures

---

### Requirement: Room detail hero with quick stats
`app/pages/rooms/[code]/index.vue` SHALL render a hero header containing the room name (building name + room_number), code, status pill, floor + area chips, and three quick stat tiles: active contract status, occupant count, meter device count. Stats SHALL be derived from existing room DTO + contract/meter counts available in detail responses.

#### Scenario: Quick stats render with active contract
- **WHEN** detail page loads a room with active contract, 3 occupants, 2 meter devices
- **THEN** the hero shows three tiles "Đang thuê", "3 người", "2 đồng hồ"

#### Scenario: Stats render vacant state cleanly
- **WHEN** a room has no active contract
- **THEN** the contract stat shows "Trống" with a "Giao phòng" link beside it

#### Scenario: Hero shows status pill
- **WHEN** the room has `status='archived'`
- **THEN** the hero displays a "Đã lưu trữ" pill in muted color next to the room name

---

### Requirement: Room detail sectioned layout
`app/pages/rooms/[code]/index.vue` SHALL organize the detail body into sections with anchor IDs: `#overview` (basic info + canonical rent + building link), `#active-contract` (current contract summary + occupants + actions), `#meter-readings` (shortcut to monthly readings + last reading summary), `#contracts-history` (historical contracts list), `#danger-zone` (Edit, Archive, Delete actions). Each section SHALL have a heading and short description.

#### Scenario: Overview links to building
- **WHEN** detail page loads
- **THEN** the Overview section contains a link "Toà nhà: <name>" pointing to `/buildings/<slug>`

#### Scenario: Meter readings shortcut
- **WHEN** detail page loads
- **THEN** the Meter readings section contains a "Nhập chỉ số tháng này" button linking to the monthly operations workspace pre-filtered to this room

#### Scenario: Danger zone groups destructive actions
- **WHEN** admin scrolls to bottom of detail page
- **THEN** Edit, Archive (toggle to archived), and Delete buttons appear inside a card with a warning border tone

#### Scenario: Manager sees read-only sections
- **WHEN** user with role `manager` opens detail
- **THEN** the Danger zone section is hidden entirely; the Overview, Active contract, and Meter readings sections remain visible

#### Scenario: 409 conflict on delete shows soft-archive option
- **WHEN** admin clicks Delete and the API responds 409 with `{ activeContracts, meterReadings }`
- **THEN** an alert displays the counts and offers a "Lưu trữ thay vì xoá" button that calls DELETE with `?force=true`

---

### Requirement: Rooms form sectioned cards with numbered headings
`app/components/rooms/RoomForm.vue` SHALL render its four field groups as visually distinct cards. Each section SHALL have a numbered badge (1–4), a section title, and a one-line description. Sections SHALL be separated by `border-t border-dark-border` and consistent spacing. The four sections are:
1. **Vị trí** — `building_id`, `floor`, `room_number`.
2. **Trạng thái** — `status`.
3. **Giá thuê & diện tích** — `monthly_rent`, `area`.
4. **Mô tả** — `description`.

#### Scenario: Sections render with numbered badges
- **WHEN** form mounts
- **THEN** each of the four sections shows a circular cyan badge with the section number followed by the title text

---

### Requirement: Rooms form inline validation
`app/components/rooms/RoomForm.vue` SHALL run field-level Zod validation on `blur` and re-validate on `input` only if the field already has an error. On submit, the form SHALL reveal inline errors for every invalid field and SHALL focus the first invalid field.

#### Scenario: Field validates on blur
- **WHEN** user focuses then leaves the `room_number` field empty
- **THEN** an inline error message appears under the field and the field gains red border styling

#### Scenario: Inline errors on submit failure
- **WHEN** user submits the form with room_number and monthly_rent missing
- **THEN** inline errors are shown under both fields and focus moves to the first invalid input

#### Scenario: Error clears on valid input
- **WHEN** an inline error is showing for a field and user types a valid value
- **THEN** the inline error message disappears and the red border is removed

---

### Requirement: Rooms form sticky save bar on mobile
`app/components/rooms/RoomForm.vue` SHALL render a sticky bottom save bar on viewports `< md` (768px), containing the "Lưu" and "Huỷ" buttons, fixed to the bottom of the viewport. On `md+` viewports the existing inline footer remains. The sticky bar SHALL respect iOS safe-area inset.

#### Scenario: Sticky save bar visible on mobile
- **WHEN** form renders on a viewport `< md`
- **THEN** the save bar is `fixed bottom-0 left-0 right-0` with `pb-[max(0.75rem,env(safe-area-inset-bottom))]`

#### Scenario: Inline footer used on desktop
- **WHEN** form renders on a viewport `≥ md`
- **THEN** the sticky save bar is hidden and the inline footer holds Save/Cancel

---

### Requirement: Rooms form navigation behavior with drafts
`app/pages/rooms/create.vue` and `app/pages/rooms/[code]/edit.vue` SHALL allow users to leave the page immediately even when `useRoomForm().isDirty.value === true`. The pages SHALL NOT show a custom leave-confirm modal and SHALL NOT register a browser unload warning. Unsaved values rely on draft autosave and can be restored on revisit.

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

### Requirement: Rooms form draft autosave with restore alert
`app/components/rooms/RoomForm.vue` SHALL display a restore alert at the top when `useRoomForm().hasDraft.value === true`. The alert SHALL show the draft timestamp and offer three actions: "Khôi phục" (calls `restoreDraft()`), "Bỏ qua" (dismisses alert), "Xoá bản nháp" (calls `clearDraft()`).

#### Scenario: Restore alert shown when draft exists
- **WHEN** user opens the create form and a draft exists in localStorage for the key
- **THEN** an alert banner appears at the top with the three actions

#### Scenario: Restore replaces current form values
- **WHEN** user clicks "Khôi phục"
- **THEN** form fields are replaced with the draft values and the alert disappears

#### Scenario: Draft persists across page reload
- **WHEN** user types changes, waits 600ms, then reloads the page
- **THEN** the restore alert appears on the new mount

---

### Requirement: Room card supports selectable mode
`app/components/rooms/RoomCard.vue` SHALL accept optional props `selectable: boolean`, `selected: boolean`, and emit `toggle-select`. When `selectable=true`, a checkbox SHALL render in the corner of the card; clicking it emits `toggle-select`. When `selectable=false` (default), the card renders unchanged.

#### Scenario: Checkbox renders when selectable
- **WHEN** card mounts with `selectable=true`
- **THEN** a checkbox is visible in the top-right corner

#### Scenario: Toggle event emitted
- **WHEN** user clicks the checkbox
- **THEN** the component emits `toggle-select` with no payload

#### Scenario: Non-selectable mode unchanged
- **WHEN** card mounts with `selectable=false` (default)
- **THEN** no checkbox is rendered and the layout matches existing behavior

