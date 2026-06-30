## Context

`billing_audit_events` có 14 action constants định nghĩa trong `BILLING_AUDIT_ACTIONS`. Qua exploration, 2 action chưa được ghi đầy đủ:

1. `reading.saved` — constant có, `audit-summary.ts` có handler, nhưng `server/services/meter-readings/index.ts` không có `BillingAuditService.append` nào. Không có dữ liệu nào ghi lại ai ghi chỉ số, khi nào, giá trị bao nhiêu.

2. `invoice.reissued` — event được ghi nhưng chỉ có `metadata` (reason, IDs, amount diff), không có `before_data`/`after_data`. Inconsistent với `invoice.voided`, `invoice.adjustment_created`, `invoice.payment_recorded` đều có snapshot đầy đủ.

## Goals / Non-Goals

**Goals:**
- Meter readings service ghi `reading.saved` với before/after snapshot khi save chỉ số
- `invoice.reissued` có `before_data` (voided invoice) và `after_data` (new invoice)
- Pattern before/after nhất quán trên toàn bộ billing audit events

**Non-Goals:**
- Không thay đổi schema `billing_audit_events`
- Không thêm action constants mới
- Không thay đổi UI/BillingAuditStep

## Decisions

**D1 — `reading.saved` ghi ở đâu: bulk hay per-reading?**

Meter readings service nhận batch input (nhiều readings cùng lúc qua bulk entry). Options:
- A) 1 audit event per reading — verbose, dễ trace từng phòng
- B) 1 audit event cho cả batch — gọn, metadata có count + room list

→ **Chọn A (per reading)**: Consistent với cách `invoice.voided` ghi per invoice. Billing audit là append-only, verbose là intentional. `entity_id` = reading ID, `entity_type` = `meter_reading`.

**D2 — `before_data` cho reading mới (chưa tồn tại)?**

Khi tạo lần đầu, không có before. → `before_data: null`, `after_data: snapshot`. Khi update (correct reading), before = giá trị cũ.

**D3 — `invoice.reissued` before/after**

Hiện tại voided invoice được ghi riêng qua `INVOICE_VOIDED` (đã có before/after). Với reissue event: `before_data` = voided invoice snapshot (đã có ở local scope), `after_data` = new invoice snapshot.

## Risks / Trade-offs

- **Reading.saved volume**: Tòa 50 phòng × 2 đồng hồ = 100 events/kỳ. Acceptable.
- **Retroactive gap**: Các kỳ cũ sẽ không có reading.saved events — không fix được, document là known gap.

## Migration Plan

Không có schema migration. Deploy là code-only, backward-compatible.
