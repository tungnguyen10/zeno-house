## 1. Meter readings audit

- [x] 1.1 Thêm `BillingAuditService.append` vào `server/services/meter-readings/index.ts` — ghi `reading.saved` với before/after snapshot per reading
- [x] 1.2 Verify `formatAuditSummary` case `reading.saved` trong `audit-summary.ts` cover đủ metadata fields mới

## 2. Invoice reissued snapshot

- [x] 2.1 Bổ sung `before_data: voidedInvoice` và `after_data: newInvoice` vào event `INVOICE_REISSUED` trong `server/services/billing/invoices.ts`
