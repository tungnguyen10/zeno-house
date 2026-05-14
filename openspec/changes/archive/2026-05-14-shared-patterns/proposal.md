## Why

Sau khi implement buildings và rooms, một số UI pattern lặp lại hoàn toàn giữa 2 domain (delete confirmation modal, pagination). Trước khi thêm tenants và contracts, cần extract các pattern này thành shared components và bổ sung chỗ còn thiếu để giữ codebase nhất quán.

## What Changes

- Tạo `UiConfirmModal` component — extract pattern delete confirmation hiện đang copy-paste trong cả buildings và rooms detail pages (`showDeleteModal`, `isDeleting`, `confirmDelete()`)
- Thêm pagination cho rooms list page — buildings list đã có pagination (`page`, `totalPages`) nhưng rooms list chưa có; cần chuẩn hóa trước khi tenants
- Refactor `app/pages/buildings/[id]/index.vue` và `app/pages/rooms/[id]/index.vue` dùng `UiConfirmModal` thay vì inline modal logic
- Cập nhật `useRoomList` để expose `page` và `totalPages` như `useBuildingList`

## Capabilities

### New Capabilities

- `confirm-modal`: `UiConfirmModal` component — reusable confirm/delete dialog nhận `title`, `message`, `loading`, emit `confirm`/`cancel`

### Modified Capabilities

- `rooms-client`: Thêm requirement pagination cho room list page (hiện thiếu so với buildings-client spec)

## Impact

- `app/components/ui/UiConfirmModal.vue` — file mới
- `app/composables/rooms/useRoomList.ts` — thêm `page`, `totalPages`
- `app/pages/buildings/[id]/index.vue` — refactor dùng UiConfirmModal
- `app/pages/rooms/[id]/index.vue` — refactor dùng UiConfirmModal
- `app/pages/rooms/index.vue` — thêm pagination UI
- Không có breaking change API, không migration DB
