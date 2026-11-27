---
type: Implementation Plan
title: Contract handover inventory editor implementation
status: draft
---

# Contract handover inventory editor implementation

Goal: implement the [approved design](./design.md) using inline execution, test-driven development and final review.

- [x] Add failing interaction tests in `tests/components/contracts/ContractHandoverSection.test.ts`: edit/cancel, room preview, validation, save errors, lock, permissions and read-only checkout.
- [x] Add `app/composables/contracts/useContractHandoverInventory.ts` for API reads, validated writes, errors and lock conflicts; update `ContractHandoverSection.vue` with the existing editor and confirmation modal.
- [x] Emit loaded document metadata from `ContractDocumentsSection.vue`; wire document lock and room ID in `app/pages/dashboard/contracts/[code]/index.vue`.
- [x] Run focused tests, typecheck, full tests, lint and knowledge check. Review permissions, failure states and responsive markup; record browser QA limitations separately. Full-suite and full-lint limitations are recorded in the verification record, not treated as passing.
- [x] Reconcile accepted capabilities, frontend and contract reference docs and verification evidence. No cloud rollout claim without deployment evidence.

Verification results and remaining browser/deployment gates: [verification record](./verification.md).
