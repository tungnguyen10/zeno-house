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
| Dropdown choice | `UiSelect` |
| Confirm action | `UiConfirmModal` (destructive) hoặc `UiModal` |
| Dense correction form | `UiModal size="lg"` (Drawer chỉ thêm khi modal không đủ) |
| Loading rows | `UiSkeleton` (fallback) hoặc table built-in loading |
| No data | `UiEmptyState` hoặc `UiTable` empty state |
| Titled content region | `UiSection` |

## 6. No-go list

- ✗ Dùng `bg-white`, `text-title`, `text-body` ở admin shell.
- ✗ Tự viết `<select class="rounded-md ...">` — dùng `UiSelect`.
- ✗ Tự viết `<table>` markup mới — dùng `UiTable`.
- ✗ Tự nghĩ class màu cho status — map qua `app/utils/constants/statuses.ts`.
- ✗ Card-trong-card chỉ để có border. Dùng `UiSection` + divider.
- ✗ Dashboard hero typography ở dense workspace.
- ✗ Tạo primitive cho 1 chỗ dùng. Đợi có 2+ chỗ rồi mới generalize.

## 7. Database

Không có thay đổi schema database cho design system change này.

## 8. Drawer, Toast, header overflow

### UiDrawer

Use `UiDrawer` for reference surfaces that should preserve the current workspace context, such as billing audit logs or invoice detail side panels.

- Props: `modelValue`, `title`, `width` (default `w-96`).
- Slots: `header`, default body, `footer`.
- Behavior: right-side slide-in, backdrop click closes, Esc closes, focus remains inside the drawer while open.
- Mobile: pass a responsive width such as `w-full sm:w-[44rem]` when the content needs more room.

### Toasts

Mount `UiToastHost` once in the default layout and call `useToast()` from pages/components handling mutations.

- Use `success(message)` after completed user actions.
- Use `error(message)` with the server error message when a mutation fails.
- Use `info(message)` for neutral progress or status feedback.
- Position is top-right on desktop and bottom-center on mobile; messages auto-dismiss after 4 seconds and pause on hover.

### Header Overflow

Rare or destructive workspace actions belong in the page header overflow instead of taking a tab slot. Billing uses this for `Chốt kỳ`; future actions such as cancel/unissue can join the same surface. Hide or disable actions when the current user lacks permission or the current entity state is ineligible.
