## Context

`/` dashboard hiện tại render bars bằng div + width % tự tính (`maxRooms`, `maxTrend`). Cách này có 2 lỗi cố hữu: (a) normalize sai trục với occupancy theo tòa, (b) Paid và Outstanding ở mỗi kỳ là 2 bar độc lập, mất mối quan hệ "tổng = Paid + Outstanding" giữa các kỳ. Đây là code template default, chính là cái `frontend-design` skill nhắc tránh.

Hệ thống chưa có chart library; design system đã pin chặt palette (cyan accent, success/warning/error semantic), font, radius, dark surface. Bất kỳ chart nào cũng phải dùng đúng những token này — không có chỗ cho default chart.js theme.

API trả về đủ raw data để client render mọi thứ trừ 4 con số derived: `collectionRate`, `expiringUrgent`, per-period `overdueAmount`, per-pending `amount`. Server tính sẵn để (i) đảm bảo tất cả client/test/screenshot agree, (ii) tránh client lặp lại logic "tính ngày due so với today".

## Goals / Non-Goals

**Goals**
- Dashboard truyền đạt 3 câu hỏi chủ chốt trong 2 giây quét mắt: *thu được bao nhiêu % tháng này*, *occupancy mỗi tòa*, *có gì cần làm ngay*.
- Visual hierarchy có **một** signature element (collection donut), mọi thứ khác quiet xung quanh.
- Chart.js bundle tree-shaken, chỉ load client-side, không phá SSR.
- Tất cả color/font/grid line chart đều derive từ Tailwind token — không có magic hex.
- API có thể rebuild dashboard hiện tại bằng cách BC-extend (không phá client cũ).

**Non-Goals**
- Auto-refresh / WebSocket / realtime — manual refresh là đủ ở phase này.
- Sparkline mini-chart dưới mỗi KPI — tăng noise, hero donut đã là điểm nhấn chính.
- Filter "theo building" trên dashboard — out of scope, manager mở `/buildings/<id>` để xem riêng.
- Light theme cho chart — admin shell dark-only.
- Mở rộng chart-primitives thành capability riêng — chỉ 1 consumer (dashboard) ở phase này, sẽ tách khi consumer thứ 2 xuất hiện.
- Tenant portal — phase sau.

## Decisions

### 1. Chart.js + vue-chartjs thay vì Recharts/ECharts/SVG tay

| Tiêu chí | Chart.js + vue-chartjs | ECharts | SVG/CSS tay |
| --- | --- | --- | --- |
| Bundle (gz) | ~30–35 KB tree-shaken | ~150 KB | 0 |
| Vue 3 wrapper | `vue-chartjs` chính chủ | `vue-echarts` ổn | n/a |
| API đơn giản cho 2 chart | ✅ | over-powered | phải code lại tooltip/animation |
| Dark theme custom | dễ | dễ | dễ |
| Tree-shake | có (register theo nhu cầu) | hạn chế | n/a |

**Chọn**: Chart.js. Hai chart (donut + stacked column) đủ đơn giản, ECharts thừa. SVG tay không có tooltip free → phải viết accessibility/positioning, quá tốn cho 2 chỗ.

### 2. Hero là half-donut, không phải full donut

Half-donut (`circumference: 180, rotation: 270`) chiếm chiều cao nhỏ hơn, để chừa chỗ cho số `67%` và caption nằm trong arc. Full donut cùng diện tích phải nhỏ hơn → text khó đọc. Half-donut cũng tạo cảm giác "progress" tốt hơn cho metric tỉ lệ.

### 3. Server tính `collectionRate`, không phải client

Lý do:
- Tránh client phân kỳ khi `invoiceTotal === 0` (chia 0).
- Cùng tỉ lệ phải hiển thị giống nhau ở dashboard hiện tại và mọi UI tương lai (vd email báo cáo).
- Repository đã có `paidAmount`, `invoiceTotal` cùng scope query — thêm 1 phép chia gần như zero-cost.

Format: `number` trong khoảng `[0, 1]`, làm tròn 4 chữ số thập phân (`0.6667`). Client format `Math.round(rate * 100) + '%'` để hiển thị.

### 4. Server sort `pendingOperations`, không để client sort

Pending operations đến từ 2 nguồn (period status + per-building overdue count), thứ tự append hiện tại không deterministic theo severity. Để server sort `severity desc → amount desc → period desc → building.name asc` đảm bảo:
- Mọi client (web, future mobile, email digest) thấy thứ tự nhất quán.
- Test snapshot stable.
- Client không cần hiểu mapping severity → number.

### 5. Stacked column 3 layer (Paid / Unpaid-not-overdue / Overdue)

Phân biệt "Chưa thu nhưng còn hạn" vs "Quá hạn" là tín hiệu hành động khác nhau. Hai layer này cộng lại = `outstandingAmount`. Server đã có `outstandingAmount` per period; chỉ thêm `overdueAmount` per period (compute từ invoice.due_date < today + balance > 0 trong cùng loop).

Client tính `unpaidNotOverdueAmount = outstandingAmount - overdueAmount` để stack — không thêm field thứ 3 vào API (tránh field redundant).

### 6. `expiringUrgent` là field mới, KHÔNG thay nghĩa `expiringSoon`

`expiringSoon` đang được dùng ở chỗ khác (badge contracts), giữ nguyên `≤30 ngày`. `expiringUrgent` là field mới, `≤7 ngày`, là subset. Hai field độc lập về định nghĩa; client hiển thị cả hai:
```
Hết hạn ≤30 ngày: 5
Hết hạn ≤7  ngày: 2  ← urgent tier
```
Không tách `expiringSoon` thành "8–30 ngày" để giữ BC với mọi consumer khác đang đọc field này (`useContractsList`, etc.).

### 7. Bar occupancy "100% width per row"

Mỗi row hiển thị: `[████████░░░░] 75% · 12/16 phòng (4 trống · 0 bảo trì)`. Bar là **3 segment stacked trong 100% width của row**, không normalize cross-row. Điều này phản ánh đúng occupancy ratio thực tế của từng tòa. Vẫn còn `total rooms` ở caption để so sánh quy mô.

### 8. Relative timestamp: client-only, không qua server

Tính `Date.now() - generatedAt` ở client để tránh server timezone drift. Refresh mỗi 30s qua `useIntervalFn` từ `@vueuse/core` để label luôn fresh ("3 phút trước" → "4 phút trước") mà KHÔNG refetch dashboard. Hover hiện absolute (`formatTimeHHmm`) via `:title`.

### 9. Component co-locate trong `app/components/dashboard/`

Hiện tại không có folder `dashboard/` cho components. Tạo mới vì 4 piece (donut, trend chart, occupancy list, pending list) sẽ vượt 200 dòng nếu inline trong `index.vue`. Mỗi component nhận props derived sẵn — không tự gọi composable, không tự fetch (theo `components.instructions.md`).

### 10. Chart theme qua composable, không qua plugin global

`useChartTheme()` trả về object options đã merge với token. Mỗi chart spread riêng để override khi cần (vd donut cutout vs bar grid). Tránh global plugin vì 2 chart có nhu cầu khác hẳn (donut không grid, bar có grid).

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| Chart.js không SSR được → hydration mismatch / lỗi `window is not defined` | Plugin file `.client.ts` + `<ClientOnly>` wrap mỗi chart component. Fallback `<UiSkeleton>` khi SSR. |
| Bundle dashboard nặng thêm ~30KB → ảnh hưởng FCP | Chart.js dynamic import qua plugin client-only — không vào server bundle. Dashboard là admin tool, không phải landing — chấp nhận được. |
| `collectionRate` thay đổi shape API → client cũ vỡ nếu chưa rebuild | BC-safe: thêm field mới, không xoá/đổi field cũ. Type union nullable trong `app/types/dashboard.ts` rồi default `?? 0` ở UI nếu cần (sau khi rebuild thì luôn có). |
| Server sort thay đổi order pending operations có thể phá test snapshot hiện có | Audit `tests/server/dashboard*` nếu có; cập nhật fixture. Sort là deterministic nên dễ test. |
| Half-donut Chart.js text-in-center không có built-in | Dùng plugin afterDatasetsDraw custom (~10 dòng) vẽ text vào ctx. Đã có pattern phổ biến — không cần lib bổ sung. |
| `formatCurrencyCompact` có thể conflict với existing format ở chỗ khác nếu dùng nhầm | Đặt tên rõ ràng `Compact`, dùng riêng cho chart axis. Doc trong file format. |
| Sparkline / auto-refresh ai đó sẽ ask | Note trong proposal là non-goal. Đã có hero donut = signature. Auto-refresh có thể là change tiếp theo. |

## Migration Plan

Single PR, có thể merge atomic. Rollout:

1. **Infra**: cài `chart.js` + `vue-chartjs`, tạo plugin + composable + format helper. Không thay UI gì → safe baseline.
2. **API**: extend repository với 4 field mới + sort pending. Smoke test bằng `npm run dev` curl. Client cũ không vỡ.
3. **Types**: cập nhật `DashboardSummary` interface, type-check pass.
4. **UI**: thay `index.vue` template + tạo 4 component dashboard. Visual smoke trong browser.
5. **Tests**: thêm component test cho 2 chart (mount với data fixture), test server cho collectionRate + sort.

Rollback: revert PR — không có data migration, không có capability key mới, không có route mới.

## Open Questions

Không. User đã chốt scope ("improve hết") và đồng ý dùng Chart.js trong câu trước.
