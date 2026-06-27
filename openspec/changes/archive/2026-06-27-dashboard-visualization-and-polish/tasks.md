## 1. Chart foundation

- [x] 1.1 Cài deps: `npm install chart.js@^4.4 vue-chartjs@^5.3`
- [x] 1.2 Tạo `app/plugins/chart.client.ts` — `Chart.register(DoughnutController, ArcElement, BarController, BarElement, CategoryScale, LinearScale, Tooltip)` only (tree-shake)
- [x] 1.3 Tạo `app/composables/useChartTheme.ts` trả về object `{ donutOptions, stackedColumnOptions, palette }` derived từ Tailwind token: cyan `#00E5FF`, success-neon `#32D74B`, warning `#FFB539`, error-vivid `#FF453A`, dark-border `#2C2C2E`, muted `#98989D`. Tooltip dark, no legend mặc định, animation duration 200ms (off khi `reduced-motion`)
- [x] 1.4 Tạo `app/utils/format/currency.ts::formatCurrencyCompact(amount: number): string` — `<1000` → `0`, `<1_000_000` → `"X.X nghìn"`, `<1_000_000_000` → `"X.X tr"`, else `"X.X tỷ"`. Không thay `formatCurrency` cũ.
- [x] 1.5 Tạo `app/utils/format/relative-time.ts::formatRelativeTime(iso: string, now?: Date): string` — "Vừa cập nhật" (<60s) / "X phút trước" (<60p) / "X giờ trước" (<24h) / fallback `formatTimeHHmm`. Pure function, không động Date.now nếu `now` cung cấp (testable).
- [x] 1.6 Unit test `app/utils/format/relative-time.test.ts` cho 4 branch + edge case (0s, 59s, 60s, 59m, 60m, 23h59m, 24h+)

## 2. API extension

- [x] 2.1 `app/types/dashboard.ts` — extend interface:
  - `DashboardSummary.contracts.expiringUrgent: number`
  - `DashboardSummary.billing.currentMonth.collectionRate: number`
  - `DashboardSummary.billingTrend[].overdueAmount: number`
  - `PendingOperation.amount?: number`
- [x] 2.2 `server/repositories/dashboard/index.ts` — bổ sung query `expiringUrgent`:
  - Thêm `expiringUrgentResult` vào `Promise.all` — `contracts` `count exact`, `status active`, `end_date >= today`, `end_date <= today+7`
- [x] 2.3 Trong vòng loop `allInvoices`, accumulate `overdueByPeriod` map (sum balance khi `due_date < today && balance > 0 && status !== 'void'`)
- [x] 2.4 Compute `collectionRate = invoiceTotal === 0 ? 0 : Math.round((paidAmount / invoiceTotal) * 10000) / 10000`
- [x] 2.5 Khi push pending operation `overdue_invoices`, compute `amount` = tổng `balance_amount` của overdue invoices cho building đó (đã có loop sẵn — chỉ thêm sum)
- [x] 2.6 Sort `pendingOperations` cuối hàm theo `severity desc (danger=3, warning=2, info=1) → amount desc → period desc → building.name asc`
- [x] 2.7 Map `billingTrend` để include `overdueAmount` từ `overdueByPeriod`
- [x] 2.8 Return shape mới hoàn chỉnh
- [x] 2.9 Verify `npm run typecheck` clean

## 3. Dashboard component scaffold

- [x] 3.1 Tạo folder `app/components/dashboard/`
- [x] 3.2 Tạo `DashboardCollectionDonut.vue`:
  - Props: `collectionRate: number`, `paidAmount: number`, `invoiceTotal: number`, `outstandingAmount: number`, `unpaidContractsCount?: number`
  - `<ClientOnly>` wrap + `<UiSkeleton class="h-48 rounded-xl" />` fallback
  - Dùng `vue-chartjs` `<Doughnut>` với `circumference: 180`, `rotation: 270`, `cutout: '78%'`
  - Plugin custom afterDatasetsDraw vẽ text trung tâm (% + caption)
  - Empty state khi `invoiceTotal === 0`: muted track + caption "Chưa phát hành hoá đơn tháng này"
- [x] 3.3 Tạo `DashboardBillingTrendChart.vue`:
  - Props: `trend: BillingTrendEntry[]` (đã sort asc by period)
  - `<ClientOnly>` + `<UiEmptyState>` khi `trend.length === 0`
  - 3 dataset stack: `Đã thu` (success-neon), `Chưa thu trong hạn` = `outstanding - overdue` (warning), `Quá hạn` (error-vivid)
  - X = `period`, Y format `formatCurrencyCompact`
  - Custom legend nhỏ phía trên (text-xs muted) — không dùng Chart.js legend default
- [x] 3.4 Tạo `DashboardOccupancyList.vue`:
  - Props: `buildings: BuildingBreakdown[]`
  - Mỗi row: NuxtLink → `buildingPath(building)`, stacked bar 100% width per row (3 segment proportional), text `{occupancy%} · {occupied}/{total} phòng` + caption muted với breakdown
  - Empty: building.total === 0 → muted track + `0/0 phòng`
- [x] 3.5 Tạo `DashboardPendingList.vue`:
  - Props: `items: PendingOperation[]`
  - Row: severity-dot (filled circle 8px) | label | building (link) | period | count | amount (— nếu undef)
  - `<UiEmptyState>` khi `items.length === 0` với message "Không có việc tồn"
  - Sort đã có từ server — chỉ render

## 4. Dashboard page refactor

- [x] 4.1 `app/pages/index.vue` — bỏ logic `maxRooms` / `maxTrend` (chuyển hết sang component)
- [x] 4.2 Layout mới:
  ```
  <UiPageHeader> với relative time + refresh
  <Alert forbidden> | <Alert error>
  Hero row (grid 12-col):
    DashboardCollectionDonut (col-span-12 md:col-span-5)
    KPI stack (col-span-12 md:col-span-7):
      Occupancy KPI (UiSection — % occupancy + breakdown)
      Contracts KPI (UiSection — active + soon + urgent)
  Trend row:
    DashboardBillingTrendChart (UiSection wrapper, full width)
  Detail row (grid xl:col-2):
    DashboardOccupancyList (UiSection)
    DashboardPendingList (UiSection)
  ```
- [x] 4.3 Tích hợp `formatRelativeTime` + `useIntervalFn(refreshLabel, 30000)` từ `@vueuse/core` — chỉ rerender label, không refetch
- [x] 4.4 Title attribute trên label = `formatTimeHHmm(meta.generatedAt)` để hover hiện absolute
- [x] 4.5 Loading state: 4 skeleton (hero, kpi, trend, occupancy/pending) thay vì 3
- [x] 4.6 Xoá util `severityVariant` và `operationLabel` khỏi `index.vue` — chuyển vào `DashboardPendingList.vue`

## 5. Tests

- [x] 5.1 Component test `tests/components/DashboardCollectionDonut.test.ts` — mount với `invoiceTotal=0` (empty), với `collectionRate=0.5` (renders), assert text trung tâm có `%`
- [x] 5.2 Component test `tests/components/DashboardBillingTrendChart.test.ts` — empty array → `UiEmptyState`; có data → mount không throw
- [x] 5.3 Component test `tests/components/DashboardOccupancyList.test.ts` — verify per-row 100% width logic (kiểm tra style/class), assert percent text rendered đúng
- [x] 5.4 Component test `tests/components/DashboardPendingList.test.ts` — severity dot color đúng theo severity, amount formatted khi có / em-dash khi không
- [x] 5.5 Unit test `tests/utils/relative-time.test.ts` (đã liệt kê ở 1.6)
- [x] 5.6 Unit test `tests/utils/currency-compact.test.ts` — boundaries: 0, 999, 1000, 999999, 1_000_000, 1_500_000_000
- [ ] 5.7 Server test `tests/server/dashboard-summary.test.ts` (nếu chưa có, tạo) — assert `collectionRate` computed đúng với `invoiceTotal=0` và `>0`, assert pendingOperations sort order, assert `expiringUrgent <= expiringSoon`

## 6. Adopt frontend-design skill checklist

- [x] 6.1 Verify hero donut là signature element duy nhất (no other large radial visuals)
- [x] 6.2 Verify palette: cyan + success-neon + warning + error-vivid + dark-border + muted only. Không có hex magic
- [x] 6.3 Sau khi build xong, "remove one accessory" pass: nhìn lại có thừa visual nào không (vd icon decoration, border-trong-border) — bỏ
- [x] 6.4 Reduced-motion respect: chart animation off khi `prefers-reduced-motion: reduce`

## 7. Gate

- [x] 7.1 `npm run typecheck` clean
- [x] 7.2 `npm run lint` clean (or no new violations)
- [x] 7.3 `npx vitest run` — tất cả test pass (existing + new)
- [x] 7.4 Manual smoke tại `/`:
  - Hero donut hiển thị % đúng, hover hiện tooltip
  - KPI occupancy/contracts không lệch
  - Building occupancy bars: tòa 100% kín phòng → bar fill đầy; tòa khác → tỉ lệ riêng (không bị tòa to lấn)
  - Billing trend: 3 layer stacked, axis Y format `tr`/`tỷ`, tooltip hiện đủ 3 giá trị
  - Pending list: dot color match severity, danger ở trên cùng
  - Refresh button: click → label về "Vừa cập nhật"; sau 30s tự thành "1 phút trước" mà KHÔNG refetch
  - Hover timestamp → tooltip `HH:mm`
- [x] 7.5 Empty smoke: tạo user/tenant clean DB hoặc mock `invoiceTotal=0` → empty states render gọn
- [x] 7.6 `npx openspec validate dashboard-visualization-and-polish --strict` passes
