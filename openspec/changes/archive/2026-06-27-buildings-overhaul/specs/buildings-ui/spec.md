## ADDED Requirements

### Requirement: Buildings list toolbar (search/filter/sort)
`app/pages/buildings/index.vue` SHALL render a `BuildingListToolbar` component above the grid containing a debounced search input (250ms), a status filter (multi-select chips for `active`, `inactive`), and a sort selector (options: name, created date, room count) with order toggle. Toolbar state SHALL be reflected in URL query (`?q`, `?status`, `?sort`, `?order`) and restored from URL on mount.

#### Scenario: Search filters list by name/address/code
- **WHEN** admin types "sunrise" in the search box and waits 250ms
- **THEN** the list refetches with `?q=sunrise` and shows only buildings whose name, address, or code matches

#### Scenario: Status filter chips
- **WHEN** admin clicks the "Đang hoạt động" chip
- **THEN** URL gains `?status=active` and the list shows only active buildings

#### Scenario: Multi-status filter
- **WHEN** admin selects both "Đang hoạt động" and "Đã lưu trữ" chips
- **THEN** URL gains `?status=active&status=inactive` and the list shows both groups

#### Scenario: Sort selector
- **WHEN** admin picks "Số phòng" and toggles to descending
- **THEN** URL gains `?sort=total_rooms&order=desc` and the list reorders accordingly

#### Scenario: URL state restored on direct navigation
- **WHEN** user opens `/buildings?q=toa&status=active&sort=name&order=asc`
- **THEN** the toolbar reflects those values and the list fetches with matching query

#### Scenario: Filter change resets pagination
- **WHEN** user is on page 3 and changes any filter/search/sort
- **THEN** the URL `?page` resets to `1` before refetching

---

### Requirement: Buildings list bulk selection
`app/pages/buildings/index.vue` SHALL provide bulk selection in the list (checkbox per card, "select all on page" checkbox) for admin users. When at least one building is selected, a `BuildingBulkActionsBar` SHALL appear with actions: "Đánh dấu hoạt động", "Lưu trữ", "Xoá nhiều". The bar SHALL show the selected count and a "Bỏ chọn" action.

#### Scenario: Show bulk bar when at least one selected
- **WHEN** admin selects 1 or more buildings
- **THEN** the BuildingBulkActionsBar appears at the bottom with action buttons and count

#### Scenario: Bulk archive confirmation
- **WHEN** admin clicks "Lưu trữ" with 3 selected
- **THEN** a confirm modal appears listing the selected building names; on confirm, POST `/api/buildings/bulk` runs

#### Scenario: Bulk delete confirmation with strong opt-in
- **WHEN** admin clicks "Xoá nhiều"
- **THEN** the confirm modal lists names (max 10 + "...và X khác"), includes a checkbox "Tôi hiểu thao tác này không thể hoàn tác", and the delete button is disabled until the checkbox is checked

#### Scenario: Manager does not see bulk selection
- **WHEN** user with role `manager` opens `/buildings`
- **THEN** no checkboxes are rendered and no bulk bar appears

#### Scenario: Partial-success result toast
- **WHEN** bulk delete returns `{ succeeded: [a,b], failed: [{id:c, reason:'has_active_contracts'}] }`
- **THEN** a toast summarizes "Đã xoá 2 toà, 1 toà bị bỏ qua" and a "Xem chi tiết" link opens a modal listing failures

---

### Requirement: Building detail hero with quick stats
`app/pages/buildings/[id]/index.vue` SHALL render a hero header containing the building name, code, status pill, address line, and three quick stat tiles: total rooms, occupied rooms, active services. Stats SHALL be derived from existing building DTO + room/contract counts available in the detail response.

#### Scenario: Quick stats render with data
- **WHEN** detail page loads a building with 12 rooms, 9 occupied, 4 active services
- **THEN** the hero shows three tiles "12 phòng", "9 đang ở", "4 dịch vụ"

#### Scenario: Stats render zero state cleanly
- **WHEN** a building has 0 rooms
- **THEN** the room stat shows "0 phòng" with a subtle "Thêm phòng" link beside it

#### Scenario: Hero shows status pill
- **WHEN** the building has `status=inactive`
- **THEN** the hero displays a "Đã lưu trữ" pill in muted color next to the name

---

### Requirement: Building detail sectioned layout
`app/pages/buildings/[id]/index.vue` SHALL organize the detail body into four sections with anchor IDs: `#overview` (basic info + owner + billing config), `#services` (existing fast service toggles + summary), `#operations` (links to rooms, contracts, meter readings of this building), `#danger-zone` (Edit, Archive, Delete actions). Each section SHALL have a heading and short description.

#### Scenario: Operations section shows shortcuts
- **WHEN** detail page loads
- **THEN** the Operations section contains link buttons: "Xem phòng (12)", "Xem hợp đồng (9)", "Đọc đồng hồ tháng này"

#### Scenario: Danger zone groups destructive actions
- **WHEN** admin scrolls to bottom of detail page
- **THEN** Edit, Archive (toggle to inactive), and Delete buttons appear inside a card with a warning border tone

#### Scenario: Manager sees read-only sections
- **WHEN** user with role `manager` opens detail
- **THEN** the Danger zone section is hidden entirely; Operations links still visible

---

### Requirement: Buildings form sectioned cards with numbered headings
`app/components/buildings/BuildingForm.vue` SHALL render its four field groups (basic info, owner, billing defaults, schedule) as visually distinct cards. Each section SHALL have a numbered badge (1–4), a section title, and a one-line description. Sections SHALL be separated by `border-t border-dark-border` and consistent spacing.

#### Scenario: Sections render with numbered badges
- **WHEN** form mounts
- **THEN** each of the four sections shows a circular cyan badge with the section number followed by the title text

---

### Requirement: Buildings form inline validation
`app/components/buildings/BuildingForm.vue` SHALL run field-level Zod validation on `blur` and re-validate on `input` only if the field already has an error. On submit, an error summary banner SHALL appear at the top of the form listing field labels with errors and clicking a summary item SHALL focus the corresponding field.

#### Scenario: Field validates on blur
- **WHEN** user focuses then leaves the `name` field empty
- **THEN** an inline error message appears under the field and the field gains red border styling

#### Scenario: Error summary on submit failure
- **WHEN** user submits the form with name and address missing
- **THEN** a banner at the top lists "Tên toà nhà", "Địa chỉ" as links, and clicking "Địa chỉ" scrolls to and focuses the address input

#### Scenario: Error clears on valid input
- **WHEN** an inline error is showing for a field and user types a valid value
- **THEN** the inline error message disappears and the red border is removed

---

### Requirement: Buildings form sticky save bar on mobile
`app/components/buildings/BuildingForm.vue` SHALL render a sticky bottom save bar on viewports `< md` (768px), containing the "Lưu" and "Huỷ" buttons, fixed to the bottom of the viewport. On `md+` viewports the existing inline footer remains. The sticky bar SHALL respect iOS safe-area inset.

#### Scenario: Sticky save bar visible on mobile
- **WHEN** user opens the form on a 375px viewport
- **THEN** the save bar is fixed to the viewport bottom and always visible regardless of scroll

#### Scenario: Inline footer on desktop
- **WHEN** user opens the form on a 1280px viewport
- **THEN** no fixed bar is rendered; save/cancel appear in the form footer as before

---

### Requirement: Buildings form dirty-state navigation guard
`app/pages/buildings/create.vue` and `app/pages/buildings/[id]/edit.vue` SHALL warn the user when navigating away with unsaved changes. The guard SHALL use Vue Router's `onBeforeRouteLeave` for in-app navigation and `window.beforeunload` for tab close/refresh.

#### Scenario: Warn on route navigation when dirty
- **WHEN** user edits the name field then clicks a sidebar link
- **THEN** a confirm dialog appears with "Bạn có thay đổi chưa lưu. Tiếp tục rời trang?"; cancelling keeps the user on the form

#### Scenario: No warning when not dirty
- **WHEN** user opens the form and navigates away without typing
- **THEN** no confirm dialog appears

#### Scenario: Browser tab close warning
- **WHEN** user has unsaved changes and closes the tab
- **THEN** the browser's native unload prompt appears

---

### Requirement: Buildings form draft autosave to localStorage
`app/components/buildings/BuildingForm.vue` (via `useBuildingForm`) SHALL autosave the current form values to `localStorage` under a key `building-form:create` or `building-form:edit:<id>` every 500ms after a change. On mount, if a draft exists, the form SHALL show an `UiAlert` info banner offering "Khôi phục bản nháp", "Bỏ qua", "Xoá bản nháp". The draft SHALL be cleared on successful submit.

#### Scenario: Draft saved while typing
- **WHEN** user types in the form for more than 500ms
- **THEN** the current values are persisted in localStorage under the appropriate key

#### Scenario: Draft restore prompt on revisit
- **WHEN** user revisits the form and a draft exists in localStorage
- **THEN** an alert banner appears with three actions: restore, dismiss, delete draft

#### Scenario: Draft cleared after successful submit
- **WHEN** form submits successfully
- **THEN** the localStorage draft entry is removed

---

### Requirement: Buildings list empty/loading/error polish
`app/pages/buildings/index.vue` SHALL show: skeleton cards (existing) during initial load; a refined empty state when no buildings match the active filters (different from "no buildings exist" empty state); an error alert with retry button when fetch fails.

#### Scenario: Filtered empty state vs no-data empty state
- **WHEN** there are 5 buildings but the search query matches none
- **THEN** the empty state reads "Không tìm thấy toà nhà phù hợp" with a "Xoá bộ lọc" button (not the "Thêm toà nhà đầu tiên" CTA)

#### Scenario: Error state with retry
- **WHEN** the list fetch fails with a network error
- **THEN** an alert appears with "Không tải được danh sách" and a "Thử lại" button that triggers refetch
