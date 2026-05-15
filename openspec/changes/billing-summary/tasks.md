## 1. Server

- [ ] 1.1 Tạo `app/types/billing.ts` — BillingSummary, BillingStats, UnpaidInvoice DTOs
- [ ] 1.2 Tạo `server/repositories/billing/index.ts` — aggregate queries (SUM/COUNT, unpaid list)
- [ ] 1.3 Tạo `server/services/billing/index.ts` — permission check + delegate
- [ ] 1.4 Tạo `server/api/billing/summary.get.ts` — GET /api/billing/summary

## 2. Client

- [ ] 2.1 Tạo `app/composables/useBillingSummary.ts` — useFetch với period + building params
- [ ] 2.2 Tạo `app/pages/billing/index.vue` — stat cards + filter (period, building) + unpaid table
- [ ] 2.3 Cập nhật AppSidebar — thêm link "Billing" → `/billing`

## 3. Verify

- [ ] 3.1 Chạy `npm run lint && npm run typecheck` — 0 errors
- [ ] 3.2 Test thủ công: billing page hiển thị đúng stats + unpaid list theo period
