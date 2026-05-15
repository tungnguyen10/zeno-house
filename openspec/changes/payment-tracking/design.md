## Context

Sau khi invoice issued, admin thu tiền mặt hoặc chuyển khoản. Cần ghi nhận để theo dõi công nợ. Hỗ trợ partial payment (thu nhiều lần cho 1 invoice).

## Goals / Non-Goals

**Goals:**
- Ghi payment record (amount, method, date)
- Tự động update invoice status sau payment
- Hiển thị payment history trong invoice detail

**Non-Goals:**
- Payment gateway thật (VNPay, MoMo)
- Auto-reconcile
- Refund flow

## Decisions

**D1 — `payments` table: `id, invoice_id, amount, payment_method, payment_date, notes, created_at`**
Không có `updated_at` — payment không sửa, chỉ thêm mới. Nếu nhập sai → delete + re-enter (admin only).

**D2 — `payment_method` enum: `cash` | `bank_transfer` | `other`**
3 method phổ biến nhất. Không cần mở rộng ở v0.3.

**D3 — Invoice status logic sau payment**
Sau mỗi payment insert: sum tất cả payments của invoice. Nếu sum >= invoice.total_amount → `paid`. Nếu 0 < sum < total → `partial`. Update invoice.status trong cùng transaction (service layer, không phải DB trigger).

**D4 — Chỉ cho payment khi invoice.status = `issued` | `partial` | `overdue`**
Không payment vào invoice `draft` hoặc `cancelled`. → 409 CONFLICT nếu vi phạm.

**D5 — Delete payment chỉ dành cho admin, recalculate invoice status sau delete**
Nếu admin xóa nhầm payment → DELETE endpoint + recalculate. Đảm bảo không corrupt invoice status.

## Risks / Trade-offs

- **Không có audit log cho payment changes**: Nếu admin xóa payment, không có trace. Acceptable cho v0.3.
- **Race condition cùng lúc 2 admin ghi payment**: Tổng có thể vượt total_amount → invoice status vẫn đúng (sum recalculated), chỉ UI hơi confusing. Acceptable cho scale hiện tại.
