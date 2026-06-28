## Why

Hiện tại invoice chỉ truy cập được _bên trong_ một kỳ vận hành (`/billing/<building>/<period>` → tab "Thanh toán & công nợ"). Khi cần tra cứu cross-period — vd "khách Tùng nợ tổng bao nhiêu qua 3 tháng?", "tháng 4 còn ai chưa trả?", "tìm invoice mã `INV-2606-014`" — user phải đoán đúng kỳ rồi mới mở được. Mental model accounting coi invoice là chứng từ first-class (cùng level với Contract/Tenant), nhưng sidebar hiện chưa phản ánh.

## What Changes

- Thêm sidebar entry **"Hoá đơn"** đứng giữa Hợp đồng và Vận hành.
- Tạo trang `/invoices` — list invoice cross-period với filter: building, tháng (multi-select), trạng thái (chưa thu / đã thu / quá hạn / huỷ), khách thuê (search).
- Tạo endpoint `GET /api/invoices` nhận query cross-period (period_id optional), pagination bắt buộc.
- Click row mở drawer preview **read-only** — reuse `BillingChargeBreakdown` + payments timeline.
- Drawer có CTA "Mở trong kỳ vận hành →" deep-link tới period view + scroll/highlight invoice.
- Không có action thay đổi (record/void/adjust) trên `/invoices` — mọi action vẫn ở period view.

## Capabilities

### New Capabilities
- `invoices-browse`: Cross-period invoice list & read-only preview surface — filter, search, pagination, deep-link tới period view.

### Modified Capabilities
- `admin-shell`: Sidebar thêm entry "Hoá đơn" giữa Hợp đồng và Vận hành; rename "Vận hành" thành nhãn rõ ràng hơn nếu cần để phân biệt.
- `billing-api`: Thêm endpoint `GET /api/invoices` cross-period với pagination + filter (building_id, period_year, period_month, status[], tenant_search).

## Impact

- **Code**: `app/pages/invoices/index.vue` (mới), `app/components/invoices/*` (list + drawer preview), `app/composables/invoices/useInvoiceList.ts` (mới), `app/utils/constants/navigation.ts` (thêm entry), `server/api/invoices/index.get.ts` (mới), `server/services/billing/invoice-query.ts` (extend cho cross-period).
- **API contract**: thêm 1 endpoint mới; không đụng endpoint hiện có.
- **DB**: không migration. Tận dụng `invoices` + `invoice_payments` hiện có.
- **Permissions**: scope theo role hiện tại — manager chỉ thấy invoice thuộc buildings được phân công; admin thấy tất cả.
- **Performance**: list cross-period có thể lên hàng nghìn rows / năm → pagination bắt buộc từ MVP, default page-size 50.
- **Không phá vỡ**: zero breaking change. Period view giữ nguyên 3 tab hiện tại trong scope này (proposal `simplify-billing-period-workflow` sẽ xử lý sau).
