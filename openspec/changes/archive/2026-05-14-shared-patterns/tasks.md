## 1. UiConfirmModal Component

- [x] 1.1 Tạo `app/components/ui/UiConfirmModal.vue` — props: `open`, `title`, `message`, `confirmLabel` (default "Xoá"), `loading`; emit `confirm`, `cancel`
- [x] 1.2 Refactor `app/pages/buildings/[id]/index.vue` — thay inline modal logic bằng `UiConfirmModal`
- [x] 1.3 Refactor `app/pages/rooms/[id]/index.vue` — thay inline modal logic bằng `UiConfirmModal`

## 2. Rooms List Pagination

- [x] 2.1 Cập nhật `app/composables/rooms/useRoomList.ts` — thêm `page` (ref, default 1), `limit` (const 20), `totalPages` (computed); reset `page` khi filter thay đổi; thêm `page`/`limit` vào query params
- [x] 2.2 Cập nhật `app/pages/rooms/index.vue` — thêm pagination UI (prev/next buttons) giống buildings list

## 3. Verify

- [x] 3.1 Chạy `npm run lint && npm run typecheck` — 0 errors
- [x] 3.2 Test thủ công: delete building → confirm modal đúng; delete room → confirm modal đúng
- [x] 3.3 Test pagination rooms: chạy qua page 2+, filter reset về page 1
