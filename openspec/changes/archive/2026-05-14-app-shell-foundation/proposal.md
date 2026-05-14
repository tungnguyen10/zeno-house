## Why

F0.1.1 Project Skeleton đã hoàn thành — Nuxt 4, TailwindCSS, Pinia, Supabase, Zod đã được cài và cấu hình. Tuy nhiên app hiện tại chỉ hiển thị `NuxtWelcome`. Cần một app shell admin hoạt động được để các feature tiếp theo (auth, buildings, rooms...) có chỗ cắm vào. Không có shell thì mọi feature sau phải giải quyết layout từ đầu mỗi lần.

## What Changes

- Cài `clsx` vào dependencies
- Tạo `app/layouts/default.vue` — admin shell với sidebar + header
- Tạo `app/layouts/auth.vue` — layout tối giản cho login page
- Tạo `app/components/app/AppSidebar.vue` — navigation với 5 mục cố định
- Tạo `app/components/app/AppHeader.vue` — topbar với breadcrumb placeholder và user avatar placeholder
- Tạo UI primitives dùng ngay trong shell: `UiButton`, `UiInput`, `UiModal`, `UiStatusBadge`, `UiEmptyState`, `UiSkeleton`
- Tạo `app/pages/index.vue` — dashboard placeholder (chưa có data thật)
- Tạo `app/pages/login.vue` — placeholder, chưa nối auth
- Tạo `docs/architecture/rules.md` — ghi lại architecture rules từ v0.1 plan
- Thay `NuxtWelcome` trong `app/app.vue` bằng `NuxtLayout` + `NuxtPage`

## Capabilities

### New Capabilities

- `admin-shell`: App shell layout cho admin — sidebar navigation, header, content area. Layout wrapper cho tất cả admin pages.
- `ui-primitives`: Tập UI component nền (UiButton, UiInput, UiModal, UiStatusBadge, UiEmptyState, UiSkeleton) dùng chung toàn app.

### Modified Capabilities

<!-- Không có capability hiện có nào thay đổi — đây là lần đầu tạo shell -->

## Impact

- `app/app.vue` — thay NuxtWelcome bằng NuxtLayout/NuxtPage
- `app/layouts/` — tạo mới default.vue, auth.vue
- `app/components/app/` — tạo mới AppSidebar, AppHeader
- `app/components/ui/` — tạo mới 6 UI primitives
- `app/pages/` — tạo index.vue, login.vue
- `app/assets/scss/main.scss` — thêm `@layer base` với dark body background + Inter font
- `package.json` — thêm `clsx`
- `docs/architecture/rules.md` — tạo mới
- Không có breaking change với API hay server

## Additions (Post-Spec)

Những thứ được làm bổ sung ngoài 21 tasks gốc trong cùng session:

### Design System & Theming
- `tailwind.config.ts` — thiết lập toàn bộ design token system:
  - Brand: `theme`, `theme-purple`, `brand`
  - Text: `title`, `body`, `muted`
  - Backgrounds: `smoke`, `smoke-blue`, `smoke-card`
  - Borders: `border`, `border-light`
  - Status: `success`, `success-neon`, `error`, `error-vivid`, `error-bg`, `warning`
  - Data/Chart: `cyan` (neon accent)
  - Dark surfaces: `dark`, `dark-card`, `dark-surface`, `dark-border`, `dark-hover`, `dark-nav`, `dark-deep`
  - Fonts: `inter`, `mono` (JetBrains Mono)
  - z-index: 60, 70, 80

### Dark Mode UI (scope expansion từ Non-Goal)
- Toàn bộ admin shell chuyển sang dark mode theo WattVision DESIGN.md pattern:
  - `bg-dark` cho page backgrounds
  - `bg-dark-card` cho sidebar/header
  - `bg-dark-surface` cho cards
  - `bg-cyan/10 text-cyan` cho active nav
  - Primary button: `bg-cyan text-dark-deep`
  - Status badges: neon colors (`success-neon`, `error-vivid`, `error-bg`)
  - Cards: `rounded-2xl border-dark-border`

### Quality Fixes
- `UiModal.vue` — thêm `tabindex="-1"` + `@after-enter` auto-focus để Escape key hoạt động đúng
- `AppSidebar.vue` — xoá `open` prop không dùng; `default.vue` xoá `:open` binding tương ứng

### Instructions & Documentation
- `.github/instructions/components.instructions.md` — thêm single-file vs folder rule, code standards (v-for, icons, no inline style, no CDN)
- `.github/instructions/images.instructions.md` — thêm full icon inventory (60 icons), domain mapping, SVG chuẩn guide
