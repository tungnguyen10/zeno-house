## Context

Dashboard hiện có stats tổng quát (buildings, rooms, tenants, contracts). Billing summary là phần bổ sung cho financial view: admin cần nhìn nhanh tình hình thu tiền theo kỳ.

## Goals / Non-Goals

**Goals:**
- Stats cards: total invoices, total_amount, total_collected, outstanding
- Danh sách invoices chưa paid (overdue + partial + issued)
- Filter theo period (period_start, period_end) và building

**Non-Goals:**
- Chart / graph tài chính
- Export báo cáo
- Comparison với kỳ trước

## Decisions

**D1 — Trang riêng `/billing`, link trong AppSidebar**
Không nhét vào dashboard chính — billing là concern riêng của financial flow. Sidebar có thêm mục "Billing" sau "Dashboard".

**D2 — API: `GET /api/billing/summary?periodStart&periodEnd&buildingId?`**
Cùng pattern với `GET /api/dashboard/summary`. Server aggregate trong 1 request. Response:
```ts
{
  stats: { total: number; totalAmount: number; totalCollected: number; outstanding: number; overdueCount: number }
  unpaidInvoices: Array<{ id, roomNumber, buildingName, totalAmount, paidAmount, status, dueDate? }>
}
```

**D3 — Default period = current month**
Client tự tính `period_start = first day of month`, `period_end = last day of month` nếu không có filter. User có thể chọn period khác.

**D4 — Aggregate ở server, không fetch all invoices về client**
Query với SUM + COUNT trực tiếp, không fetch all rows rồi tính ở app layer (khác với dashboard rooms vì invoices có thể nhiều hơn).

## Risks / Trade-offs

- **Period filter phải match invoice.period_start/end**: Nếu invoice span nhiều tháng, filter sẽ include partial. Acceptable — admin hiểu context.
