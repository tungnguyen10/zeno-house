## Why

Trang chi tiết kỳ vận hành (`/billing/[building]/[period]`) đang lộn xộn và lãng phí không gian:

- **KPI trùng** giữa sticky strip (7 thẻ) và các tab — đặc biệt tab "Thanh toán & công nợ" lặp lại 3/4 con số đã có ở strip, tab "Phát hành" lặp lại "Tổng dự kiến", tab "Grid" lặp lại "Cần đọc / Tổng nháp".
- **Sticky strip 7 thẻ** là số nguyên tố → grid `xl:grid-cols-7` không cân ở mọi breakpoint; trên màn 982px hiện 2 hàng 4+3, chiếm ~180px above-the-fold mà còn dính (sticky).
- **Header action slot** gộp 3 thứ khác bản chất: status badge (metadata), `…` ghost button (action), `← Danh sách kỳ` (navigation). Trigger `…` không có icon rõ, user không đoán được "Chốt kỳ / Huỷ phát hành" nằm trong.
- **Description** "Quản lý nhập chỉ số, soát hoá đơn, phát hành, thanh toán và chốt kỳ" chỉ liệt kê các tab — UiTabs ngay dưới đã chỉ rõ.
- **Spacing** dùng đan xen 12/16/20/24px nhìn không đều; KPI strip quá dài kém đồng bộ.

## What Changes

### `UiPageHeader` (shared primitive — backward-compatible)
- Thêm prop optional `backTo?: RouteLocationRaw | string` + `backLabel?: string` (mặc định `'Quay lại'`). Khi truyền `backTo`: render back-link nhỏ phía trên title với `IconArrowLeft`.
- Giữ nguyên `mb-6` cuối header (nhiều page không có `space-y-*` wrapper).
- Document slot và props (script comment).

### Billing period header (`app/pages/billing/[building]/[period].vue`)
- Bỏ `UiStatusBadge` khỏi header — status đã hiển thị ở cột bảng của `/billing` list.
- Bỏ description giới thiệu các tab.
- Đổi `← Danh sách kỳ` từ button trong slot `#actions` sang prop `:back-to="/billing"` `:back-label="Danh sách kỳ"`.
- Đổi `…` text button thành nút "Hành động" với icon kebab (`IconMoreVertical` — icon mới), menu items có icon prefix:
  - `IconDocument` — Nhật ký
  - `IconDownload` (icon mới) — Xuất Excel
  - `IconCheckCircle` — Chốt kỳ
  - `IconXCircle` — Huỷ phát hành kỳ (text-rose-400, separator phía trên)

### Sticky KPI strip (`BillingKpiStrip.vue`)
- Nén 7 thẻ → 5 thẻ:
  - Thẻ `Quy mô` (mới): hiển thị `<contractCount> HĐ` với caption `<invoiceCount> hoá đơn` — thay cho 2 thẻ riêng.
  - Thẻ `Đã phát hành` giữ giá trị `issuedTotal`, caption `Nháp <draftTotal>` (gộp "Nháp" thành caption).
  - Giữ nguyên 3 thẻ: `Chỉ số`, `Đã thu`, `Công nợ`.
- Layout đổi sang `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` — chia cân ở mọi breakpoint.

### KPI trùng ở các tab
- **`BillingPaymentsStep`**: bỏ toàn bộ grid 4 thẻ summary. Số "Quá hạn" (chỉ khi >0) chuyển thành pill nhỏ inline cạnh section title `Thanh toán & Công nợ`.
- **`BillingIssueStep`**: xóa cả grid 3 thẻ (`Có thể phát hành`/`Bị blocker`/`Đã phát hành (bỏ qua)`). Issuable count đã có ở tab badge + bảng; blocker đã có alert riêng; skipped chỉ hiện inline khi `> 0`.
- **`BillingDraftGridStep`** footer: bỏ `Cần đọc` + `Tổng nháp` (trùng strip). Hai số còn lại (`Sẵn sàng`, `Có lỗi`) đổi sang inline text nhỏ dưới section heading.

### Icons mới
- `app/assets/icons/more-vertical.svg` — kebab 3 chấm dọc, `currentColor`.
- `app/assets/icons/download.svg` — mũi tên xuống vào khay, `currentColor`.
- Cập nhật bảng inventory trong `.github/instructions/images.instructions.md`.

## Capabilities

### New Capabilities
(none — purely UI refinement on top of existing primitives and billing workspace.)

### Modified Capabilities
- `operational-ui-patterns`: Page-header pattern được mở rộng để hỗ trợ back-link affordance; summary-metrics pattern bổ sung quy tắc không lặp KPI giữa sticky strip và tab summaries.
- `billing-client`: Workspace period header tinh gọn (không status badge, không description); KPI strip nén còn 5 thẻ; tab summaries không lặp lại KPI có trên strip.

## Impact

**Code**
- `app/components/ui/UiPageHeader.vue` — thêm props optional (backward-compatible với 10+ page đang dùng)
- `app/pages/billing/[building]/[period].vue` — refactor header markup
- `app/components/billing/BillingKpiStrip.vue` — đổi shape metrics
- `app/components/billing/BillingPaymentsStep.vue` — bỏ summary grid, thêm pill quá hạn
- `app/components/billing/BillingIssueStep.vue` — bỏ toàn bộ grid 3 thẻ, thêm dòng inline khi skipped > 0
- `app/components/billing/BillingDraftGridStep.vue` — đổi totals footer sang inline text

**Assets**
- 2 SVG mới: `more-vertical.svg`, `download.svg`

**Docs**
- `.github/instructions/images.instructions.md` — cập nhật icon inventory

**No impact**
- Không thay đổi API, Zod schema, server services, database
- Không phá BC của `UiPageHeader` — các page khác giữ nguyên (không truyền `backTo` thì không render)
