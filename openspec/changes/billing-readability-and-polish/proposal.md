## Why

Billing workspace cơ bản đã hoạt động (`monthly-operations-workspace` 80/98 tasks done) nhưng chưa production-ready ở 3 mặt:

1. **UID lộ ra UI** — tab Thanh toán hiển thị `contractId`/`roomId` thay vì tên khách + số phòng; tab Nhật ký hiển thị `actorId` UUID thay vì tên người và `metadata` dump dạng `key=...` không đọc được.
2. **Information architecture nặng** — 6 tab (Tổng quan, Nháp, Phát hành, TT&CN, Nhật ký, Chốt kỳ) trộn lẫn thông tin, hành động chính, tham chiếu hiếm. Manager phải nhảy tab để biết tổng quan, mất context khi xem audit.
3. **Draft và issued lệch im lặng** — sau khi override điện/nước, draft được tính lại nhưng hoá đơn đã phát hành không đổi (đúng theo nguyên tắc immutable). Hiện UI không cảnh báo chênh lệch và không hướng dẫn manager vào flow sửa đúng (điều chỉnh hay hủy + phát hành lại). Người dùng tưởng "override không ăn".

Cần polish trước khi nhồi thêm tính năng mới (xem `billing-power-features`).

## What Changes

- **DTO enrichment ở server**: list endpoints (`invoices`, `audit`, `invoice-payments`) trả thêm `tenantName`, `roomNumber`, `actorName`, `entityLabel`, `entitySubLabel`, `summary`. UID raw vẫn giữ trong DTO cho navigation/debug, nhưng UI mặc định dùng tên.
- **Audit summary formatter**: pure function map `(action, metadata)` → câu Việt thân thiện ở server (vd `invoices.issued` + `{issued_count: 2, due_date: "2026-06-25"}` → "Phát hành 2 hoá đơn, hạn 25/06/2026").
- **Workspace IA: 6 tab → 3 tab**:
  - Giữ: `Chỉ số & hoá đơn nháp`, `Phát hành`, `Thanh toán & công nợ`
  - Xoá tab `Tổng quan` → thay bằng **sticky KPI strip** ngay dưới `UiPageHeader`, luôn hiện ở mọi tab
  - Xoá tab `Nhật ký` → thay bằng **drawer phải** mở từ button `[Nhật ký]` trên header
  - Xoá tab `Chốt kỳ` → thay bằng **kebab menu** trên header (một item "Chốt kỳ" có confirm modal)
- **UI polish nhỏ**:
  - Save bar trong draft grid ẩn khi period read-only (`issued/collecting/closed`)
  - Bỏ button no-op `Áp dụng cho dòng trống` (hoặc thay bằng hành động thật: fill batch date vào local state cho cell trống)
  - Toast notification (success/error) cho mọi mutation: phát hành, thu, void, reissue, adjustment, override
  - Adjustment modal: thay text input UID `reference_invoice_id` bằng `UiSelect` chọn từ list invoice đã phát hành của period
- **Discrepancy callout** (mới):
  - Khi draft total khác invoice đã phát hành ≥ 1.000đ, hiện callout vàng trong row expanded của draft grid: "Hoá đơn hiện tại {issued}đ, draft mới {draft}đ, chênh {delta:+}đ".
  - 2 CTA: **[Tạo điều chỉnh]** (mở adjustment modal pre-fill `amount = -delta`, label = "Điều chỉnh do override tiêu thụ") và **[Hủy + Phát hành lại]** (mở void modal với hint "sau khi hủy, phát hành lại từ tab Chỉ số & hoá đơn nháp").
  - Với hoá đơn đã thu đủ (paid): ưu tiên CTA "Tạo điều chỉnh"; CTA "Hủy" disable vì hệ thống không cho void invoice có payment thành công (rule có sẵn).
- **Resolver layer mới ở server**: `BillingDisplayResolver` batch-load `auth.users`, `tenants`, `rooms`, `invoices`, `billing_periods`, `buildings` để gắn tên/label vào DTO. Không lưu snapshot vào DB ở phiên này — resolve lazy lúc list.

## Capabilities

### New Capabilities
- `billing-readability`: server-side DTO enrichment contract (display names, audit summary, entity labels) + client rendering rule "không hiển thị UID trong cột chính của bảng" + draft–issued discrepancy callout với CTA điều chỉnh / hủy‑phát hành lại.

### Modified Capabilities
- `billing-ui-readiness`: workspace IA mới (3 tab + sticky KPI + drawer + kebab), bỏ tab `Tổng quan`/`Nhật ký`/`Chốt kỳ`. Bổ sung primitive `UiDrawer` và pattern kebab menu trong `UiPageHeader`.

## Impact

- **Server**:
  - `server/services/billing/audit.ts` — thêm enrich layer, summary formatter
  - `server/services/billing/invoices.ts` — list/get trả tên đầy đủ
  - `server/repositories/billing/audit.ts`, `invoices.ts`, `payments.ts` — join thêm tenants/rooms/auth.users
  - `server/services/billing/display.ts` (mới) — `BillingDisplayResolver` batch lookup
  - `app/types/billing.ts` — `Invoice`, `BillingAuditEvent`, `InvoicePayment` thêm field tên (optional để không phá DTO consumer khác)
- **Client**:
  - `app/pages/billing/[building]/[period].vue` — IA mới (sticky strip + 3 tab + drawer + kebab)
  - `app/components/billing/BillingPaymentsStep.vue` — render tên + số phòng; mở adjustment/void modal khi nhận intent từ draft grid CTA
  - `app/components/billing/BillingAuditStep.vue` — render `summary` thay metadata dump, `actorName` thay UID; chuyển thành drawer content (vẫn giữ component, chỉ đổi nơi render)
  - `app/components/billing/BillingDraftGridStep.vue` — ẩn save bar khi read-only, bỏ button no-op, thêm discrepancy callout trong row expanded
  - `app/components/billing/BillingDraftDiscrepancyCallout.vue` (mới) — callout vàng với delta + CTA
  - `app/components/ui/UiDrawer.vue` (mới) — drawer phải overlay
  - Toast composable hoặc dùng `UiAlert` floating
- **Database**: không có schema change. Dùng resolver lazy.
- **Existing changes**: phụ thuộc `monthly-operations-workspace` được archive trước (để các spec API/UI có sẵn trong main specs).
- **Breaking**: các consumer của `BillingAuditEvent` cần handle field mới optional. UI cũ (component `BillingOverviewStep`, `BillingCloseStep`) không xoá file ngay — re-purpose hoặc xoá ở phase cleanup cuối change.
