## Why

Dashboard `/` endpoint hiện đã chạy được nhưng còn vài lỗ hổng production-ready: link breakdown trỏ sai route, permission check không khớp scope payload, lỗi 500 leak Supabase message, server build href chuỗi (coupling backend ↔ UI route), query invoices/billing không có defensive limit (rủi ro chạm PostgREST `db_max_rows`), và UI không có error state hay nút refresh. Nên dọn trước khi mở Change 2 (SQL aggregation) — vì Change 2 sẽ đổi shape payload, cần contract sạch trước.

## What Changes

- **BREAKING** `pendingOperations[].href` bị xoá; thay bằng `building: { id, slug, name }` để client tự build link qua `app/utils/routes/operational.ts`.
- `buildingBreakdown` row link đổi target từ `/buildings/${slug}` (đã đúng trong code) → đồng bộ vào spec; loại bỏ wording `/rooms?buildingId=…` trong `dashboard-ui` spec.
- Endpoint chuyển từ `can(user, 'buildings.read')` sang `can(user, 'dashboard.read')`; thêm capability mới trong `server/utils/permissions.ts` cho cả `admin` và `manager`.
- Tất cả 500 từ Supabase được map qua envelope chuẩn (`error.code = 'INTERNAL'` hoặc cụ thể hơn), không leak raw message.
- Thêm `meta.generatedAt: string` (ISO) vào response để client hiển thị "Cập nhật lúc HH:mm" + nút refresh.
- Repository thêm `.limit(2000)` defensive cho 3 query có khả năng grow: `rooms`, `billing_periods`, `invoices`. Đồng thời giới hạn `invoices` theo cửa sổ 6 tháng (`billing_periods.period_year/month` filter) thay vì fetch toàn bộ.
- Hoist query thứ 8 (`buildings` detail) vào `Promise.all` (không còn sequential sau batch); dedup với `buildings count` thành 1 query `select id, slug, name`.
- `useDashboardSummary` composable expose thêm `refresh: () => Promise<void>` và `error` chuẩn hoá; page hiển thị error state (alert + nút "Thử lại") thay vì im lặng.
- Thêm test baseline: 1 unit test `dashboard.service` permission, 1 integration test API trả đúng envelope cho 401/403/200, 1 unit test mapper `pendingOperations → href` ở client.

## Capabilities

### New Capabilities

(không có)

### Modified Capabilities

- `dashboard-api`: bỏ `href` khỏi `pendingOperations`, thêm `building` object + `meta.generatedAt`, đổi permission sang `dashboard.read`, chuẩn hoá lỗi 500.
- `dashboard-ui`: link building breakdown → `/buildings/[slug]`, link pending operations build từ client, hiển thị error state + thời gian cập nhật + refresh button.
- `server-utils`: bổ sung capability `dashboard.read` cho admin và manager trong `PERMISSIONS` map.

## Impact

- **Code**:
  - `server/api/dashboard/summary.get.ts` — không đổi nhiều, có thể thêm `meta`.
  - `server/services/dashboard/index.ts` — đổi capability check.
  - `server/repositories/dashboard/index.ts` — đổi query (limit + window), bỏ build href, trả `building` object, hoist 8th query.
  - `server/utils/permissions.ts` — thêm `dashboard.read`.
  - `app/types/dashboard.ts` — đổi `PendingOperation` shape, thêm `meta`.
  - `app/composables/useDashboardSummary.ts` — expose `refresh` + error chuẩn.
  - `app/pages/index.vue` — dùng `operational.ts` build link, thêm error UI + refresh button + "Cập nhật lúc …".
  - `tests/server/dashboard/*` — thêm permission + envelope tests.
  - `tests/utils/dashboard-summary-shape.test.ts` — cập nhật shape.
- **API consumers**: chỉ có dashboard page nội bộ, không có external consumer → breaking change an toàn.
- **Permissions**: thêm `dashboard.read`, không xoá capability cũ.
- **Database**: không migration.
- **Dependencies**: không thêm package.
- **Performance**: defensive limit + window 6 tháng giảm payload Supabase tối đa; hoist query 8 cải thiện ~150-200ms trên dataset hiện tại.
- **Docs**: cập nhật `openspec/specs/dashboard-api/spec.md`, `dashboard-ui/spec.md`, `server-utils/spec.md`.
