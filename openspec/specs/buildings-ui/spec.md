## Purpose
Defines building list, create, detail, edit, card, and form user interface behavior.
## Requirements
### Requirement: Trang danh sách buildings
`app/pages/buildings/index.vue` SHALL dùng `useBuildingList()`, hiển thị danh sách buildings dưới dạng grid cards, có nút "Thêm tòa nhà" trỏ đến `/buildings/create`, có pagination controls, có empty state khi không có dữ liệu.

#### Scenario: Hiển thị danh sách buildings
- **WHEN** user truy cập `/buildings` và có data
- **THEN** trang hiển thị grid các BuildingCard, mỗi card có name, address, status, totalRooms

#### Scenario: Empty state khi không có buildings
- **WHEN** list trống
- **THEN** trang hiển thị empty state với CTA "Thêm tòa nhà đầu tiên"

#### Scenario: Pagination controls
- **WHEN** total > limit
- **THEN** có pagination controls để navigate qua các trang

#### Scenario: Nút "Thêm tòa nhà" chỉ hiện với admin
- **WHEN** user có role 'admin'
- **THEN** nút "Thêm tòa nhà" hiển thị; với manager không hiển thị

---

### Requirement: Trang tạo building mới
`app/pages/buildings/create.vue` SHALL render `BuildingForm` component, dùng `useBuildingForm().submitCreate()`, hiển thị loading state khi đang submit, redirect về `/buildings` sau khi thành công.

#### Scenario: Submit tạo building thành công
- **WHEN** admin điền form hợp lệ và submit
- **THEN** gọi POST /api/buildings, sau đó redirect về `/buildings`

#### Scenario: Hiển thị validation errors
- **WHEN** form được submit với data không hợp lệ
- **THEN** form hiển thị error messages dưới các field tương ứng, không redirect

#### Scenario: Nút cancel về lại danh sách
- **WHEN** user click Cancel
- **THEN** navigate về `/buildings`

---

### Requirement: Trang chi tiết building
`app/pages/buildings/[id]/index.vue` SHALL fetch building theo id, hiển thị thông tin đầy đủ, có nút Edit (chỉ admin), có nút Delete với confirmation (chỉ admin).

#### Scenario: Hiển thị chi tiết building
- **WHEN** user truy cập `/buildings/:id` với id hợp lệ
- **THEN** trang hiển thị name, address, description, status, totalRooms, createdAt

#### Scenario: 404 khi building không tồn tại
- **WHEN** id không tồn tại trong database
- **THEN** trang hiển thị not found message hoặc redirect về `/buildings`

#### Scenario: Nút Edit và Delete chỉ hiện với admin
- **WHEN** user có role 'admin'
- **THEN** nút Edit và Delete hiển thị; với manager không hiển thị

#### Scenario: Delete với confirmation
- **WHEN** admin click Delete và confirm
- **THEN** gọi DELETE /api/buildings/:id và redirect về `/buildings`

---

### Requirement: Trang chỉnh sửa building
`app/pages/buildings/[id]/edit.vue` SHALL fetch building hiện tại để pre-fill form, render `BuildingForm`, dùng `useBuildingForm().submitUpdate()`, redirect về `/buildings/:id` sau thành công.

#### Scenario: Form pre-filled với data hiện tại
- **WHEN** user truy cập `/buildings/:id/edit`
- **THEN** form có sẵn values từ building hiện tại

#### Scenario: Submit update thành công
- **WHEN** admin chỉnh sửa và submit
- **THEN** gọi PATCH /api/buildings/:id, redirect về `/buildings/:id`

---

### Requirement: BuildingCard component
`app/components/buildings/BuildingCard.vue` SHALL nhận `building: Building` qua props, hiển thị name, address, status badge, totalRooms, link đến `/buildings/:id`.

#### Scenario: BuildingCard render đúng data
- **WHEN** component nhận building prop
- **THEN** hiển thị name, address, status badge (màu theo active/inactive), totalRooms

---

### Requirement: BuildingForm component
`app/components/buildings/BuildingForm.vue` SHALL nhận `modelValue: BuildingFormData`, `loading: boolean`, emit `submit` với form data. Có fields: name (required), address (required), description (optional), status (select: active/inactive).

#### Scenario: Form emit submit khi click Save
- **WHEN** user điền form hợp lệ và click Save
- **THEN** component emit `submit` với form data

#### Scenario: Fields disabled khi loading
- **WHEN** `loading` prop là true
- **THEN** tất cả form fields và submit button bị disabled

### Requirement: Building pages use slug links
Building list cards, detail links, edit links, settings links, and related navigation SHALL prefer `/buildings/<slug>` URLs when a building slug is available. Existing UUID URLs SHALL continue to resolve.

#### Scenario: Building card links by slug
- **WHEN** a building card renders a building with slug `toa-a`
- **THEN** the card links to `/buildings/toa-a`

#### Scenario: Existing UUID detail URL still works
- **WHEN** user opens `/buildings/<uuid>` for an existing building
- **THEN** the detail page loads that building successfully

### Requirement: Building service summary on list and detail
Building list and detail surfaces SHALL show a concise summary of building-level services, including active service count and visible active service names when space allows.

#### Scenario: Service summary displayed on building list
- **WHEN** building list data includes service summary
- **THEN** each building card displays active service count and a concise active service label list

#### Scenario: Service summary displayed on detail
- **WHEN** user opens building detail
- **THEN** the page displays active services and provides a clear path to manage service settings

### Requirement: Fast building service toggle
Building detail SHALL allow admin users to toggle building-level service active state without first opening the full settings page. The UI SHALL use existing building service APIs and refresh the service summary after changes.

#### Scenario: Admin toggles service active state
- **WHEN** admin toggles an active building service off from building detail
- **THEN** the service is updated and the detail summary reflects the new inactive state

#### Scenario: Manager cannot toggle service
- **WHEN** manager views building detail
- **THEN** service toggles are not editable

### Requirement: Building detail removes redundant month operation CTA
Building detail SHALL not show a month-specific "Van hanh thang <month>" primary action when the billing or operations workflow is already available through clearer navigation.

#### Scenario: Redundant operation button hidden
- **WHEN** user views building detail
- **THEN** the header actions do not include the old month-specific operation button

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

#### Scenario: Bulk action refreshes latest filtered list
- **WHEN** any bulk action completes (full success or partial success)
- **THEN** the page clears selected ids and refetches the keyed building list so current filters render latest data from server

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

### Requirement: Buildings form sectioned cards with numbered headings
`app/components/buildings/BuildingForm.vue` SHALL render its four field groups (basic info, owner, billing defaults, schedule) as visually distinct cards. Each section SHALL have a numbered badge (1–4), a section title, and a one-line description. Sections SHALL be separated by `border-t border-dark-border` and consistent spacing.

#### Scenario: Sections render with numbered badges
- **WHEN** form mounts
- **THEN** each of the four sections shows a circular cyan badge with the section number followed by the title text

### Requirement: Buildings form inline validation
`app/components/buildings/BuildingForm.vue` SHALL run field-level Zod validation on `blur` and re-validate on `input` only if the field already has an error. On submit, the form SHALL reveal inline errors for every invalid field and SHALL focus the first invalid field.

#### Scenario: Field validates on blur
- **WHEN** user focuses then leaves the `name` field empty
- **THEN** an inline error message appears under the field and the field gains red border styling

#### Scenario: Inline errors on submit failure
- **WHEN** user submits the form with name and address missing
- **THEN** inline errors are shown under both fields and focus moves to the first invalid input

#### Scenario: Error clears on valid input
- **WHEN** an inline error is showing for a field and user types a valid value
- **THEN** the inline error message disappears and the red border is removed

### Requirement: Buildings form sticky save bar on mobile
`app/components/buildings/BuildingForm.vue` SHALL render a sticky bottom save bar on viewports `< md` (768px), containing the "Lưu" and "Huỷ" buttons, fixed to the bottom of the viewport. On `md+` viewports the existing inline footer remains. The sticky bar SHALL respect iOS safe-area inset.

#### Scenario: Sticky save bar visible on mobile
- **WHEN** user opens the form on a 375px viewport
- **THEN** the save bar is fixed to the viewport bottom and always visible regardless of scroll

#### Scenario: Inline footer on desktop
- **WHEN** user opens the form on a 1280px viewport
- **THEN** no fixed bar is rendered; save/cancel appear in the form footer as before

### Requirement: Buildings form navigation behavior with drafts
`app/pages/buildings/create.vue` and `app/pages/buildings/[id]/edit.vue` SHALL allow users to leave the page immediately even when the form has unsaved changes. The page SHALL NOT show a custom leave-confirm modal and SHALL NOT register a browser unload warning. Unsaved values rely on draft autosave and can be restored on revisit.

#### Scenario: Navigate away while dirty proceeds immediately
- **WHEN** user edits the name field then clicks a sidebar link
- **THEN** navigation continues without any confirm dialog

#### Scenario: Browser tab close does not show unsaved warning
- **WHEN** user has unsaved changes and closes or reloads the tab
- **THEN** no native "Leave site?" warning is shown

#### Scenario: Draft remains available after leaving
- **WHEN** user typed changes, leaves the page, then revisits later
- **THEN** the draft restore alert is shown and user can restore the saved values

### Requirement: Buildings form draft autosave to localStorage
`app/components/buildings/BuildingForm.vue` (via `useBuildingForm`) SHALL autosave the current form values to `localStorage` under a key `building-form:create` or `building-form:edit:<id>` every 500ms after a change. After client mount, if a draft exists, the form SHALL show an `UiAlert` info banner offering "Khôi phục bản nháp", "Bỏ qua", "Xoá bản nháp". Initial SSR and client hydration output SHALL stay aligned by not depending on localStorage before mount. The draft SHALL be cleared on successful submit.

#### Scenario: Draft saved while typing
- **WHEN** user types in the form for more than 500ms
- **THEN** the current values are persisted in localStorage under the appropriate key

#### Scenario: Draft restore prompt on revisit
- **WHEN** user revisits the form and a draft exists in localStorage
- **THEN** an alert banner appears with three actions: restore, dismiss, delete draft

#### Scenario: Hydration-safe first render
- **WHEN** server renders the create/edit form and client starts hydration
- **THEN** both sides render the same initial markup for the draft banner area
- **AND** draft detection runs only after client mount

#### Scenario: Draft cleared after successful submit
- **WHEN** form submits successfully
- **THEN** the localStorage draft entry is removed

### Requirement: Buildings list empty/loading/error polish
`app/pages/buildings/index.vue` SHALL show: skeleton cards (existing) during initial load; a refined empty state when no buildings match the active filters (different from "no buildings exist" empty state); an error alert with retry button when fetch fails.

#### Scenario: Filtered empty state vs no-data empty state
- **WHEN** there are 5 buildings but the search query matches none
- **THEN** the empty state reads "Không tìm thấy toà nhà phù hợp" with a "Xoá bộ lọc" button (not the "Thêm toà nhà đầu tiên" CTA)

#### Scenario: Error state with retry
- **WHEN** the list fetch fails with a network error
- **THEN** an alert appears with "Không tải được danh sách" and a "Thử lại" button that triggers refetch

