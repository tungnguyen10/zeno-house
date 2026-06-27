## Why

Dashboard hiện tại (`/`) đang có 3 vấn đề khiến nó vừa khó đọc vừa nói dối nhẹ về dữ liệu:

1. **Bar "tỷ lệ phòng theo tòa" normalize sai trục.** Mỗi tòa render `width = rooms / max(allBuildingTotalRooms) * 100%`. Hệ quả: tòa 10/10 occupancy (100% kín phòng) chỉ vẽ bar `25%` nếu tòa khác có 20 phòng. Đây là KPI quan trọng nhất với chủ nhà trọ và đang sai trục.
2. **Thiếu các KPI ratio mà manager hỏi mỗi sáng.** "% đã thu tháng này", "% occupancy" là 2 con số quan trọng nhất, hiện đều phải nhẩm từ số tuyệt đối. Card "Hợp đồng" chỉ có 2 số → loãng so với 2 card kia.
3. **"Việc cần xử lý" thiếu money context, không sort theo độ ưu tiên.** Manager phải mở từng item mới biết "3 hoá đơn quá hạn đó tổng bao nhiêu", và một item `danger` có thể bị đẩy xuống dưới `warning`.

Phụ thuộc: billing trend đang là 2 bar độc lập per kỳ → không thể so sánh tháng-với-tháng. Timestamp "Cập nhật lúc HH:mm" không cho cảm giác tươi/cũ.

## What Changes

### Chart foundation (mới)
- Thêm dependency: `chart.js@^4` + `vue-chartjs@^5`.
- Plugin client `app/plugins/chart.client.ts` đăng ký **chỉ những controller cần** (DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip) để tree-shake.
- Composable `app/composables/useChartTheme.ts` trả về options chuẩn (palette từ Tailwind token: `cyan`, `success-neon`, `warning`, `error-vivid`, `dark-border`, `muted`), tooltip dark, không legend mặc định, no animation trên redraw.

### Dashboard page (`app/pages/index.vue` + new domain components)
- **Hero collection donut** (`DashboardCollectionDonut.vue`): half-donut Chart.js cho "Collection rate tháng này" — accent cyan trên track muted. Hiển thị `67%` ở giữa, caption `80tr / 120tr` + `Còn 40tr · 5 HĐ chưa thu`. Đây là signature element duy nhất theo nguyên tắc "spend boldness in one place".
- **KPI strip** đổi shape:
  - Card "Phòng" → metric chính `% occupancy` (vd `73%`), kèm `11/15 thuê · 4 trống · 0 bảo trì` ở caption.
  - Card "Hợp đồng" → 3 metric `Active / Hết hạn ≤30 ngày / ≤7 ngày` (urgent tier mới).
- **Occupancy theo tòa** — fix bar normalize: mỗi row hiển thị **stacked 100% width per row** (available + occupied + maintenance phân bố trong 100% của hàng đó), kèm số `%` occupied bên phải.
- **Billing trend** — thay 2 bar tự render bằng **stacked column chart Chart.js** với 3 layer (Đã thu / Chưa thu / Quá hạn), trục X = period, trục Y = tiền (format gọn `tr`/`tỷ`).
- **Pending operations**:
  - Sort theo `severity` desc (danger → warning → info) rồi theo `amount` desc.
  - Thêm cột `amount` (chỉ hiển thị cho `overdue_invoices` — tổng `balance` của các invoice quá hạn).
  - Đổi badge sang severity-dot + label, layout dense table-row.
- **Timestamp** đổi sang relative: "Vừa cập nhật" / "X phút trước" / "X giờ trước" với title attr là giờ tuyệt đối.

### API extension (`dashboard-api`)
- `data.contracts.expiringUrgent: number` — số HĐ `end_date` trong 7 ngày tới (subset của `expiringSoon`).
- `data.billing.currentMonth.collectionRate: number` — `paidAmount / invoiceTotal` (0 nếu invoiceTotal = 0), khoảng `[0, 1]`.
- `data.billingTrend[].overdueAmount: number` — tổng balance của invoice quá hạn trong kỳ đó (computed server-side để client không phải đoán).
- `data.pendingOperations[].amount?: number` — chỉ set cho `type === 'overdue_invoices'`, tổng balance.
- Pending operations SHALL được server sort theo severity desc, amount desc, period desc.

### Helpers
- `app/utils/format/relative-time.ts` — `formatRelativeTime(iso)` → "Vừa cập nhật" / "X phút trước" / "X giờ trước" / fallback `formatTimeHHmm`.
- `app/utils/format/currency.ts` — thêm `formatCurrencyCompact(amount)` → `"120tr"` / `"1.2tỷ"` cho chart axis (không thay `formatCurrency` cũ).

## Capabilities

### New Capabilities
(none — Chart.js infrastructure được cover trong design.md, không tự thành capability riêng vì chỉ phục vụ dashboard ở phase này. Khi có consumer thứ 2, tách ra `chart-primitives` sau.)

### Modified Capabilities
- `dashboard-ui`: layout reshape (hero donut, KPI ratios, fix occupancy bars, stacked column trend, severity-sorted pending list, relative timestamp).
- `dashboard-api`: response shape mở rộng với `collectionRate`, `expiringUrgent`, `billingTrend[].overdueAmount`, `pendingOperations[].amount`, và quy định server-side sort cho pending operations.

## Impact

**Code**
- `app/pages/index.vue` — refactor template (hero + 2-col KPI + trend + occupancy + pending)
- `app/composables/useDashboardSummary.ts` — không đổi shape, type DashboardSummary mở rộng
- `app/composables/useChartTheme.ts` — NEW
- `app/components/dashboard/DashboardCollectionDonut.vue` — NEW
- `app/components/dashboard/DashboardBillingTrendChart.vue` — NEW
- `app/components/dashboard/DashboardOccupancyList.vue` — NEW
- `app/components/dashboard/DashboardPendingList.vue` — NEW
- `app/plugins/chart.client.ts` — NEW
- `app/types/dashboard.ts` — extend với 4 field mới
- `app/utils/format/relative-time.ts` — NEW
- `app/utils/format/currency.ts` — add `formatCurrencyCompact`
- `server/repositories/dashboard/index.ts` — compute thêm `expiringUrgent`, `collectionRate`, per-period `overdueAmount`, per-pending `amount`; sort pending output
- `server/services/dashboard/index.ts` — không đổi (chỉ passthrough)
- `tests/components/` — smoke tests cho 2 chart component (mount với data tối thiểu)
- `tests/server/` — extend test dashboard summary nếu có (kiểm tra collectionRate, sort)

**Dependencies**
- `chart.js@^4.4` (~30KB tree-shaken gzipped)
- `vue-chartjs@^5.3` (~3KB)

**No impact**
- Không thay envelope `{ data, meta }`
- Không thay permission, không thay route, không migration database
- Không phá tab `/buildings/[id]` (chỉ link từ dashboard sang)
- BC: `expiringSoon` giữ nguyên (≤30 ngày), `expiringUrgent` (≤7) là superset thêm vào; client cũ không vỡ nếu nâng cấp gradual
