## Admin / Manager — Page Patterns

### Page shell

Every admin/manager page follows this structure:

```
┌─ PageHeader ──────────────────────────────────────┐
│  Buildings                    [+ Thêm tòa nhà]    │
│  Quản lý danh sách tòa nhà                        │
└───────────────────────────────────────────────────┘
┌─ Alert zone (hidden when no alerts) ──────────────┐
│  ⚠  3 hợp đồng sắp hết hạn trong 7 ngày  [Xem]  │
└───────────────────────────────────────────────────┘
┌─ Content ─────────────────────────────────────────┐
│  filter bar / table / card grid                   │
└───────────────────────────────────────────────────┘
```

`PageHeader.vue` props: `title`, `description?`, `backTo?`, slot `#actions`.

### Dashboard — KPI cards

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  Lấp đầy       │  │  Thuê nhân      │  │  Bảo trì       │  │  HĐ sắp hết    │
│                │  │  đang ở         │  │  đang mở       │  │  hạn (30 ngày) │
│   85%          │  │   24            │  │   3            │  │   5            │
│  ▲ vs tháng   │  │                 │  │  ● cần xử lý   │  │  ⚠ cần gia hạn │
└────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘
```

`StatCard.vue` props: `label`, `value`, `icon`, `variant` (`default` | `warning` | `danger`), `hint?`.

- Value: `text-3xl font-bold text-[--color-title]`
- Label: `text-sm text-[--color-body]`
- Icon: top-right corner, muted, `size-5`
- `warning` variant: amber left border + amber icon
- `danger` variant: red left border + red icon
- Alert dot: visible when `variant !== 'default'`

### Alert zone

Hidden completely when empty — never show "Không có cảnh báo".

```
┌────────────────────────────────────────────────────┐
│ ⚠  5 hợp đồng hết hạn trong 30 ngày               │  ← warning
│    [Xem danh sách]                         [×]    │
└────────────────────────────────────────────────────┘
```

`AlertBanner.vue` props: `message`, `action?` (`{ label, to }`), `variant` (`warning` | `danger`), dismissible.

### List page pattern

```
┌─ PageHeader ──────────────────────────────────────┐
└───────────────────────────────────────────────────┘
┌─ Filter bar ──────────────────────────────────────┐
│  [🔍 Tìm kiếm...]   [Trạng thái ▾]   [Tòa ▾]    │
└───────────────────────────────────────────────────┘
┌─ UTable ──────────────────────────────────────────┐
│  — loading skeleton while fetching                │
│  — EmptyState when empty                          │
└───────────────────────────────────────────────────┘
```

`EmptyState.vue` props: `icon`, `title`, `description`, `action?` (`{ label, to }`).

### Form page pattern

Card form, sticky footer on mobile:

```
┌─ PageHeader (back arrow + title) ─────────────────┐
└───────────────────────────────────────────────────┘
┌─ UCard ───────────────────────────────────────────┐
│  [form fields via UForm + Zod]                    │
│                                                   │
│  ─────────────────────────────────────────────    │
│                      [Hủy]   [Lưu thay đổi]      │
└───────────────────────────────────────────────────┘
```

---

## Tenant Portal — Page Patterns

### Tenant layout shell

```
┌─ Header (sticky, 56px) ───────────────────────────┐
│  Zeno House                   [🌐] [logout]       │
└───────────────────────────────────────────────────┘
┌─ Content (pb-20 for bottom nav) ──────────────────┐
│  <slot />                                         │
└───────────────────────────────────────────────────┘
┌─ BottomNav (fixed, 64px) ─────────────────────────┐
│  🏠 Trang chủ │ 🧾 Hóa đơn │ 🔧 Bảo trì │ 🔔 │ 👤│
└───────────────────────────────────────────────────┘
```

### Tenant home — hero card

```
┌─ RoomHero ────────────────────────────────────────┐
│  Phòng 201 · Tòa An Khang                         │
│  127 ngày còn lại trong hợp đồng                  │
│  ══════════════════░░░░░  78% đã dùng             │
│  [🔧 Tạo bảo trì]          [📄 Xem hợp đồng]     │
└───────────────────────────────────────────────────┘
```

`TenantRoomHero.vue` — data from `GET /api/tenant/me/room`. Fallback: skeleton while loading, "Chưa có phòng" empty state.

### Tenant quick actions (below hero)

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│  🧾     │  │  🔔     │  │  👤     │
│ Hóa đơn │  │  Thông  │  │  Tài    │
│         │  │  báo    │  │  khoản  │
└─────────┘  └─────────┘  └─────────┘
```

---

## Design Decisions

### 1. Color palette in components

Use tokens from `main.css`, not hardcoded Tailwind grays:

| Element | Token |
| --- | --- |
| Page background | `bg-[--color-smoke]` |
| Card background | `bg-white dark:bg-[--color-dark-card]` |
| Primary title | `text-[--color-title] dark:text-white` |
| Secondary text | `text-[--color-body]` |
| Border | `border-[--color-border]` |
| Active nav | `text-[--color-theme]` |

### 2. Typography scale in pages

| Use | Class |
| --- | --- |
| Page title | `text-2xl font-semibold text-[--color-title]` |
| Section heading | `text-base font-semibold text-[--color-title]` |
| Body / label | `text-sm text-[--color-body]` |
| KPI number | `text-3xl font-bold tracking-tight text-[--color-title]` |

### 3. Card elevation

NuxtUI `UCard` with consistent padding. No custom shadows — use `ring-1 ring-[--color-border]` on UCard via `ui` prop override only when NuxtUI default diverges.

### 4. Spacing rhythm

- Page padding: `p-4 sm:p-6` (from layout)
- Section gap: `space-y-6`
- Card grid gap: `gap-4 sm:gap-6`
- Between label and value inside card: `space-y-1`

### 5. Loading states

Every data-fetching component renders a `USkeleton` while loading. No empty-looking UI. Skeleton matches the shape of the real content.

### 6. Empty states

`EmptyState.vue` always has: icon + title + description + optional CTA button. Never just a dash (`—`) or empty table.

### 7. Interaction feedback

All CTA buttons show `:loading="true"` state during async operations. Success → `useToast()` success. Error → `useToast()` error. No raw `alert()` or `console.log`.
