## 1. Setup

- [x] 1.1 Cài `clsx` vào dependencies: `npm install clsx`
- [x] 1.2 Cập nhật `app/app.vue` — thay `<NuxtWelcome />` bằng `<NuxtRouteAnnouncer />` và `<NuxtLayout><NuxtPage /></NuxtLayout>`

## 2. Layouts

- [x] 2.1 Tạo `app/layouts/default.vue` — admin shell: sidebar trái (w-64) + main area (header + content)
- [x] 2.2 Tạo `app/layouts/auth.vue` — layout tối giản: centered, không có sidebar/header

## 3. App Shell Components

- [x] 3.1 Tạo `app/utils/constants/navigation.ts` — define `NavItem` type và export `NAV_ITEMS` array (Dashboard, Tòa nhà, Phòng, Khách thuê, Hợp đồng)
- [x] 3.2 Tạo `app/components/app/AppSidebar.vue` — nhận `navItems: NavItem[]`, render logo + nav links + user placeholder, highlight active route với `useRoute()`
- [x] 3.3 Tạo `app/components/app/AppHeader.vue` — hiển thị page title prop và user avatar placeholder, hamburger button trên mobile để toggle sidebar

## 4. UI Primitives

- [x] 4.1 Tạo `app/components/ui/UiButton.vue` — variant (primary/secondary/danger), size (sm/md/lg), loading, disabled, clsx cho class composition
- [x] 4.2 Tạo `app/components/ui/UiInput.vue` — label, modelValue, error message, required, emit update:modelValue
- [x] 4.3 Tạo `app/components/ui/UiModal.vue` — open prop, title, emit close, Teleport to body, backdrop click handler
- [x] 4.4 Tạo `app/components/ui/UiStatusBadge.vue` — status prop, color map với clsx, fallback gray cho unknown status
- [x] 4.5 Tạo `app/components/ui/UiEmptyState.vue` — title, description (optional), slot action, centered layout
- [x] 4.6 Tạo `app/components/ui/UiSkeleton.vue` — animate-pulse shimmer, nhận class để control kích thước

## 5. Pages

- [x] 5.1 Tạo `app/pages/index.vue` — sử dụng default layout, hiển thị heading "Dashboard", placeholder content
- [x] 5.2 Tạo `app/pages/login.vue` — khai báo `definePageMeta({ layout: 'auth' })`, placeholder form (chưa nối auth)

## 6. Documentation

- [x] 6.1 Tạo `docs/architecture/rules.md` — ghi lại architecture rules: state rules, API rules, component rules, permission rules từ v0.1 plan

## 7. Verify

- [x] 7.1 Chạy `npm run dev`, truy cập `/` — default layout với sidebar và header render đúng
- [x] 7.2 Truy cập `/login` — auth layout render đúng, không có sidebar/header
- [x] 7.3 Kiểm tra sidebar highlight đúng active route khi navigate
- [x] 7.4 Kiểm tra sidebar collapse/expand trên viewport nhỏ hơn lg
- [x] 7.5 Chạy `npx nuxi typecheck` — không có TypeScript error
