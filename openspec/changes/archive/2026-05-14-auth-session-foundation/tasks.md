## 1. Foundation

- [x] 1.1 Tạo `app/utils/constants/roles.ts` — export ROLES object và UserRole type
- [x] 1.2 Tạo `app/stores/auth.ts` — Pinia store với `user`, `isAuthenticated`, `role`, `isAdmin` dựa trên `useSupabaseUser()`
- [x] 1.3 Tạo `app/composables/auth/useAuth.ts` — export `login(email, password)` và `logout()`

## 2. Client Middleware

- [x] 2.1 Tạo `app/middleware/auth.global.ts` — kiểm tra session, redirect `/login` nếu unauthenticated và route không public
- [x] 2.2 Tạo `app/middleware/guest.ts` — redirect `/` nếu đã authenticated, áp dụng trên login page

## 3. Server Auth Layer

- [x] 3.1 Tạo `server/middleware/01.auth.ts` — gọi `serverSupabaseUser(event)` và đính vào `event.context.user`
- [x] 3.2 Tạo `server/utils/auth.ts` — export `requireAuth(event)` helper ném 401 nếu không có user

## 4. Login Page

- [x] 4.1 Update `app/pages/login.vue` — wire form với `useAuth().login()`, xử lý loading state và error message
- [x] 4.2 Thêm `definePageMeta({ middleware: 'guest' })` vào login page

## 5. AppHeader & AppSidebar

- [x] 5.1 Update `app/components/app/AppHeader.vue` — hiển thị email user từ auth store, thêm nút logout gọi `useAuth().logout()`
- [x] 5.2 Update `app/components/app/AppSidebar.vue` — footer hiển thị email và role thật từ auth store

## 6. Supabase SQL

- [x] 6.1 Tạo `supabase/seeds/set_admin_role.sql` — SQL script set `app_metadata.role` cho admin user, chạy qua Supabase SQL Editor
