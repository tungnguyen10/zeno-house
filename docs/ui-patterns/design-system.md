# Zeno House — Operational Design System

Hệ thống UI cho Zeno House được thiết kế cho **work tool nội bộ** với dashboard light/dark theme. Tối ưu cho:

- scan dữ liệu nhiều dòng nhanh
- thao tác lặp lại hằng tháng (billing)
- so sánh số liệu, theo dõi trạng thái queue
- correction / audit / void / reissue có context rõ ràng

Không phải marketing UI. Không phải dashboard show off. Dashboard dùng semantic token để giữ nguyên thứ bậc, mật độ và status semantics ở cả hai theme. Auth tiếp tục dùng dark fallback; tenant portal tiếp tục dùng hệ `--portal-*` độc lập.

## 1. Token Map

Token chính thống nằm tại [tailwind.config.ts](../../tailwind.config.ts). Đừng tạo token mới khi chưa cạn token cũ.

### Surface

| Vai trò | Token | Khi nào dùng |
|--------|-------|--------------|
| Page background | `bg-ui-canvas` | Toàn page, bên ngoài shell |
| Shell / sidebar / header | `bg-ui-chrome` | App chrome cố định |
| Content surface | `bg-ui-surface` | Card, panel, table body |
| Hover row / interactive | `bg-ui-hover` | Row hover, ghost button hover |
| Divider / border | `border-ui-border` | Border và separator thông thường |
| Strong control border | `border-ui-border-strong` | Input, select và control cần định hình rõ |
| Deep accent surface | `bg-ui-deep` | Chỉ dùng khi cần tăng tương phản trong theme hiện tại |

Không dùng appearance literal như `bg-dark-*`, `bg-white`, `text-white`, `text-muted` hoặc `border-dark-border` trong dashboard. Dùng nhóm `ui.*` và `status.*`; CSS variables sẽ resolve theo theme.

### Text

| Vai trò | Token |
|--------|-------|
| Primary text | `text-ui-primary` |
| Secondary / label / metadata | `text-ui-muted` |
| Accent / link / active | `text-ui-accent` |

### Accent

`ui-accent` là accent duy nhất cho action, active state và KPI value. Nó resolve thành cyan `#00E5FF` ở dark mode và teal `#007C91` ở light mode. Không dùng `theme` (`#0B59DB`) hoặc `theme-purple` trong admin shell.

### Status

| Category | Tailwind class hint | Khi nào |
|----------|--------------------|--------|
| Neutral / draft | `bg-ui-surface text-status-neutral` | inactive, draft, không xác định |
| In-progress / accent | `bg-ui-accent/10 text-ui-accent` | active, readings, collecting, processing |
| Success | `bg-status-success/10 text-status-success` | paid, closed, complete, available |
| Warning | `bg-status-warning/10 text-status-warning` | review, partial, replacement, adjustment, expired, maintenance, pending |
| Danger | `bg-status-danger-surface text-status-danger` | overdue, blocked, void, terminated, error |

Tham chiếu cụ thể domain → status variant tại [`app/utils/constants/statuses.ts`](../../app/utils/constants/statuses.ts). Page **không** tự nghĩ class màu cho status — luôn map qua constant.

## 2. Typography

| Use case | Class |
|---------|-------|
| Page title | `text-xl font-semibold text-ui-primary` |
| Section title (panel / workspace) | `text-sm font-semibold text-ui-primary` |
| Body / table cell | `text-sm` |
| Helper / hint / metadata | `text-xs text-ui-muted` |
| Metric value (compact) | `text-xl font-semibold text-ui-primary` |
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

**Không nested card-trong-card.** Section title + divider thay vì wrap thêm `bg-ui-surface` lồng vào card.

## 4. Focus

Tất cả interactive primitive phải có visible focus. Convention:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40
```

Cho destructive button dùng `focus-visible:ring-status-danger`. Không tắt outline mà không thay bằng ring.

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
| Reusable panel surface | `UiSurfacePanel` |

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

Use `UiDatePicker` instead of native `UiInput type="date"` for domain/page date entry. It renders a theme-aware calendar popover, keeps the model as an ISO `YYYY-MM-DD` string, and supports `dateMode` (`past`, `future`, `period-start`, `period-end`, `payment`, `reading`, `operational`) plus `minDate`/`maxDate`.

### Overlays and Searchable Select

- `UiModal` and `UiDrawer` must have a visible `title` or an `ariaLabel`; they close on Escape, keep focus inside while open, and restore previous focus after close.
- `UiCombobox` clear actions must not be nested inside the trigger button, and clearing should not open the dropdown.

### Surface Wrapper (`UiSurfacePanel`)

Use `UiSurfacePanel` when a view needs the repeated shell `rounded-xl border border-ui-border bg-ui-surface`.

- Purpose: eliminate duplicated class strings and keep padding/density consistent across pages.
- Props:
	- `as`: `div | section | article` (default `div`)
	- `density`:
		- `compact` -> `p-4` (preferred for dense settings and list controls)
		- `default` -> `p-5` (hero blocks and summary cards)
- Replace direct wrappers like `<div class="rounded-xl border border-ui-border bg-ui-surface p-5">...</div>` with `UiSurfacePanel`.

Examples:

```vue
<UiSurfacePanel density="compact">
	<UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
	<slot />
</UiSurfacePanel>

<UiSurfacePanel as="section">
	<h2 class="text-lg font-semibold text-ui-primary">Tổng quan tòa nhà</h2>
	<p class="text-sm text-ui-muted">Thông tin vận hành chính</p>
</UiSurfacePanel>
```

## 7. No-go list

### Auth console pattern

Authentication uses the shared `auth.vue` composition: a full-screen operations-console backdrop
(dot mesh + cyan glow + depth gradient, all static and reduced-motion safe) with a single centered
column — brand logo on top, an `AuthConsoleCard` in the middle, and a recovery/registration link
below. `AuthConsoleCard` owns the signature "status rail" (cyan/green status dots plus a
JetBrains Mono readout `ZENO · HỆ VẬN HÀNH` and a short state word) and the glass surface
(`bg-dark-surface/85 backdrop-blur-md`). Login, register, and forgot-password all render inside it.

Use the existing dark surfaces, cyan accent, Inter for the form, and the `mono` token for the rail.
Keep the scan order Google action → divider → credentials → recovery → submit → registration.
Password reveal belongs in the `UiInput` suffix with a named button and visible focus state.
Do not add auth-only tokens, themes, fonts, or duplicate primitives.

The layout must remain usable without horizontal overflow at 320, 375, 414, and 768 pixels, handle
long emails with truncation/title disclosure where appropriate, and respect reduced motion.

- ✗ Dùng appearance literal (`bg-dark-*`, `bg-white`, `text-white`, `text-muted`) ở dashboard thay cho semantic token.
- ✗ Tự viết `<select class="rounded-md ...">` — dùng `UiSelect`.
- ✗ Dùng native `<datalist>` cho lựa chọn có search/custom — dùng `UiCombobox`.
- ✗ Tự viết `<table>` markup mới — dùng `UiTable`.
- ✗ Dùng `UiInput type="number"` mà không có `numberMode`, trừ formatted text input có lý do rõ ràng.
- ✗ Dùng native `UiInput type="date"` trong domain/page form — dùng `UiDatePicker`.
- ✗ Tự nghĩ class màu cho status — map qua `app/utils/constants/statuses.ts`.
- ✗ Card-trong-card chỉ để có border. Dùng `UiSection` + divider.
- ✗ Lặp lại chuỗi class panel (`rounded-xl border border-ui-border bg-ui-surface p-*`) ở nhiều file. Dùng `UiSurfacePanel`.
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

## 13. Mobile Native App Shell (iOS-inspired)

Standard for pages that get a full mobile-native pass (currently applied to `/dashboard/billing/**`). Desktop (`lg` and above) stays on the existing patterns above unless stated otherwise — every item here is gated `< lg` (or `< md` where noted) and reverts to the prior desktop look via explicit `lg:`/`md:` overrides on the same element, not a duplicated instance.

- **Collapsing large title.** Keep the page's existing `UiPageHeader` large title as normal scrolling content. Place a zero-height sentinel `<div ref="titleSentinel" aria-hidden="true" />` right after the title (inside `UiPageHeader`'s default slot) and watch it with `useIntersectionObserver` (VueUse, default root — do not pass an explicit scroll-root ref). When the sentinel leaves view, write the compact title string into `useAppHeaderTitle()` (`app/composables/useAppHeaderTitle.ts`); clear it in `onBeforeUnmount`. `AppHeader.vue` renders that state centered and truncated in its previously-empty mobile slot with a short opacity `<Transition>` — this reuses the always-visible persistent top bar instead of adding a second sticky header, so no vertical space is added. Do not build a page-local compact title; it duplicates height and drifts from this pattern (see the KPI-strip mistake this section replaced).
- **Segmented tabs.** `UiTabs` has an opt-in `variant="segmented"` prop (default remains `underline`, unaffected everywhere else). It renders an iOS-style sliding pill track below `lg` and reverts to the standard underline tabs at `lg`+ on the same instance (no duplicated `role="tablist"`). Pass it only on pages that want the mobile-native treatment.
- **Grouped inset list rows.** Reuse the existing `divide-y divide-ui-border overflow-hidden rounded-xl border border-ui-border bg-ui-surface` container for `md:hidden` card lists (already the repo convention). For navigable rows (row tap opens detail), add a trailing `IconChevronRight` (`h-4 w-4 shrink-0 text-ui-muted`) — the same icon `UiListRow` uses — to signal the affordance. Keep `rounded-xl` as the max radius for these containers; do not introduce `rounded-2xl` here (reserved for floating chrome, next item).
- **Circular multi-select.** `UiCheckbox` has an opt-in `shape="circle"` prop (default `square`, unaffected everywhere else) for iOS-style round bulk-select indicators inside grouped inset lists. Desktop table checkboxes stay square.
- **Floating chrome bars.** Any `fixed`/floating element that sits above the tab bar (sticky bulk-action bars, etc.) should match `AppTabBar`'s chrome language: `rounded-2xl border border-ui-border bg-ui-chrome/95 backdrop-blur-md shadow-lg`. This is the one place `rounded-2xl` is sanctioned for a bar, since it mirrors the tab bar's own floating pill rather than a card. If the same bar also renders inline on desktop (e.g. `md:static`), add explicit `md:`/`lg:` overrides so desktop keeps its original flat look byte-for-byte.
- **Opaque sticky summary/KPI bars.** Never use a translucent background (`bg-ui-canvas/95` + `backdrop-blur`) on a `position: sticky` bar that sits above scrolling list content — text scrolling underneath bleeds through the blur instead of being hidden. Use a solid `bg-ui-canvas` (or `bg-ui-surface`/`bg-ui-chrome` as appropriate) for any sticky bar with scrollable content behind it.
- **Single-line KPI/metric strips.** On mobile, metric strips with more than 2-3 items should scroll horizontally on one line (`flex flex-nowrap overflow-x-auto no-scrollbar` + `shrink-0` per item) instead of `flex-wrap`ping to multiple stacked lines. Hide secondary captions below `md` (`hidden md:inline`) to keep each item short; keep the full wrapped/captioned layout at `md:` and above unchanged.
- **No duplicate section titles under segmented tabs.** When a `UiSection` sits directly under a tab (segmented or underline) whose label already says what the section is, don't repeat that label as the section's own `title`/`description` on mobile — it reads as literal duplication and burns vertical space the segmented pill was supposed to save. Use `UiSection`'s opt-in `titleClass="hidden md:block"` prop to hide the title/description text below `md` while keeping the section's `#actions` (refresh/export buttons, etc.) visible; keep the title/description at `md:` and above where the tab bar is a subtler underline. Any inline filter tablist inside that section should also get `overflow-x-auto no-scrollbar` + `shrink-0` per button so it never wraps to a second line either.
- **Known boundary.** Read-only detail tables with 2+ columns already hidden via `hideOnMobile` (e.g. the invoice detail page's charge/payment tables) are left as plain `UiTable` — `UiTable`'s own wrapper already provides `overflow-x-auto`, and converting every such table to a grouped mobile card list is a separate, larger change. Do that conversion only when a table's mobile-visible columns still don't fit comfortably (follow the `BillingPaymentsStep` mobile-card pattern from section 10/11 when you do).
