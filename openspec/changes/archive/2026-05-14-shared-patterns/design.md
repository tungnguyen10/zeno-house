## Context

Sau khi implement buildings (F0.1.5) và rooms (F0.2.1), 2 pattern lặp lại xuất hiện:

1. **Delete confirmation modal**: Cả 2 detail pages có cùng ~20 dòng logic (`showDeleteModal`, `isDeleting`, `confirmDelete()`, `<UiModal>` với title/body/footer cố định). Hiện là copy-paste.
2. **Pagination thiếu ở rooms list**: `useBuildingList` expose `page`/`totalPages` và có pagination UI. `useRoomList` chỉ expose `total` nhưng không có page controls — inconsistent trước khi thêm tenants.

## Goals / Non-Goals

**Goals:**
- Tạo `UiConfirmModal` — reusable component thay thế inline delete modal ở cả 2 domain
- Chuẩn hóa pagination: thêm `page`/`totalPages` vào `useRoomList`, thêm pagination UI vào rooms list page
- Refactor buildings và rooms detail pages dùng `UiConfirmModal`

**Non-Goals:**
- Không extract toàn bộ page layout thành generic components (quá sớm, chưa đủ 3 domain)
- Không thêm server-side pagination cho rooms API (đã có `limit` param, chỉ thiếu client UI)
- Không thay đổi API contracts

## Decisions

### D1: `UiConfirmModal` nhận props thay vì slot cho content

**Quyết định:** Props-based API: `title`, `message`, `confirmLabel` (default "Xoá"), `loading`. Emit `confirm` / `cancel`.

**Thay vì:** Slot-based (flexible nhưng verbose tại call site).

**Lý do:** Tất cả use cases hiện tại chỉ cần title + message text. Props API gọn hơn ở call site. Nếu sau này cần complex content thì thêm default slot.

### D2: Pagination trong `useRoomList` mirror `useBuildingList`

**Quyết định:** Thêm `page` (ref, default 1), `totalPages` (computed từ `total` / limit), `limit` (const 20) vào `useRoomList`. Reset `page` về 1 khi filter thay đổi.

**Thay vì:** Tạo generic `usePaginatedList` composable.

**Lý do:** Chỉ có 2 nơi dùng — nguyên tắc "no abstraction until 3 uses". Mirror pattern trực tiếp là đủ.

### D3: Pagination UI inline trong page (không extract component)

**Quyết định:** Copy pagination markup từ buildings list vào rooms list.

**Thay vì:** Tạo `UiPagination` component.

**Lý do:** Chưa đủ 3 domains để justify component. Rooms và buildings dùng cùng markup đơn giản — extract ở bước sau khi tenants cũng cần.

## Risks / Trade-offs

- [Risk] `UiConfirmModal` API quá đơn giản cho contracts (invoice delete cần thêm context) → Mitigation: thêm `details` slot khi cần, API hiện tại đủ cho v0.2 scope
- [Trade-off] Pagination UI copy-paste giữa 2 pages → Chấp nhận, sẽ extract sau khi tenants
