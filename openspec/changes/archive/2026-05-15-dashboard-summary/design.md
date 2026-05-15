## Context

Tất cả domain entities đã có CRUD: buildings, rooms (status: available/occupied/maintenance), tenants, room_assignments (end_date IS NULL = active), contracts (status field). Dashboard cần aggregate data từ các tables này để hiển thị tổng quan.

**Constraint**: Dashboard phải load nhanh — tránh N+1 queries. Dùng Supabase `select` với `count` và group-by thay vì fetch tất cả rows rồi đếm ở application layer.

## Goals / Non-Goals

**Goals:**
- Stat cards: total buildings, rooms breakdown, total tenants, active contracts
- Building occupancy: mỗi building hiển thị tổng phòng + breakdown available/occupied/maintenance
- Single API call từ client
- Loading skeleton giữ nguyên trong khi fetch

**Non-Goals:**
- Charts / graphs (phase sau)
- Recent activity feed (phase sau)
- Real-time updates / websocket (phase sau)
- Per-manager scoped view (admin only trong v0.2)

## Decisions

**D1 — Single `GET /api/dashboard/summary` endpoint**
Trả về tất cả stats trong 1 response để dashboard chỉ cần 1 network call. Response shape:
```ts
{
  buildings: { total: number }
  rooms: { total: number; available: number; occupied: number; maintenance: number }
  tenants: { total: number }
  contracts: { active: number }
  buildingBreakdown: Array<{
    id: string; name: string
    rooms: { total: number; available: number; occupied: number; maintenance: number }
  }>
}
```

**D2 — Server fetches all rooms in 1 query, aggregates in application layer**
- `rooms`: single `select('id, status, building_id')` — aggregate global + per-building stats in JS
- `contracts` active: filter `status = 'active'` với `count: 'exact'`
- `buildingBreakdown`: buildings list + room map built from the same rooms query above
- Tránh N+1: tất cả 5 queries chạy song song qua `Promise.all`

**D3 — `AppStatCard` là UI primitive trong `app/components/app/`**
Card đơn giản: title, value, optional subtitle/description. Reusable cho các stat metrics.

**D4 — Building breakdown dùng table/list đơn giản**
Row mỗi building: tên + colored counts (available=green, occupied=cyan, maintenance=yellow). Link đến `/rooms?buildingId=...` để drill-down.

**D5 — `useDashboardSummary` composable — `useFetch` + isLoading**
Pattern giống các composables khác. Không cần refresh manual (data tương đối stable trong session).

## Risks / Trade-offs

- **Room status drift**: room.status có thể lệch khỏi assignment record nếu edit thủ công → dashboard hiển thị room.status, không phải assignment count. Acceptable cho v0.2.
- **Contract "active" definition**: dùng `status = 'active'` field, không phải date range check — phụ thuộc contracts module đặt status đúng.
