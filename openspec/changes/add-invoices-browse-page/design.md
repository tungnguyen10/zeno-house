## Context

Invoice hiện chỉ truy cập qua period view (`/billing/<building>/<period>` → tab "Thanh toán & công nợ"). `BillingPaymentsStep` đã có table + filter logic per-period đầy đủ (status filter, bulk select, payment actions). Server endpoint hiện có là `GET /api/billing/periods/<id>/invoices` scoped theo period_id.

Cross-period query chưa được expose. Ở DB, `invoices` table có sẵn `period_id`, `building_id`, `contract_id`, `tenant_id`, `status`, `total_amount`, `paid_amount`, `balance_amount`, `due_date`, `invoice_code` — đủ để filter cross-period bằng SQL thông thường.

Sidebar nav (`app/utils/constants/navigation.ts`) hiện flat: Dashboard / Tòa nhà / Phòng / Khách thuê / Hợp đồng / Vận hành. Thêm "Hoá đơn" là thêm 1 entry vào array — pattern đã có.

## Goals / Non-Goals

**Goals:**
- Cho phép tra cứu invoice cross-period bằng filter + search trong < 5s.
- Drawer preview đủ thông tin để đọc chứng từ mà không cần rời trang.
- Deep-link "Mở trong kỳ vận hành" giữ context — không phải tự tìm lại invoice ở period view.
- Tận dụng tối đa component đã có (`BillingChargeBreakdown`, `UiTable`, filter pills) — không tạo abstraction mới.

**Non-Goals:**
- Không có action thay đổi (record payment / void / adjust / print) trên `/invoices`. Mọi action vẫn ở period view.
- Không export trong scope này (đã có export Excel ở period — cross-period export là YAGNI cho v0).
- Không sửa period view trong scope này — đó là proposal `simplify-billing-period-workflow`.
- Không thay đổi schema DB.
- Không tạo nested sub-nav. Sidebar giữ flat.

## Decisions

### D1. Endpoint mới `GET /api/invoices` thay vì extend endpoint period-scoped

**Chọn**: Tạo `GET /api/invoices` mới với query params `building_id?`, `period_year?`, `period_month?`, `status[]?`, `tenant_search?`, `page`, `page_size`.

**Vì sao không extend** `/api/billing/periods/<id>/invoices`?
- Endpoint period-scoped có URL contract chứa `period_id` — đổi sang optional là breaking.
- Service layer khác: cross-period cần JOIN building/tenant cho display, period-scoped đã có context.

**Alternatives**:
- `GET /api/billing/invoices` (gắn dưới `billing/`) — phù hợp folder structure hiện tại nhưng sidebar entry là "Hoá đơn" độc lập → URL `/api/invoices` ngắn hơn, phản ánh đúng entity.

### D2. Repository layer reuse vs tạo mới

**Chọn**: Tạo `server/repositories/invoices.ts` (mới) cho query cross-period. Giữ repo period-scoped hiện tại không đổi.

**Vì sao**: Query cross-period có JOIN khác (building, tenant), filter khác (multi-month). Reuse một method "all-purpose" sẽ làm repo phình to và mất type narrowness.

### D3. Drawer preview vs Page chi tiết

**Chọn**: Drawer (UiDrawer) thay vì page `/invoices/<id>`.

**Vì sao**:
- Giữ context list filter — đóng drawer là về list ngay, không phá filter state.
- Read-only, lượng nội dung vừa phải, drawer 44rem đủ chỗ.
- Page `/invoices/<id>` sẽ trùng vai trò "Mở trong kỳ vận hành" — gây bối rối.

**Alternative**: Nếu sau này cần in invoice từ /invoices → có thể thêm route `/invoices/<id>/print` riêng cho print, không phải drawer.

### D4. Filter tháng — single vs multi-select

**Chọn**: Single month + year picker (mặc định tháng hiện tại). Có quick chip "Tất cả tháng năm này".

**Vì sao**:
- Multi-select tháng dẫn tới UI phức tạp (date range picker), ít user case thực sự cần "tháng 2 và 5 nhưng không tháng 3-4".
- "Tất cả tháng năm này" + filter status "Còn nợ" đã cover 90% nhu cầu cross-period.

### D5. Server-side pagination, không infinite scroll

**Chọn**: Pagination cổ điển (page / page_size). Mặc định page_size=50.

**Vì sao**:
- User hay scan-and-find thay vì lướt xem; pagination cho phép biết "đang ở đâu trong list".
- Infinite scroll khó scroll-to-top khi lỡ kéo xuống sâu.
- Server-side: 1 tòa × 12 tháng × 30 phòng = 360 rows/năm; nhiều tòa → vài nghìn. Client-side sẽ chậm.

### D6. Tận dụng `BillingChargeBreakdown` cho drawer

`BillingChargeBreakdown` đã có sẵn render charges + payments. Drawer chỉ wrap thêm header (invoice code, tenant, room, due date, status badge) + footer CTA "Mở trong kỳ vận hành →".

### D7. Sidebar — flat, không sub-nav

Giữ flat list theo project-structure rule. Thêm "Hoá đơn" giữa "Hợp đồng" và "Vận hành" — đúng nhóm entity (Hợp đồng → Hoá đơn → flow xử lý).

### D8. Deep-link "Mở trong kỳ vận hành"

Format URL: `/billing/<building-slug>/<YYYY-MM>?invoice=<invoice_id>`. Period page đọc query param `invoice`, sau khi load tự switch sang tab "Thanh toán & công nợ" + scroll-into-view + highlight ngắn (2s).

### D9. Permissions

Reuse role check hiện có (auth middleware + service guard). Manager scope: `building_id IN (user_assigned_buildings)`. Admin: tất cả. Không thêm capability mới — chỉ thừa hưởng.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| User click "Mở trong kỳ" → load period view chậm (resolvePeriod gọi API) khi chỉ muốn record payment nhanh | Trong scope này chấp nhận. Nếu phổ biến, add quick-action button trong drawer ở change sau (cần thiết kế kỹ). |
| List cross-period chậm khi nhiều invoice | Pagination + DB index trên `(building_id, period_year, period_month, status)` nếu chưa có (kiểm tra trong task). |
| Sidebar 7 entry chính → bắt đầu dày | Acceptable cho v0; nếu sau có thêm "Báo cáo" thì cân nhắc nhóm. |
| Drawer reuse `BillingChargeBreakdown` có sẵn props expectation từ period context | Bọc thêm 1 thin wrapper component `InvoicePreviewDrawer` để map data và inject CTA, không sửa breakdown component. |
| Filter "tenant_search" tốn DB nếu LIKE prefix unindexed | Dùng full-text search nếu Postgres hoặc index trigram; nếu phức tạp quá → fallback search server-side memory với limit ban đầu, optimize sau. |

## Migration Plan

Không có DB migration. Deploy thuần feature mới:

1. Backend: ship `GET /api/invoices` endpoint + repository + service. Không user-facing → không cần feature flag.
2. Frontend: ship page `/invoices` + sidebar entry. Page tự đứng được, không phá flow cũ.
3. Rollback: revert PR. Sidebar entry biến mất, page 404, không ảnh hưởng period view.

## Open Questions

- Có cần lưu filter state vào URL query để share link không? **Tao đề xuất có** (consistent với pattern `/billing/index.vue` đã dùng) — sẽ chốt khi viết spec.
- Drawer hiển thị payment history với mức chi tiết nào? **Tao đề xuất**: list payments với (ngày, số tiền, phương thức, người ghi nhận, ghi chú). Không render adjustment history phức tạp.
- Sidebar entry icon nào? **Tao đề xuất**: `IconReceipt` (đã có chưa cần kiểm) hoặc `IconDocumentText` reuse.
