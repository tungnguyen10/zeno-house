---
type: Verification Record
title: "Contract amendments — cleanup verification checkpoint"
status: draft
change_state: rollout-verification-pending
tags: [change, contracts, worker, verification]
---

# Contract Amendments — verification checkpoint (2026-11-10)

## Supported by current evidence

- Imported execution checklist has **12/12 marked complete**. It records previous source-level testing and reviews, not a new run during this cleanup.
- The repository contains `supabase/migrations/20260814095628_contract_amendments.sql`, `supabase/verification/contract_amendments.sql`, contract-amendment API/UI/services and an apply-due worker.
- Existing [contract amendment rollout guide](../../development/contract-amendments-rollout.md) requires staging validation, Vault secrets, private worker verification and cron activation **in that order**.

## Still open before archive

- [ ] Establish migration presence and generated types in the intended cloud environment; retain read-only catalog evidence.
- [ ] Execute/retain `contract_amendments.sql` verification and staging idempotency, permission, invoice-conflict and billing pre-draft checks; verify tenant primary-only visibility and note redaction.
- [ ] Confirm private worker `NUXT_CONTRACT_AMENDMENTS_APPLY_SECRET`, Vault settings and Supabase cron configuration, then demonstrate no duplicate application and safe retry. Do not enable cron solely because the checklist is checked.
- [ ] Promote accepted `contract-amendments` behavioral requirements from [proposed delta](./specs/contract-amendments/spec.md) to a new canonical `docs/capabilities/contract-amendments.md` **after acceptance**, and reconcile linked contract/portal/billing/audit capabilities.
- [ ] Confirm live application rollout/monitoring and record final evidence; archive only after gates close.

This change remains active despite 12 checked tasks because production/worker activation evidence and the accepted new capability file are not present in the reviewed repository. No production secrets or cloud operations were accessed.
