## Why

Period view hiện có **3 tab** ("Chỉ số & hoá đơn nháp" / "Phát hành" / "Thanh toán & công nợ") nhưng tab "Phát hành" thực chất chỉ là _filter + bulk action_ của tab 1 — cùng entity (contract/draft), cùng nguồn data. Người dùng cảm thấy thừa step. Đồng thời, **lock model hiện tại lai giữa period-level và invoice-level** (partial payment cản sửa, adjustment phức tạp) khiến UX nhiều warning không cần thiết. Cuối cùng, **Nhật ký vừa thiếu data quan trọng vừa khó đọc cho manager** — bị giấu trong menu action ẩn 2 lớp, không filter/search, JSON raw.

Chốt 1 mô hình đơn giản: trước chốt kỳ mọi thứ flexible (kể cả undo payment), sau chốt kỳ mới freeze toàn bộ. Audit log là safety net.

## What Changes

### Period view (UX)
- **BREAKING**: Bỏ tab "Phát hành" khỏi period view. Còn **2 tab**: "Soạn kỳ" + "Thu tiền & công nợ".
- Tab "Soạn kỳ" (rename từ "Chỉ số & hoá đơn nháp") thêm bulk-select rows + sticky bottom bar "Phát hành (N)". Filter pill thêm "Sẵn sàng phát hành".
- Tab "Soạn kỳ" thêm row-action **"Đã thu"** trên row nháp (status `ready`) → mở quick-payment modal → backend tạo invoice + record payment trong 1 transaction (auto-issue on payment).
- Tab "Thu tiền & công nợ" thêm row-action **"Hoàn tác"** trên invoice đã thu, 1 click, kèm audit (không cần friction confirm).
- Header period view: nút "Chốt kỳ" promote ra ngoài menu "Hành động" (vẫn giữ menu cho Nhật ký / Export / Huỷ phát hành / Reopen).

### Lock model
- **BREAKING (UI)**: Bỏ UI cho `partial payment` (1 cú "Đã thu" = thu đủ). Backend giữ partial state hỗ trợ legacy data nhưng không tạo mới.
- **BREAKING (UI)**: Bỏ UI cho `adjustment charge` sau invoice issued. Sửa sai = void + reissue (trước thu) hoặc ghi bù invoice tháng sau. Backend giữ adjustment để legacy data hiện đúng.
- Lock duy nhất: **period status = `closed`** → toàn bộ thao tác trong kỳ bị khoá; admin có thể reopen kèm reason required.
- Trước `closed`, mọi action (sửa chỉ số, void, undo payment, edit payment) đều khả thi với audit ghi nhận đầy đủ.

### Audit data (backend)
- Thêm action codes: `payment.undone`, `payment.edited`, `invoice.printed`.
- Mở rộng metadata cho `reading.saved`: thêm `previous_value` + `new_value` để diff.
- Mở rộng metadata cho `period.status_changed`: thêm `trigger` (manual / auto_from_payment / auto_from_issue).
- Thêm field `correlation_id` (nullable) trên `billing_audit_events` để group action liên quan (void+reissue, issue+pay, bulk payment children).
- `payments.bulk_recorded` ghi thêm 1 child event per payment cùng `correlation_id` (giữ event tổng làm parent).
- `period.reopened`: yêu cầu `reason` required (validation server).

### Audit UI (rework drawer)
- Group entries theo ngày (Hôm nay / Hôm qua / Tuần này / Cũ hơn).
- Filter: actor, action category (Tạo / Sửa / Phá / Trạng thái), khoảng ngày, ☑ "Chỉ critical" (void / undo / reopen).
- Search free-text (tên khách / mã invoice / số tiền).
- Icon + color theo nhóm action.
- Diff view cho `reading.saved` thay JSON raw (vd `1500 → 1520 (+20)`).
- Quick action mỗi entry: "Mở entity", "Xem entries cùng correlation".
- Pagination/virtualization khi > 100 entries.
- Export CSV.

### Backend transactional
- Thêm RPC `issue_and_pay(contract_id, payment_input)`: tạo invoice + record payment atomic; emit cả 2 audit events cùng `correlation_id`. Fail nửa chừng → rollback toàn bộ.
- Thêm endpoint `DELETE /api/billing/invoices/<id>/payments/<payment_id>` cho undo payment; emit `payment.undone`.

## Capabilities

### New Capabilities
(không thêm capability mới — tất cả nằm trong các spec hiện có)

### Modified Capabilities
- `monthly-operations-workspace`: Lock model đổi sang period-level only; bỏ partial UI và adjustment UI; thêm correction = void+reissue (trước thu) hoặc bù tháng sau (sau thu); audit thêm `payment.undone` / `payment.edited` / `invoice.printed` + before/after metadata + correlation_id.
- `billing-client`: Period view chỉ còn 2 tab (Soạn kỳ + Thu tiền); bỏ Invoice issue UI riêng → merge vào Draft grid với bulk-select; thêm row-action "Đã thu" trên grid → auto-issue + record; thêm row-action "Hoàn tác" trên invoice PAID; rework Audit drawer (group/filter/search/diff/export).
- `billing-api`: Thêm RPC `issue_and_pay` + endpoint wrap; thêm endpoint undo payment; mở rộng audit metadata contract; deprecate/lockdown `POST /api/billing/invoices/<id>/adjustments` về backend-only (UI không expose); deprecate UI cho partial flow nhưng giữ endpoint tương thích legacy.
- `billing-period-unissue`: Reaffirm — `period.reopened` yêu cầu `reason` required; status_changed metadata bao gồm `trigger`.

## Impact

- **Code (frontend)**:
  - `app/pages/billing/[building]/[period].vue`: tabs array còn 2; default tab logic đơn giản hoá; query param `invoice` đọc để highlight (consume từ deep-link của proposal `add-invoices-browse-page`).
  - `app/components/billing/BillingIssueStep.vue`: **removed** (logic merge vào BillingDraftGridStep).
  - `app/components/billing/BillingDraftGridStep.vue`: thêm bulk-select integration cho issue, sticky bottom bar, row-action "Đã thu", filter pill mới.
  - `app/components/billing/BillingPaymentsStep.vue`: thêm row-action "Hoàn tác"; bỏ UI adjustment + partial filter pill.
  - `app/components/billing/BillingAuditStep.vue`: rework toàn bộ drawer content.
  - `app/components/billing/BillingChargeBreakdown.vue`: bỏ section adjustment khỏi default render (giữ component flag để hiển thị history nếu legacy data).
  - `app/composables/billing/*`: composable cho issue+pay flow, undo payment.
- **Code (backend)**:
  - `server/services/billing/invoices.ts` + `payments.ts`: thêm `issueAndPay`, `undoPayment`.
  - `server/services/billing/audit.ts` + `audit-summary.ts`: thêm formatter cho action mới; expose API list audit có filter/search/pagination.
  - `server/api/billing/invoices/<id>/payments/<payment_id>.delete.ts`: endpoint undo.
  - `server/api/billing/periods/<id>/issue-and-pay.post.ts`: endpoint issue+pay.
  - `server/api/billing/periods/<id>/audit.get.ts`: thêm query params filter/search/page.
- **DB**:
  - Migration thêm cột `correlation_id UUID NULL` trên `billing_audit_events`.
  - Migration RPC `issue_and_pay` (PL/pgSQL).
  - Không drop cột nào.
- **API contract**:
  - Thêm endpoint: `issue_and_pay`, `undo_payment`, audit list with filter.
  - Existing endpoint `POST adjustments` không thay đổi shape; chỉ ẩn UI.
- **Permissions**:
  - `payment.undone`: cần `billing.write` (manager OK); audit ghi lý do optional ở MVP, có thể required ở phase sau.
  - `period.reopened`: cần `billing.close` + reason required.
- **Migration data**: zero data migration. Invoice partial/adjustment hiện hữu vẫn render đúng qua flag legacy.
- **Rollback**: tách 4 phase trong `tasks.md`; mỗi phase 1 PR, revert độc lập.
