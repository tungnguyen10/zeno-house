# API Inventory And Performance Contracts

Generated from checked-in handlers by `node scripts/generate-api-inventory.mjs`.
Route count: **136**.

All business routes require server-side authorization unless explicitly documented as an internal-secret route. Initial reads use Nuxt `useFetch`; imperative reads and mutations use `apiFetch` with a 15-second timeout, request ID, no automatic mutation retry, and normalized server envelopes.

| Method | Route | Pagination | Cache / invalidation | Budget |
| --- | --- | --- | --- | --- |
| POST | `/api/ai/actions/[id]/cancel` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/ai/actions/[id]/confirm` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/ai/chat` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/ai/conversations/[id]` | n/a | request/DTO policy | p95 ≤ 250ms |
| DELETE | `/api/assignments/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| PATCH | `/api/assignments/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/assignments/buildings-without-manager` | n/a | request/DTO policy | p95 ≤ 250ms |
| GET | `/api/assignments/by-building/[id]` | n/a | request/DTO policy | p95 ≤ 250ms |
| GET | `/api/assignments` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/assignments` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/audit` | bounded | request/DTO policy | p95 ≤ 400ms |
| GET | `/api/billing/invoices/[id]` | n/a | request/DTO policy | p95 ≤ 250ms |
| POST | `/api/billing/invoices/[id]/adjustment` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/billing/invoices/[id]/payments` | domain-bounded | no long cache | p95 ≤ 400ms |
| POST | `/api/billing/invoices/[id]/payments` | n/a | no long cache | p95 ≤ 250ms |
| DELETE | `/api/billing/invoices/[id]/payments/[paymentId]` | n/a | no long cache | p95 ≤ 250ms |
| POST | `/api/billing/invoices/[id]/reissue` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/billing/invoices/[id]/void` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/billing/invoices/bulk-payments` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/billing/periods/[id]/audit` | bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/billing/periods/[id]/close` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/billing/periods/[id]/draft-grid` | n/a | no long cache | p95 ≤ 800ms |
| GET | `/api/billing/periods/[id]/drafts` | n/a | request/DTO policy | p95 ≤ 250ms |
| GET | `/api/billing/periods/[id]/export` | n/a | request/DTO policy | p95 ≤ 250ms |
| GET | `/api/billing/periods/[id]` | n/a | request/DTO policy | p95 ≤ 250ms |
| POST | `/api/billing/periods/[id]/invoices-printed` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/billing/periods/[id]/invoices` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/billing/periods/[id]/issue-and-pay` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/billing/periods/[id]/issue` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/billing/periods/[id]/overview` | n/a | request/DTO policy | p95 ≤ 250ms |
| POST | `/api/billing/periods/[id]/reopen` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/billing/periods/[id]/unissue` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/billing/periods/[id]/utility-usages` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/billing/periods/[id]/utility-usages` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/billing/periods/[id]/utility-usages` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/billing/periods/[id]/utility-usages/[override_id]/approve` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/billing/periods` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/billing/periods` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/building-expenses/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| PATCH | `/api/building-expenses/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/building-expenses/[id]/receipt` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/building-expenses/[id]/receipt` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/building-expenses` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/building-expenses` | n/a | invalidate affected domain | p95 ≤ 250ms |
| PATCH | `/api/building-fixed-costs/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/building-fixed-costs` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/building-fixed-costs` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/building-services/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| PATCH | `/api/building-services/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/building-services` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/building-services` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/buildings/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/buildings/[id]` | n/a | request/DTO policy | p95 ≤ 250ms |
| PATCH | `/api/buildings/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/buildings/[id]/rooms/[room]` | n/a | request/DTO policy | p95 ≤ 250ms |
| POST | `/api/buildings/bulk` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/buildings` | bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/buildings` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/contract-services/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| PATCH | `/api/contract-services/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/contract-services/by-building` | n/a | request/DTO policy | p95 ≤ 250ms |
| GET | `/api/contract-services` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/contract-services/sync` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/contracts/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/contracts/[id]` | n/a | request/DTO policy | p95 ≤ 250ms |
| PATCH | `/api/contracts/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/contracts/[id]/occupants` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/contracts/[id]/occupants` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/contracts/[id]/occupants/[occupantId]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| PATCH | `/api/contracts/[id]/occupants/[occupantId]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/contracts/[id]/payments` | domain-bounded | no long cache | p95 ≤ 400ms |
| POST | `/api/contracts/[id]/payments` | n/a | no long cache | p95 ≤ 250ms |
| DELETE | `/api/contracts/[id]/payments/[paymentId]` | n/a | no long cache | p95 ≤ 250ms |
| PATCH | `/api/contracts/[id]/payments/[paymentId]` | n/a | no long cache | p95 ≤ 250ms |
| POST | `/api/contracts/[id]/renew` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/contracts/[id]/renewals` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/contracts/bulk` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/contracts` | bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/contracts` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/dashboard/summary` | n/a | 20s scoped | p95 ≤ 800ms |
| POST | `/api/internal/ai/retention-cleanup` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/internal/operations-report/auto-close` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/invoices` | bounded | request/DTO policy | p95 ≤ 400ms |
| PATCH | `/api/meter-readings/[id]` | n/a | no long cache | p95 ≤ 250ms |
| GET | `/api/meter-readings/bulk` | n/a | no long cache | p95 ≤ 250ms |
| POST | `/api/meter-readings/bulk` | n/a | no long cache | p95 ≤ 250ms |
| GET | `/api/meter-readings` | domain-bounded | no long cache | p95 ≤ 400ms |
| POST | `/api/meter-readings` | n/a | no long cache | p95 ≤ 250ms |
| GET | `/api/meter-readings/latest` | n/a | no long cache | p95 ≤ 250ms |
| POST | `/api/operations-report/close` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/operations-report/export` | n/a | request/DTO policy | p95 ≤ 250ms |
| GET | `/api/operations-report` | domain-bounded | 15s open / versioned closed | p95 ≤ 800ms |
| POST | `/api/operations-report/reopen` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/prepaid-expenses/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| PATCH | `/api/prepaid-expenses/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/prepaid-expenses` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/prepaid-expenses` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/recurring-expenses/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| PATCH | `/api/recurring-expenses/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/recurring-expenses/[id]/dismiss` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/recurring-expenses/[id]/record` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/recurring-expenses` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/recurring-expenses` | n/a | invalidate affected domain | p95 ≤ 250ms |
| PATCH | `/api/reserve-fund-rates/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/reserve-fund-rates` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/reserve-fund-rates` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/reserve-funds/[buildingId]/deposit` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/reserve-funds/[buildingId]` | n/a | request/DTO policy | p95 ≤ 250ms |
| POST | `/api/reserve-funds/[buildingId]/refresh-accrual` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/reserve-funds/[buildingId]/withdraw` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/rooms/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/rooms/[id]` | n/a | request/DTO policy | p95 ≤ 250ms |
| PATCH | `/api/rooms/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/rooms/bulk` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/rooms` | bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/rooms` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/service-catalog` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/service-catalog` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/shared-expenses/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| PATCH | `/api/shared-expenses/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/shared-expenses/[id]/allocate` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/shared-expenses` | domain-bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/shared-expenses` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/tenants/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/tenants/[id]` | n/a | request/DTO policy | p95 ≤ 250ms |
| PATCH | `/api/tenants/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/tenants/[id]/id-image` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/tenants/[id]/id-image` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/tenants/bulk-create` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/tenants/bulk` | n/a | invalidate affected domain | p95 ≤ 250ms |
| GET | `/api/tenants` | bounded | request/DTO policy | p95 ≤ 400ms |
| POST | `/api/tenants` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/tenants/parse-import` | n/a | invalidate affected domain | p95 ≤ 250ms |
| DELETE | `/api/users/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| PATCH | `/api/users/[id]` | n/a | invalidate affected domain | p95 ≤ 250ms |
| POST | `/api/users` | n/a | invalidate affected domain | p95 ≤ 250ms |
