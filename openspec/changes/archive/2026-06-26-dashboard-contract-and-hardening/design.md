## Context

Dashboard `/` đã ship MVP nhưng spike đo cuối tháng 6/2026 phát hiện vài vấn đề có thể trở thành sự cố khi prod data lớn dần:

- Endpoint `/api/dashboard/summary` chạy 7 Supabase query song song + 1 query thứ 8 (`buildings` detail) **tuần tự** sau `Promise.all` — lãng phí ~150–200 ms.
- Query `invoices` không có window filter và không có `.limit()` → khi tổng số invoice > `pgrst.db_max_rows` (mặc định 1000) sẽ bị PostgREST cắt im lặng, payload sai mà không có lỗi.
- `pendingOperations[].href` được build ở server (`/billing/${slug}/${period}`) — coupling backend ↔ UI route. Khi đổi route phải đụng cả server và UI.
- Permission gate dùng `can(user, 'buildings.read')` nhưng payload bao gồm billing + contracts + tenants → semantics sai. Manager bị từ chối nếu role không có `buildings.read`, dù xứng đáng đọc dashboard.
- Lỗi từ Supabase được throw thẳng (`createError({ statusCode: 500, message: error.message })`) → leak query/schema info ra client.
- UI không hiển thị error state, không có thời gian cập nhật, không có nút refresh. User chỉ thấy loading skeleton vô tận khi API fail.
- Spec `dashboard-ui` mô tả link breakdown trỏ `/rooms?buildingId=<id>` nhưng code thực tế trỏ `/buildings/${slug}` — drift.

Change này dọn 7 vấn đề trên trước khi sang Change 2 (gói 8 query thành 1 RPC `get_dashboard_summary`), tránh phải đụng contract 2 lần.

## Goals / Non-Goals

**Goals:**
- API trả đúng envelope chuẩn ở mọi path (200 / 401 / 403 / 500).
- Payload không leak route string của UI; client tự build link.
- Permission check khớp đúng scope payload (`dashboard.read`).
- Defensive limits chống PostgREST silent truncate.
- UI có error state + refresh + "Cập nhật lúc HH:mm".
- Spec text khớp 100% với code thực tế sau khi ship change này.

**Non-Goals:**
- Không gom 8 query thành 1 RPC (Change 2).
- Không thêm chart library / sparkline (Change 3).
- Không refactor `useDashboardSummary` thành Pinia store.
- Không thêm caching (HTTP cache, SWR, ISR) — chờ đo p95 thực tế sau Change 2.
- Không thay đổi seed/migration.

## Decisions

### D1. Bỏ `href` ở `pendingOperations`, thêm `building: { id, slug, name }`

Server chỉ trả data, client build link qua `app/utils/routes/operational.ts`. Lý do:
- Decoupling backend khỏi UI route.
- `operational.ts` đã có sẵn `billingWorkspacePath(building, year, month)` → client gọi 1 dòng.
- Khi đổi route (ví dụ thêm tenant portal), chỉ sửa 1 chỗ ở UI.

**Alternative xem xét:** giữ `href` nhưng đổi tên thành `path` và document rõ là server-built — vẫn coupling, loại.

### D2. Thêm capability `dashboard.read` cấp cho cả admin và manager

Lý do:
- `buildings.read` không cover được billing/contract scope trong payload.
- Sau này dễ tách quyền (ví dụ tenant không được xem dashboard) mà không phải đổi nhiều chỗ.

**Alternative xem xét:** check `OR` nhiều capability (`buildings.read || billing.read`) — verbose, khó audit. Loại.

### D3. Defensive limit + 6-month window cho invoices

Áp dụng:
- `invoices` query: filter `billing_periods.period_year >= currentYear - 1` AND chỉ lấy 6 month gần nhất, kèm `.limit(2000)`.
- `rooms` query: `.limit(2000)` (đủ cho 20 building × 100 phòng).
- `billing_periods` query: `.limit(500)` (đủ cho 20 building × 25 tháng).

Lý do:
- Mặc định `pgrst.db_max_rows = 1000` → fetch toàn bộ invoice là time bomb.
- 6 tháng đã đủ cho `billingTrend` (chỉ dùng 6 phần tử cuối).
- Limit 2x kỳ vọng để cảnh báo sớm (nếu hit limit, log warning thay vì silent truncate).

**Alternative xem xét:** dùng `head=true + count=exact` để biết tổng, lấy data riêng — thêm 1 round-trip, không đáng. Loại.

### D4. Error envelope chuẩn cho 500

Tạo helper `throwInternal(error, context)` trong `server/utils/errors.ts` (nếu chưa có) wrap Supabase error → envelope `{ error: { code: 'INTERNAL', message: 'Lỗi hệ thống, vui lòng thử lại.', details: { context } } }` và log raw error ra server console.

Lý do:
- Không leak schema/SQL info ra client.
- Vẫn debug được qua server log.
- Đồng nhất với `throwForbidden / throwNotFound / throwValidationError`.

**Alternative xem xét:** chỉ throw `createError({ statusCode: 500 })` không qua envelope — phá pattern hiện tại. Loại.

### D5. `meta.generatedAt` ở root response

Response envelope:
```ts
{ data: DashboardSummary, meta: { generatedAt: string /* ISO */ } }
```

UI hiển thị "Cập nhật lúc HH:mm" + nút refresh gọi lại `useDashboardSummary().refresh()`.

Lý do:
- User biết data "tươi" hay "cũ".
- Mở đường cho caching ở Change sau (cache có thể đặt `generatedAt` cũ hơn `now()`).

**Alternative xem xét:** trả `Date` object — JSON không có Date type. Loại.

### D6. Hoist 8th query vào `Promise.all`, dedup với buildings count

Hiện có:
- Query 1: `buildings count head` (chỉ cần `count`)
- Query 8 (sequential): `buildings select id, slug, name order by name`

Gộp thành 1 query: `buildings select id, slug, name order by name` rồi đếm `.length` ở JS. Đưa vào `Promise.all`. Lý do:
- Tiết kiệm 1 round-trip (~150–200 ms).
- Đơn giản hoá repository code.
- Số building <= 100 trong v0.x → đếm JS rẻ.

**Alternative xem xét:** giữ count riêng và optimize bằng PostgREST view — over-engineering ở scale này. Loại.

### D7. `useDashboardSummary` expose `refresh` + `error`

Hiện composable chỉ return `{ summary, isLoading, error }`. Thêm `refresh: () => Promise<void>` từ `useFetch` returns (`{ data, status, error, refresh }`).

Lý do:
- UI cần re-fetch sau khi user click "Thử lại" hoặc "Refresh".
- `error` cần normalize từ `useFetch` error format → string message chuẩn `'Không tải được dữ liệu dashboard. Vui lòng thử lại.'` để page không phải tự xử lý.

## Risks / Trade-offs

- **[Risk]** Breaking change `pendingOperations[].href` → tất cả test/snapshot đang reference field này sẽ fail. **Mitigation**: search workspace cho `pendingOperations.*href` trước khi ship, cập nhật cùng PR.
- **[Risk]** Thêm capability `dashboard.read` nhưng test fixtures user cũ không có → 403 trong test. **Mitigation**: cập nhật `tests/__fixtures__` user role mappings.
- **[Risk]** 6-month window có thể cắt mất data lịch sử nếu dashboard sau này muốn hiển thị > 6 tháng. **Mitigation**: window tính từ `currentPeriod`, có thể nới dễ dàng; Change 2 sẽ refactor thành RPC nhận `p_months` param.
- **[Risk]** `meta.generatedAt` được sinh ở repo trước Supabase query — nếu query mất 1s thì timestamp lệch 1s với data thực. **Mitigation**: sinh `generatedAt` SAU khi `Promise.all` xong, ngay trước khi return.
- **[Trade-off]** Defensive `.limit(2000)` sẽ silent-cap data thật ở scale > 2k rows. **Mitigation**: log warning khi `rows.length === 2000`, sẽ catch trước khi user thấy bug; Change 2 RPC sẽ aggregate ở SQL nên không còn vấn đề.

## Migration Plan

1. Branch từ `develop`: `feat/dashboard-contract-and-hardening`.
2. Update spec deltas + commit (`docs(openspec): propose dashboard-contract-and-hardening`).
3. Implement theo `tasks.md` thứ tự: server-utils → repo → service → API → types → composable → page → tests.
4. Verify local: `npm run dev` + click dashboard, force error bằng cách tắt Supabase project tạm thời, refresh button.
5. `npx openspec verify --change dashboard-contract-and-hardening`.
6. PR review, merge, archive change qua `/opsx:archive`.

**Rollback strategy:** vì là breaking change nhỏ ở 1 endpoint duy nhất, rollback bằng revert commit. Không có migration DB nên rollback an toàn.

## Open Questions

- (none — đã chốt qua explore mode trước đó)
