## 1. Permission capability

- [x] 1.1 Thêm `'dashboard.read'` vào `PERMISSIONS.admin` set trong `server/utils/permissions.ts`
- [x] 1.2 Thêm `'dashboard.read'` vào `PERMISSIONS.manager` set
- [x] 1.3 Cập nhật unit test `tests/server/utils/permissions.test.ts` cover `dashboard.read` cho admin / manager / null role

## 2. Server error helper

- [x] 2.1 Thêm `throwInternal(originalError: unknown, context?: string): never` vào `server/utils/errors.ts`
- [x] 2.2 Helper log `originalError` (message, code, details, hint nếu có) ra `console.error` với prefix `[INTERNAL]`
- [x] 2.3 Throw `createError({ statusCode: 500, data: { error: { code: 'INTERNAL', message: 'Lỗi hệ thống, vui lòng thử lại.', details: context ? { context } : undefined } } })`
- [x] 2.4 Unit test: throw đúng shape, không leak `originalError.message` vào body response

## 3. Dashboard types

- [x] 3.1 Trong `app/types/dashboard.ts`, đổi `PendingOperation` interface: bỏ field `href`, `buildingId`, `buildingSlug`, `buildingName`; thay bằng `building: { id: string; slug: string; name: string }`
- [x] 3.2 Thêm `export interface DashboardSummaryMeta { generatedAt: string }`
- [x] 3.3 Export type alias `DashboardSummaryResponse = ApiSuccess<DashboardSummary, DashboardSummaryMeta>` (hoặc dùng existing `ApiSuccess` shape; sync với `app/types/api.ts`)

## 4. Dashboard repository

- [x] 4.1 Gộp query 1 (`buildings count head`) và query 8 (`buildings select id, slug, name`) thành một query `select('id, slug, name').order('name')` rồi đếm `.length` ở JS
- [x] 4.2 Đưa toàn bộ 7 query còn lại + query gộp ở 4.1 vào cùng một `Promise.all` (không còn sequential)
- [x] 4.3 `rooms` query thêm `.limit(2000)`
- [x] 4.4 `billing_periods` query thêm `.limit(500)`
- [x] 4.5 `invoices` query: tính cửa sổ 6 tháng `(currentYear, currentMonth)` → `(startYear, startMonth)`; filter qua join `billing_periods.period_year >= startYear AND (period_year > startYear OR period_month >= startMonth)`; thêm `.limit(2000)`
- [x] 4.6 Mỗi query: thay `throw createError({ statusCode: 500, message: error.message })` bằng `throwInternal(error, 'dashboard.repository.<queryName>')`
- [x] 4.7 Bỏ logic build `href` ở mảng `pendingOperations`; thay vào mỗi item gắn `building: { id, slug, name }` lookup từ buildings Map
- [x] 4.8 Sau khi `Promise.all` xong và trước khi return, log warning `[dashboard] limit hit` nếu `rooms.length === 2000` hoặc `invoices.length === 2000` hoặc `billing_periods.length === 500`
- [x] 4.9 Trả về `{ summary, generatedAt: new Date().toISOString() }` (service layer sẽ gói envelope)

## 5. Dashboard service

- [x] 5.1 Đổi permission check trong `server/services/dashboard/index.ts` từ `can(user, 'buildings.read')` sang `can(user, 'dashboard.read')`
- [x] 5.2 Throw qua `throwForbidden(...)` thay vì raw `createError` (nếu đang dùng raw)
- [x] 5.3 Service return `{ data: summary, meta: { generatedAt } }`

## 6. Dashboard API handler

- [x] 6.1 `server/api/dashboard/summary.get.ts` chỉ chuyển nguyên `{ data, meta }` từ service (không tự wrap thêm)
- [x] 6.2 Đảm bảo handler không catch error (để Nuxt + envelope helper xử lý)

## 7. Composable `useDashboardSummary`

- [x] 7.1 Cập nhật generic type `useFetch<ApiSuccess<DashboardSummary, DashboardSummaryMeta>>` để bao luôn meta
- [x] 7.2 Return shape: `{ summary, meta, isLoading, error, refresh }` — `meta` là `computed(() => data.value?.meta ?? null)`, `refresh` lấy từ `useFetch` returns
- [x] 7.3 Normalize `error` thành `string | null`: nếu `useFetch` error có `data.error.message` → dùng; else generic `'Không tải được dữ liệu dashboard. Vui lòng thử lại.'`

## 8. Dashboard page

- [x] 8.1 `app/pages/index.vue`: destructure thêm `meta`, `error`, `refresh` từ `useDashboardSummary()`
- [x] 8.2 Thêm error block (alert + button "Thử lại" gọi `refresh()`) hiển thị khi `error !== null`; khi error thì KHÔNG render skeleton + KHÔNG render data
- [x] 8.3 Thêm header strip "Cập nhật lúc HH:mm" + nút icon refresh ngay góc trên dashboard; format giờ qua helper trong `app/utils/format/`
- [x] 8.4 Building breakdown row: dùng `to="buildingPath(building)"` từ `app/utils/routes/operational.ts` (đã trỏ `/buildings/<slug>`)
- [x] 8.5 Pending operations: import `billingWorkspacePath` từ `operational.ts`; mỗi item compute link bằng `billingWorkspacePath(item.building, year, month)` từ `item.period` (`YYYY-MM` → parse year/month)
- [x] 8.6 Bỏ tất cả reference tới `item.href`, `item.buildingId`, `item.buildingSlug`, `item.buildingName`

## 9. Forbidden state

- [x] 9.1 Trong page hoặc page-level wrapper, khi `error` là 403 (`error.code === 'FORBIDDEN'` từ response body), render forbidden block "Bạn không có quyền xem dashboard" thay vì error chung
- [x] 9.2 Composable expose thêm `errorCode: string | null` để page phân biệt error type

## 10. Tests

- [x] 10.1 Cập nhật `tests/utils/dashboard-summary-shape.test.ts`: shape `PendingOperation` mới (`building` thay vì `href`), thêm `meta.generatedAt`
- [x] 10.2 Thêm `tests/server/dashboard/permissions.test.ts`: admin pass, manager pass, role null → 403
- [x] 10.3 Thêm `tests/server/dashboard/envelope.test.ts`: 401 (no cookie), 200 (mocked happy path) đúng envelope, 500 (mocked Supabase throw) không leak raw message
- [x] 10.4 Thêm test pure-function cho client link builder: input `pendingOperation` → output đúng path qua `billingWorkspacePath`
- [x] 10.5 Update các snapshot/fixture còn reference `href`/`buildingId`/`buildingSlug`/`buildingName` ở `pendingOperations`

## 11. Spec sync & docs

- [x] 11.1 Sync delta `specs/dashboard-api/spec.md` vào `openspec/specs/dashboard-api/spec.md` (qua `openspec sync-specs` hoặc khi archive)
- [x] 11.2 Sync delta `specs/dashboard-ui/spec.md` vào `openspec/specs/dashboard-ui/spec.md`
- [x] 11.3 Sync delta `specs/server-utils/spec.md` vào `openspec/specs/server-utils/spec.md`

## 12. Verify

- [x] 12.1 `npm run typecheck` pass
- [x] 12.2 `npm run lint` pass
- [x] 12.3 `npm run test` pass (unit + integration thêm ở Group 10)
- [x] 12.4 Manual: dev server, login admin → dashboard load, click breakdown → `/buildings/<slug>`, click pending → đúng `/billing/<slug>/<period>`, force error (đổi tạm Supabase URL) → thấy error block + retry, refresh button → meta.generatedAt cập nhật
- [x] 12.5 `npx openspec verify --change dashboard-contract-and-hardening` pass
