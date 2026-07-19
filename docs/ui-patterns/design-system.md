# Zeno House — Operational Design System

Hệ thống UI cho Zeno House được thiết kế cho **work tool nội bộ** trên dark theme. Tối ưu cho:

- scan dữ liệu nhiều dòng nhanh
- thao tác lặp lại hằng tháng (billing)
- so sánh số liệu, theo dõi trạng thái queue
- correction / audit / void / reissue có context rõ ràng

Không phải marketing UI. Không phải dashboard show off. Không có light theme.

## 1. Token Map

Token chính thống nằm tại [tailwind.config.ts](../../tailwind.config.ts). Đừng tạo token mới khi chưa cạn token cũ.

### Surface

| Vai trò | Token | Khi nào dùng |
|--------|-------|--------------|
| Page background | `bg-dark` | Toàn page, bên ngoài shell |
| Shell / sidebar / header | `bg-dark-card` | App chrome cố định |
| Content surface | `bg-dark-surface` | Card, panel, table body |
| Hover row / interactive | `bg-dark-hover` | Row hover, ghost button hover |
| Divider / border | `border-dark-border` | Tất cả border, separator |
| Deep accent surface | `bg-dark-deep` | Chỉ dùng khi cần nền tối hơn để tạo contrast |

Không dùng `bg-smoke*`, `bg-white`, `text-title`, `text-body` ở admin shell — đó là token light theme legacy chỉ phục vụ public site (chưa có).

### Text

| Vai trò | Token |
|--------|-------|
| Primary text | `text-white` |
| Secondary / label / metadata | `text-muted` |
| Accent / link / active | `text-cyan` |

### Accent

`cyan` (`#00E5FF`) là accent duy nhất cho action, active state, KPI value. Không dùng `theme` (`#0B59DB`) hoặc `theme-purple` trong admin shell.

### Status

| Category | Tailwind class hint | Khi nào |
|----------|--------------------|--------|
| Neutral / draft | `bg-dark-surface text-muted` | inactive, draft, không xác định |
| In-progress / accent | `bg-cyan/10 text-cyan` | active, readings, collecting, processing |
| Success | `bg-success-neon/10 text-success-neon` | paid, closed, complete, available |
| Warning | `bg-warning/10 text-warning` | review, partial, replacement, adjustment, expired, maintenance, pending |
| Danger | `bg-error-bg text-error-vivid` hoặc `bg-error/10 text-error` | overdue, blocked, void, terminated, error |

Tham chiếu cụ thể domain → status variant tại [`app/utils/constants/statuses.ts`](../../app/utils/constants/statuses.ts). Page **không** tự nghĩ class màu cho status — luôn map qua constant.

## 2. Typography

| Use case | Class |
|---------|-------|
| Page title | `text-xl font-semibold text-white` |
| Section title (panel / workspace) | `text-sm font-semibold text-white` |
| Body / table cell | `text-sm` |
| Helper / hint / metadata | `text-xs text-muted` |
| Metric value (compact) | `text-xl font-semibold text-white` |
| Metric value (dashboard hero) | tối đa `text-2xl` — chỉ trên `/` dashboard |

Không dùng font scale viewport-based, không dùng `text-3xl+` trong dense workspace. Font: Inter, đã preload qua `app/assets/scss/main.scss`.

## 3. Radius & Spacing

| Element | Radius |
|---------|--------|
| Button, input, select, textarea | `rounded-md` |
| Badge | `rounded-full` (status) hoặc `rounded-md` (label) |
| Card / panel / table wrapper | tối đa `rounded-xl` |
| Modal | `rounded-2xl` (giữ đồng nhất với primitive hiện có) |

Spacing nguyên tắc:

- Toolbar / form row: `gap-3` ngang, `gap-1.5` dọc trong field group
- Section: `space-y-6` giữa section, `space-y-4` trong section
- Table cell padding: dense `px-3 py-2`, comfortable `px-4 py-3`

**Không nested card-trong-card.** Section title + divider thay vì wrap thêm `bg-dark-surface` lồng vào card.

## 4. Focus

Tất cả interactive primitive phải có visible focus. Convention:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40
```

Cho destructive button dùng `focus-visible:ring-error`. Không tắt outline mà không thay bằng ring.

## 5. Component → Pattern Map

| Need | Use |
|------|-----|
| Page title + actions | `UiPageHeader` |
| Filter row + actions | `UiToolbar` |
| Compact KPI strip | `UiMetric` |
| Workspace step nav | `UiTabs` |
| Many comparable rows | `UiTable` |
| Inline feedback / blocker | `UiAlert` |
| Domain status pill | `UiStatusBadge` (delegates to `UiBadge`) |
| Generic label / count | `UiBadge` |
| Boolean field | `UiCheckbox` (form) hoặc `UiToggle` (settings row) |
| Multiline input | `UiTextarea` |
| Date choice | `UiDatePicker` |
| Dropdown choice | `UiSelect` |
| Searchable choice | `UiCombobox` |
| Choose-or-type domain label | `UiCombobox allow-custom` |
| Confirm action | `UiConfirmModal` (destructive) hoặc `UiModal` |
| Dense correction form | `UiModal size="lg"` (Drawer chỉ thêm khi modal không đủ) |
| Loading rows | `UiSkeleton` (fallback) hoặc table built-in loading |
| No data | `UiEmptyState` hoặc `UiTable` empty state |
| Titled content region | `UiSection` |
| Reusable dark panel surface | `UiSurfacePanel` |

## 6. Primitive Contracts

### Form Controls

`UiInput`, `UiDatePicker`, `UiTextarea`, `UiSelect`, `UiCombobox`, and `UiCheckbox` own field-level state:

- Use `error` and `hint` props instead of adjacent ad-hoc helper text.
- Error/disabled state is exposed through `data-invalid`, `data-disabled`, `aria-invalid`, and `aria-describedby`.
- For `UiInput`, wrapper `class`/`style` stay on the root; native attributes such as `name`, `autocomplete`, `min`, `max`, `step`, `pattern`, `inputmode`, `readonly`, and `data-*` are forwarded to the native input.

`UiInput type="number"` must declare intent with `numberMode`:

| Domain value | `numberMode` |
|--------------|--------------|
| rents, deposits, fees, payment amounts, VND rates | `currency` |
| electricity/water readings | `meter` |
| room/building area | `area` |
| period month | `month` |
| period year | `year` |
| day-of-month settings | `day` |
| floors, counts, totals, sequence numbers | `integer` |
| percentages/rates | `percent` |

Caller-provided `min`, `max`, `step`, and `inputmode` always win over primitive defaults. Keep formatted numeric display fields as `type="text"` with an appropriate `inputmode` when the component formats while typing.

Use `UiDatePicker` instead of native `UiInput type="date"` for domain/page date entry. It renders a dark calendar popover, keeps the model as an ISO `YYYY-MM-DD` string, and supports `dateMode` (`past`, `future`, `period-start`, `period-end`, `payment`, `reading`, `operational`) plus `minDate`/`maxDate`.

### Overlays and Searchable Select

- `UiModal` and `UiDrawer` must have a visible `title` or an `ariaLabel`; they close on Escape, keep focus inside while open, and restore previous focus after close.
- `UiCombobox` clear actions must not be nested inside the trigger button, and clearing should not open the dropdown.

### Surface Wrapper (`UiSurfacePanel`)

Use `UiSurfacePanel` when a view needs the repeated shell `rounded-xl border border-dark-border bg-dark-surface`.

- Purpose: eliminate duplicated class strings and keep padding/density consistent across pages.
- Props:
	- `as`: `div | section | article` (default `div`)
	- `density`:
		- `compact` -> `p-4` (preferred for dense settings and list controls)
		- `default` -> `p-5` (hero blocks and summary cards)
- Replace direct wrappers like `<div class="rounded-xl border border-dark-border bg-dark-surface p-5">...</div>` with `UiSurfacePanel`.

Examples:

```vue
<UiSurfacePanel density="compact">
	<UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
	<slot />
</UiSurfacePanel>

<UiSurfacePanel as="section">
	<h2 class="text-lg font-semibold text-white">Tổng quan tòa nhà</h2>
	<p class="text-sm text-muted">Thông tin vận hành chính</p>
</UiSurfacePanel>
```

## 7. No-go list

### Auth split-layout pattern

Authentication uses the shared `auth.vue` composition: a restrained operational illustration and
brand statement on desktop, paired with a focused form surface; below the desktop breakpoint the
illustration becomes a short top band. Use the existing dark surfaces, cyan accent, Inter font,
spacing scale, and `Ui*` primitives. Keep the scan order Google action → divider → credentials →
recovery → submit → registration. Password reveal belongs in the `UiInput` suffix with a named
button and visible focus state. Do not add auth-only tokens, themes, fonts, or duplicate primitives.

The layout must remain usable without horizontal overflow at 320, 375, 414, and 768 pixels, handle
long emails with truncation/title disclosure where appropriate, and respect reduced motion.

- ✗ Dùng `bg-white`, `text-title`, `text-body` ở admin shell.
- ✗ Tự viết `<select class="rounded-md ...">` — dùng `UiSelect`.
- ✗ Dùng native `<datalist>` cho lựa chọn có search/custom — dùng `UiCombobox`.
- ✗ Tự viết `<table>` markup mới — dùng `UiTable`.
- ✗ Dùng `UiInput type="number"` mà không có `numberMode`, trừ formatted text input có lý do rõ ràng.
- ✗ Dùng native `UiInput type="date"` trong domain/page form — dùng `UiDatePicker`.
- ✗ Tự nghĩ class màu cho status — map qua `app/utils/constants/statuses.ts`.
- ✗ Card-trong-card chỉ để có border. Dùng `UiSection` + divider.
- ✗ Lặp lại chuỗi class panel (`rounded-xl border border-dark-border bg-dark-surface p-*`) ở nhiều file. Dùng `UiSurfacePanel`.
- ✗ Dashboard hero typography ở dense workspace.
- ✗ Tạo primitive cho 1 chỗ dùng. Đợi có 2+ chỗ rồi mới generalize.

## 8. Database

Không có thay đổi schema database cho design system change này.

`UiCombobox allow-custom` chỉ thay đổi cách nhập liệu trên UI. Field đích vẫn là schema domain hiện có: nơi đã có `name` thì lưu vào `name`; nơi chỉ có mô tả/ghi chú thì lưu vào `note`.

## 9. Drawer, Toast, header overflow

### UiDrawer

Use `UiDrawer` for reference surfaces that should preserve the current workspace context, such as billing audit logs or invoice detail side panels.

- Props: `modelValue`, `title`, `ariaLabel`, `width` (default `w-96`).
- Slots: `header`, default body, `footer`.
- Behavior: right-side slide-in, backdrop click closes, Esc closes, focus remains inside the drawer while open, previous focus is restored after close.
- Mobile: pass a responsive width such as `w-full sm:w-[44rem]` when the content needs more room.

### Toasts

Mount `UiToastHost` once in the default layout and call `useToast()` from pages/components handling mutations.

- Use `success(message)` after completed user actions.
- Use `error(message)` with the server error message when a mutation fails.
- Use `info(message)` for neutral progress or status feedback.
- Position is top-right on desktop and bottom-center on mobile; messages auto-dismiss after 4 seconds and pause on hover.

### Header Overflow

Rare or destructive workspace actions belong in the page header overflow instead of taking a tab slot. Billing uses this for `Chốt kỳ`; future actions such as cancel/unissue can join the same surface. Hide or disable actions when the current user lacks permission or the current entity state is ineligible.

The billing workspace header now uses a dropdown menu containing **Xuất Excel**, **Huỷ phát hành kỳ** (admin-only, danger style, disabled when status is `closed` or `draft`), and **Chốt kỳ** (admin-only, disabled when status is `closed`). Open/close the menu with the kebab button; clicks on the transparent backdrop dismiss it.

## 10. Bulk-select pattern

Used in `BillingPaymentsStep` so operators can record many payments in one round trip.

- Add a 40px-wide leading column with checkboxes; only render the checkbox when the row is eligible (e.g. invoice has remaining balance).
- Provide a header "Chọn tất cả (N)" / "Bỏ chọn tất cả" toggle in the table toolbar `#actions` slot.
- Render a sticky bottom bar (`fixed bottom-4 left-1/2 -translate-x-1/2 z-30`, with `<Transition>`) showing the count plus primary "Ghi thu hàng loạt" / secondary "Bỏ chọn".
- Open a modal that pre-fills one row per selected invoice (default amount = remaining balance) and exposes shared fields (payment method, payment date, note).
- On 409 responses with `details.failed_index`, highlight the failing row inside the modal (`bg-rose-500/10`) and surface the server message via toast — keep the modal open so the operator can adjust.

## 11. Inline 2-line mobile rows

Replaces the desktop draft grid on `< md` widths so meter inputs remain accessible without horizontal scroll.

- Hide the `UiTable` with `class="hidden md:block"` and render `BillingMobileDraftRow` inside `<div class="md:hidden">`.
- Line 1: room and tenant on the left, the editable meter input on the right.
- Line 2: previous/new reading delta plus computed kWh/m³ rate as muted helper text.
- Reuse the same dirty-cell highlight, paste highlight, and per-row save indicator as the desktop view by passing helper props (`readingValueOf`, `isCellDirty`, `isPasteHighlighted`, `saveStateOf`).

## 12. Agent UI quality gate

Every user-visible UI change follows `.agents/skills/zeno-house/references/ui-polish-workflow.md`. The agent must read and apply both `frontend-design` and `hallmark` at a scope appropriate to the task, including focused component edits—not only greenfield pages and redesigns.

Those skills improve visual direction and critique; they do not replace this design system. When guidance conflicts, the priority is:

1. Accepted product behavior and accessibility requirements.
2. This design system, existing `Ui*` primitives, semantic tokens, typography, density, status mappings, and icon conventions.
3. Repository frontend architecture and instruction files.
4. Task-specific aesthetic guidance from `frontend-design` and anti-slop critique from `hallmark`.

Do not create a parallel theme, font stack, token file, primitive library, or copied CSS signature merely because a generic design skill proposes one. If a broader visual change would materially improve multiple product surfaces, raise it as an explicit design-system optimization with affected surfaces, benefit, cost, and a compliant fallback before implementation.

UI completion requires checking relevant interaction states and visually inspecting the rendered result when tooling is available. A page that compiles but has weak hierarchy, inconsistent spacing, generic styling, or missing states is not complete.
