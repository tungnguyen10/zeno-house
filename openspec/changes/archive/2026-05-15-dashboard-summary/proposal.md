## Why

Dashboard tại `/` hiện chỉ có skeleton placeholder — không hiển thị dữ liệu thực. Sau khi buildings, rooms, tenants, room assignments, và contracts đã có CRUD đầy đủ, bước tiếp theo là hiển thị tổng quan hệ thống để admin có cái nhìn nhanh về tình trạng bất động sản.

## What Changes

Thay thế skeleton placeholder tại `/` bằng dashboard thực với:
- Stat cards: tổng số buildings, rooms (breakdown status), tenants, active contracts
- Building occupancy table: từng building với số phòng available / occupied / maintenance

## Capabilities

### New Capabilities
- `dashboard-api`: `GET /api/dashboard/summary` — aggregate stats từ tất cả tables trong 1 response
- `dashboard-ui`: Trang `/` hiển thị stat cards + building breakdown. Component `AppStatCard` tái sử dụng cho mỗi card.

### Modified Capabilities
<!-- none -->

## Impact

- Thêm `server/api/dashboard/summary.get.ts` + service + repository
- Thêm `app/composables/useDashboardSummary.ts`
- Thêm `app/components/app/AppStatCard.vue`
- Cập nhật `app/pages/index.vue` — thay skeleton bằng component thực
