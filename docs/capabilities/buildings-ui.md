---
type: Capability Specification
title: "buildings-ui"
status: stable
tags: [capability, requirements]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/specs/buildings-ui/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

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
`app/pages/buildings/create.vue` SHALL render `BuildingForm` with `variant="create"` (name, address, description, status) followed by an always-visible "Phòng" block (the quick room generator, which MAY be left empty), dùng `useBuildingForm().submitCreate()` và hiển thị loading state khi đang submit. The form SHALL NOT ask for owner contact, electricity/water pricing or the billing schedule; those are configured in the setup steps. The submit button reads "Tạo tòa nhà" or "Tạo tòa nhà và N phòng". Submit SHALL be blocked while the room generator is invalid.

#### Scenario: Submit tạo building thành công
- **WHEN** admin điền form hợp lệ và submit
- **THEN** gọi POST /api/buildings, hiển thị "Đã tạo tòa nhà. Tiếp tục thiết lập để sẵn sàng cho thuê." và chuyển tới `/buildings/:slug/settings?setup=1`
- **WHEN** người dùng không có quyền vào cài đặt tòa nhà
- **THEN** chuyển tới trang chi tiết `/buildings/:slug`

#### Scenario: Stale draft with owner fields
- **WHEN** a saved create draft still contains `ownerName`, `ownerPhone` or `ownerEmail`
- **THEN** those keys are discarded when the draft is restored and are never submitted

#### Scenario: Hiển thị validation errors
- **WHEN** form được submit với data không hợp lệ
- **THEN** form hiển thị error messages dưới các field tương ứng, không redirect

#### Scenario: Nút cancel về lại danh sách
- **WHEN** user click Cancel
- **THEN** navigate về `/buildings`

---

### Requirement: Tạo phòng nhanh cùng tòa nhà
The building create page SHALL offer an optional quick-room generator (prefix, start number, count 1–200, default floor, default rent, default area) with an editable preview of floor, rent and area per room, backed by `useQuickRoomPreview`. Manual edits SHALL persist across default changes for rooms still in range; enabling "Đồng giá cho tất cả phòng" SHALL reset rent edits. The page SHALL submit the building and rooms in one `POST /api/buildings` request with a `request_id` that stays the same across retries in the page session. At widths of 640px and above the preview SHALL be a table; below 640px it SHALL be a compact list without horizontal scrolling. All quick-room controls SHALL be disabled while submitting.

#### Scenario: Sửa từng phòng và khôi phục mặc định
- **WHEN** user sửa tầng, giá hoặc diện tích của một phòng rồi đổi giá trị mặc định
- **THEN** ô đã sửa giữ giá trị và có nút khôi phục mặc định có `aria-label` theo trường và phòng

#### Scenario: Mã phòng trùng
- **WHEN** preview hoặc server báo mã phòng trùng
- **THEN** trang hiện cảnh báo liệt kê mã trùng và đánh dấu "Mã trùng" đúng dòng, giữ nguyên form

#### Scenario: Mất phản hồi khi gửi
- **WHEN** request lỗi mạng hoặc lỗi 5xx
- **THEN** trang hiện "Chưa xác nhận được kết quả. Bấm thử lại để kiểm tra và tiếp tục."; bấm lại dùng cùng `request_id`

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
`app/pages/buildings/[id]/index.vue` SHALL organize the detail body into four sections with anchor IDs: `#overview` (creation date, lessor contact and billing config; name, address and description are shown once, in the page header and hero), `#services` (existing fast service toggles + summary), `#operations` (links to rooms, contracts, meter readings of this building), `#danger-zone` (Edit, Archive, Delete actions). Each section SHALL have a heading and short description.

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
`app/components/buildings/BuildingForm.vue` SHALL render its field groups as visually distinct cards: with `variant="create"` only basic info; with `variant="basics"` (settings Basics step and the list quick-edit modal) basic info, billing defaults and schedule. The form has no owner group. Each section SHALL have a section title and a one-line description. Sections SHALL be separated by `border-t border-dark-border` and consistent spacing.

#### Scenario: Sections render with titles
- **WHEN** form mounts
- **THEN** each section shows its title and one-line description

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

### Requirement: Building automatic invoice-email setting
When invoice email is globally enabled, building settings SHALL present a focused automatic invoice-email control using the existing design system and building-scope permissions.

#### Scenario: Owner or admin views editable setting
- **WHEN** an admin or scoped owner opens building settings
- **THEN** the page shows the current auto-send value, explains that it applies only to future issued invoices, and permits saving the toggle

#### Scenario: Manager views read-only setting
- **WHEN** a scoped manager opens the same settings surface
- **THEN** the value and explanatory state are visible but no mutation control is available

#### Scenario: Automatic delivery is enabled
- **WHEN** an authorized user confirms enabling auto-send
- **THEN** the saved state applies to future period issue, issue-and-pay, and reissue operations and does not enqueue historical invoices

#### Scenario: Save fails
- **WHEN** the setting update fails validation, permission, scope, or server persistence
- **THEN** the prior toggle value remains visible and an inline retryable error is shown without affecting other building settings

#### Scenario: Email feature is disabled globally
- **WHEN** the global invoice-email feature flag is off
- **THEN** the automation control is unavailable and no parallel theme, primitive, or settings convention is introduced

### Requirement: Building settings as a setup flow
The building settings page SHALL present setup as a single column of collapsible steps with a readiness card on top. The steps are, in order: lessor profile ("Bên cho thuê", id `lessor-profile`), contract terms ("Điều khoản hợp đồng", `contract-terms`), basics and operating schedule (`basics`), invoice payment profile (`invoice-profile`), default services (`service-defaults`) and inventory template (`inventory-template`), followed by an Advanced group (building code and managers, financial operating rules, per-contract services). The first four steps are required and count towards readiness ("n/4"); default services and inventory template never block it.

#### Scenario: Readiness card
- **WHEN** a required step is incomplete
- **THEN** the card shows "n/4 bước bắt buộc đã xong" with a progress bar and a link to the first missing step
- **WHEN** all four required steps are complete
- **THEN** the card shows the ready state with a "Lập hợp đồng" link

#### Scenario: One step open at a time
- **WHEN** the page loads
- **THEN** the first missing step is open, or the step named by the URL hash (`#lessor-profile`, `#contract-terms`, `#basics`, `#invoice-profile`, `#service-defaults`, `#inventory-template`); the legacy hash `#contract-profile` opens `lessor-profile`
- **WHEN** the user opens another step while the open one has unsaved changes
- **THEN** a discard confirmation is shown, and leaving the page is guarded the same way (this guard covers the Basics step)

#### Scenario: Manager access
- **WHEN** a scoped manager opens the page
- **THEN** every step is readable but read-only, and the lessor profile shows the ID number masked and hides date of birth and permanent address; a manager cannot write lessor identity fields

#### Scenario: Step the user cannot view
- **WHEN** the user lacks permission to view a required step
- **THEN** the step still counts in progress, is shown locked ("Cần chủ tòa hoàn tất"), cannot be opened by click or hash, and is skipped by "Lưu và tiếp"

#### Scenario: Edit page redirect
- **WHEN** a user opens `/buildings/:id/edit`
- **THEN** they are redirected to `/buildings/:id/settings#basics`, which contains the building form (this supersedes the standalone edit page above)

### Requirement: Contract terms start from suggested values
The "Điều khoản hợp đồng" step SHALL pre-fill, for any of term, deposit, notice, deposit-refund and renewal that are still empty in the saved profile, the suggested values 12 months, 1 month, 30 days, 7 days and 6 months, and SHALL show a hint that they are suggestions to review and save. Fees stay empty. The step is complete only after the profile has been saved with all required values.

#### Scenario: First visit
- **WHEN** the profile has no saved terms
- **THEN** the form shows the suggested values with the hint and the step still reports missing items until saved

### Requirement: Building setup mode
Opening settings with `?setup=1` SHALL put the page in setup mode: the header reads "Thiết lập tòa nhà" with the building name and "Hoàn tất 4 bước bắt buộc để lập hợp đồng", the first missing step is open, and each step's save button reads "Lưu và tiếp".

#### Scenario: Save and continue
- **WHEN** the user saves a step in setup mode
- **THEN** readiness is refreshed first, then the next missing required step opens and scrolls into view; if the saved step is still incomplete it stays open; with no required step missing the next optional step opens, otherwise none

#### Scenario: Optional steps
- **WHEN** the default services or inventory template step is open in setup mode
- **THEN** the user can continue with "Tiếp" or "Bỏ qua"; saving the inventory template does not advance while rooms still lack inventory

#### Scenario: Inventory template applies to existing rooms
- **WHEN** the template is saved and some rooms of the building have no inventory items
- **THEN** "Áp dụng cho N phòng" is offered and applies the template in merge mode to at most 200 rooms per request

#### Scenario: Completion
- **WHEN** all required steps are complete in setup mode
- **THEN** the card offers "Lập hợp đồng đầu tiên" linking to `/dashboard/contracts/create?building_id=<id>` (plus `room_id` when the building has exactly one vacant room), "Xem tòa nhà" and "Thoát thiết lập"
- **WHEN** the building has no rooms and the user may create rooms
- **THEN** "Thêm phòng" is the primary action and "Lập hợp đồng" is secondary

#### Scenario: Exit
- **WHEN** the user chooses "Thoát thiết lập"
- **THEN** `?setup=1` is removed, other query parameters stay, and saved data is unchanged

### Requirement: Building detail setup strip
The building detail page SHALL show, for users who can manage buildings, a single strip derived from readiness: "Thiết lập x/4 · Còn thiếu: …" with "Tiếp tục thiết lập" (to `settings?setup=1`) while incomplete, or "Sẵn sàng lập hợp đồng" with a link to contract create for this building when complete. The header actions are "Thêm phòng" and "Cài đặt".

#### Scenario: Lessor contact on detail
- **WHEN** the user can read the contract profile
- **THEN** the overview shows "Bên cho thuê" with name, phone and email

### Requirement: Building list selection keeps the title readable
In selection mode the building card SHALL keep a left gutter for the checkbox at every breakpoint so the checkbox never covers the building name.

### Requirement: Default services with a suggested price
Each catalog service MAY carry a suggested default price. When a building first enables a catalog service, or first sets its pricing type, the building service row SHALL be created with the catalog's suggested price; the price stays editable per building and never changes automatically afterwards. The global catalog includes "Phí quản lý" (fixed per room) with a suggested price of 200.000 ₫.

#### Scenario: First enable uses the suggestion
- **WHEN** an admin enables "Phí quản lý" for a building that has no row for it
- **THEN** the building service is created active with a price of 200.000 ₫

#### Scenario: Price is editable and sticky
- **WHEN** an admin changes the price to another value
- **THEN** the building's price is saved and the catalog suggestion is no longer shown for that building

#### Scenario: Not yet configured
- **WHEN** a building has no row for a catalog service
- **THEN** the price field shows the catalog suggestion, and an enabled service with price 0 shows "Chưa đặt giá"
