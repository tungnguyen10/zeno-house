## 1. Transaction Strategy

- [ ] 1.1 Decide whether hardened writes use Supabase RPC functions or another repo-approved transaction mechanism
- [ ] 1.2 Document selected transaction boundaries for issue and bulk payment
- [ ] 1.3 Define typed payloads/results for transaction calls without changing public endpoint contracts

## 2. Database Artifacts

- [ ] 2.1 Add additive manual SQL for invoice issue transaction function if RPC is selected
- [ ] 2.2 Add additive manual SQL for bulk payment transaction function if RPC is selected
- [ ] 2.3 Include preflight, verification queries, security notes, and rollback statements
- [ ] 2.4 Update SQL/static tests for new transaction artifacts

## 3. Invoice Issue Hardening

- [ ] 3.1 Keep permission, request validation, and draft recomputation in the server service
- [ ] 3.2 Replace multi-step invoice/charge/status/audit writes with the hardened transaction path
- [ ] 3.3 Preserve `IssueInvoicesResult` response shape and invoice enrichment
- [ ] 3.4 Add tests for issue success and charge-write failure rollback

## 4. Bulk Payment Hardening

- [ ] 4.1 Keep permission, request validation, overpayment checks, and reason/error mapping in the server service
- [ ] 4.2 Replace best-effort rollback loop with the hardened transaction path
- [ ] 4.3 Preserve failed index/reason behavior for invalid bulk rows
- [ ] 4.4 Add tests for full success and later-row failure rollback

## 5. Verification

- [ ] 5.1 Run billing service tests
- [ ] 5.2 Run SQL/RLS tests
- [ ] 5.3 Run `npm run lint`
- [ ] 5.4 Run `npm run typecheck`
- [ ] 5.5 Manually review generated SQL before any Supabase Dashboard execution
