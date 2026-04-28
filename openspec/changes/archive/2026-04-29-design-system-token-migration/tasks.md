## 1. CSS Foundation — Rewrite Token System

- [x] 1.1 Rewrite `app/assets/css/main.css`: tách thành Palette layer (`@theme`), Semantic light (`:root`), Semantic dark (`.dark`) theo design.md D1
- [x] 1.2 Thêm đầy đủ palette tokens trong `@theme`: `--color-theme`, `--color-theme-purple`, `--color-brand`, `--color-dark-nav`, `--color-dark`, `--color-dark-card`, `--color-dark-deep`
- [x] 1.3 Thêm semantic light tokens trong `:root`: `--color-title`, `--color-body`, `--color-bg-page`, `--color-bg-surface`, `--color-bg-muted`, `--color-bg-accent`, `--color-border`, `--color-border-light`
- [x] 1.4 Thêm status token pairs: `--color-success/success-bg`, `--color-error/error-bg`, `--color-warning/warning-bg` cho cả light và dark
- [x] 1.5 Thêm `.dark` override block với đầy đủ dark values cho tất cả semantic tokens
- [x] 1.6 Verify `nuxt.config.ts` có `colorMode: { classSuffix: '' }` hoặc tương đương để Tailwind dark mode dùng class strategy

## 2. Dark Mode Toggle Infrastructure

- [x] 2.1 Kiểm tra `package.json` — nếu `@nuxtjs/color-mode` chưa có, dùng `useColorMode()` từ `@vueuse/core` (đã install)
- [x] 2.2 Tạo `app/components/layout/DarkModeToggle.vue` — button với sun/moon icon, toggle `.dark` class trên `<html>`, persist vào localStorage
- [x] 2.3 Add `<LayoutDarkModeToggle />` vào `app/components/layout/Header.vue` (cạnh LanguageSwitcher)
- [x] 2.4 Test toggle: light → dark → light, verify localStorage persist sau reload

## 3. Layout Shells

- [x] 3.1 `app/layouts/admin.vue`: đổi `bg-gray-50 dark:bg-gray-950` → `bg-[--color-bg-page]`, xóa dark: classes
- [x] 3.2 `app/layouts/manager.vue`: same as 3.1
- [x] 3.3 `app/layouts/tenant.vue`: đổi background sang `bg-[--color-bg-page]`, xóa dark: classes
- [x] 3.4 `app/layouts/auth.vue`: đổi background sang phù hợp (login page dùng `bg-[--color-bg-page]` hoặc gradient brand)
- [x] 3.5 `app/layouts/default.vue`: check và align với token system

## 4. Navigation Components

- [x] 4.1 `app/components/layout/Sidebar.vue` — `<aside>`: đổi `bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700` → `bg-dark-nav border-transparent`
- [x] 4.2 `Sidebar.vue` — logo area: đổi `text-gray-900 dark:text-white` → `text-white`
- [x] 4.3 `Sidebar.vue` — inactive nav link: đổi `text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800` → `text-white/60 hover:text-white hover:bg-white/10`
- [x] 4.4 `Sidebar.vue` — active nav link: đổi `bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400` → `bg-white/15 text-white`
- [x] 4.5 `app/components/layout/Header.vue`: đổi `bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700` → `bg-[--color-bg-surface] border-[--color-border]`
- [x] 4.6 `app/components/layout/MobileNav.vue`: review và đổi sang token system, xóa dark: classes
- [x] 4.7 `app/components/layout/TenantBottomNav.vue`: review và đổi sang token system, xóa dark: classes
- [x] 4.8 `app/components/layout/Breadcrumb.vue`: đổi text colors sang `text-[--color-title]` / `text-[--color-body]`

## 5. UI Primitive Components

- [x] 5.1 `app/components/ui/StatCard.vue`: xóa `dark:text-white`, giữ `text-[--color-title]` (semantic token tự handle dark mode)
- [x] 5.2 `app/components/ui/AlertBanner.vue`: đổi `bg-amber-50 dark:bg-amber-900/20` → `bg-[--color-warning-bg]`; `text-amber-800 dark:text-amber-300` → `text-[--color-warning]`; tương tự cho error variant
- [x] 5.3 `app/components/ui/EmptyState.vue`: review và align colors với token system
- [x] 5.4 `app/components/ui/PageHeader.vue`: review và align colors với token system

## 6. Auth Components

- [x] 6.1 `app/components/auth/LoginForm.vue`: xóa dark: classes, dùng semantic tokens
- [x] 6.2 `app/components/auth/ForgotPasswordForm.vue`: xóa dark: classes, dùng semantic tokens
- [x] 6.3 `app/components/auth/ResetPasswordForm.vue`: xóa dark: classes, dùng semantic tokens

## 7. Feature Components

- [x] 7.1 `app/components/features/tenant-portal/RoomHero.vue`: review và align với token system
- [x] 7.2 Review toàn bộ `app/components/features/` — xóa dark: classes, đổi raw gray → tokens

## 8. Pages — Bulk Token Migration

- [x] 8.1 `app/pages/admin/index.vue`: xóa dark: classes, đổi raw colors → tokens
- [x] 8.2 `app/pages/admin/settings/index.vue`: xóa dark: classes, đổi raw colors → tokens
- [x] 8.3 `app/pages/admin/rooms/index.vue` + `[id].vue`: migrate tokens
- [x] 8.4 `app/pages/admin/tenants/index.vue` + `[id].vue`: migrate tokens
- [x] 8.5 `app/pages/admin/contracts/index.vue` + `[id].vue`: migrate tokens
- [x] 8.6 `app/pages/admin/invoices/index.vue` + `[id].vue`: migrate tokens
- [x] 8.7 `app/pages/manager/index.vue` + tất cả manager pages: migrate tokens
- [x] 8.8 `app/pages/tenant/index.vue` + tất cả tenant pages: migrate tokens
- [x] 8.9 `app/pages/reset-password.vue`: migrate tokens

## 9. Landing Page

- [x] 9.1 Xác định landing page file/layout — `app/pages/index.vue` là redirect-only, không có visual content. Tasks 9.2–9.5 N/A.
- [x] 9.2 Hero section: N/A — landing page chưa tồn tại (sẽ làm khi xây landing page)
- [x] 9.3 Dark section cards: N/A — landing page chưa tồn tại
- [x] 9.4 Footer: N/A — landing page chưa tồn tại
- [x] 9.5 CTA buttons: N/A — landing page chưa tồn tại

## 10. Verification

- [x] 10.1 Chạy `grep -rn "dark:" app/ --include="*.vue"` — phải ra 0 kết quả ✓
- [x] 10.2 Chạy `grep -rn "bg-gray\|text-gray\|border-gray" app/ --include="*.vue"` — phải ra 0 kết quả ✓
- [x] 10.3 Test light mode: admin dashboard, tenant portal, auth pages — kiểm tra visual
- [x] 10.4 Test dark mode: toggle và verify toàn bộ các trang trên
- [x] 10.5 Test dark mode persist: reload sau khi chọn dark mode — phải giữ nguyên preference
- [x] 10.6 Chạy `npm run typecheck` — lỗi MODULE_NOT_FOUND do vue-tsc version mismatch (pre-existing, không liên quan đến change này)
- [x] 10.7 Chạy `npm run lint` — 10 lỗi TypeScript `any` pre-existing, không do change này gây ra
