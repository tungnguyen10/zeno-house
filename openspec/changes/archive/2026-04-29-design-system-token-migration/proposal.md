## Why

Codebase hiện tại dùng song song 2 hệ thống màu: raw Tailwind utilities (`bg-gray-50`, `text-gray-700`, `dark:bg-gray-900`...) và custom design tokens đã định nghĩa trong `main.css`. Kết quả là UI thiếu nhất quán, không có dark mode thực sự, và mỗi component quyết định màu sắc theo cách riêng — gây khó bảo trì khi scale. Token system cần được unify thành ngôn ngữ màu duy nhất cho toàn project.

## What Changes

- **Rewrite `app/assets/css/main.css`**: tách thành 3 layer rõ ràng — palette (bất biến), semantic light (`:root`), semantic dark (`.dark`)
- **Thêm dark mode token set đầy đủ** cho tất cả semantic tokens (bg, text, border, status)
- **Xóa toàn bộ `dark:` Tailwind classes** khỏi components — dark mode được handle hoàn toàn bởi CSS `.dark` class trên `<html>`
- **Replace raw Tailwind colors** (`gray-*`, `white`, `black`) bằng semantic tokens trong mọi layout, component, page
- **Sidebar dùng `bg-dark-nav`** (`#001C49`) thay vì `bg-white dark:bg-gray-900`
- **Layout shells** dùng `bg-bg-page` thay vì `bg-gray-50 dark:bg-gray-950`
- **Thêm dark mode toggle** vào Header để user có thể switch

## Capabilities

### New Capabilities

- `design-system-tokens`: Hệ thống token màu đầy đủ gồm palette layer + semantic layer với light/dark variants, áp dụng nhất quán cho toàn app

### Modified Capabilities

- `app-navigation`: Navigation layout (Sidebar, Header) thay đổi màu sắc — sidebar chuyển sang dark-nav, header dùng semantic tokens

## Impact

- `app/assets/css/main.css` — rewrite toàn bộ
- `app.config.ts` — verify primary color alignment với token system
- `app/layouts/` — 4 layout files (admin, manager, tenant, auth)
- `app/components/layout/` — Sidebar, Header, MobileNav, TenantBottomNav, Breadcrumb
- `app/components/ui/` — StatCard, AlertBanner, EmptyState, PageHeader
- `app/components/auth/` — LoginForm, ForgotPasswordForm, ResetPasswordForm
- `app/components/features/` — RoomHero và các feature components
- `app/pages/` — ~40 page files (bulk replace)
- Không có API changes, không có DB changes, không có breaking changes với external systems
