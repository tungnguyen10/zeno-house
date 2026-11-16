---
type: Verification Record
title: "tenant-identity-autofill — verification"
status: draft
change_state: implementation-review
tags: [change, verification, tenants, ai, ocr, privacy, v2]
---

# Tenant identity autofill (V2 PR5) — verification

## Local (source)

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | Pass (476 files, 2,927 tests before the benchmark tests were added) |
| `npm run lint` | Pass (0 errors; 1 existing `v-html` warning) |
| `npm run knowledge:check` | Run in the PR |

Not run: live visual QA (camera, VNeID screenshot, mismatch, quota and timeout states) and any call to the Anthropic API. Both need a runtime with the flags on and fictional images.

## Decisions and deltas from the plan

- `validateIdentityImages` also strips metadata and returns the stripped bytes, so a corrupt file is rejected with 422 before any quota is reserved.
- The migration is `20261116110000_tenant_ocr_usage.sql` (the plan's `20261111140000` is already in the past of applied migrations). A reservation older than 10 minutes stops counting so a crashed request cannot hold quota.
- A failed `settle` does not fail the request; the extraction already ran. The reservation then expires after 10 minutes.
- `@anthropic-ai/sdk` was already in `package.json` (G1 satisfied).
- The scanner offers only fields the tenant form can store: name, ID number, date of birth, gender (full form only), issue date, issuing place, permanent address. Nationality, place of origin, birth registration place and expiry date are not shown.
- Scanner sits inside the "Thông tin giấy tờ" block of the quick-create dialog and at the top of "Giấy tờ tuỳ thân" in the full form. Suggestions are rows with a per-field "Áp dụng" and "Áp dụng các trường còn trống".
- Public flag `NUXT_PUBLIC_AI_TENANT_VISION_ENABLED` only shows the entry point; the server flag `NUXT_AI_TENANT_VISION_ENABLED` is authoritative.
- Consent copy in the scanner is a placeholder until G3.

## UI decisions

Reused existing primitives only (`UiButton`, `UiAlert`) and existing tokens; no new primitive, token or icon. Native hidden file inputs provide the camera (`capture="environment"`) and gallery paths because `UiFileUpload` is single-file.

## Privacy checks

- No image, base64, prompt, model text or identity value is logged, stored, returned in errors, written to audit, quota rows, `localStorage`, `sessionStorage` or AI conversations (covered by service, composable and component tests).
- Response carries `Cache-Control: no-store`.
- The endpoint never writes tenants.

## Gates

| Gate | Owner | Status |
| --- | --- | --- |
| G1. Approve `@anthropic-ai/sdk` | User | Passed (already a dependency) |
| G2. Anthropic account, server key, console spend limit | Owner | Pending |
| G3. Privacy review (`privacy-review.md`) | Owner + legal | Pending |
| G4. Benchmark on fictional fixtures | Engineering | Pending (script ready; fixtures not generated) |
| G5. Security review of the endpoint | Engineering | Pending |

`NUXT_AI_TENANT_VISION_ENABLED=true` must not be set where real identity documents are handled until G1–G5 are marked passed here.

## Cloud gates

- [ ] `20261116110000_tenant_ocr_usage.sql` applied — environment and date
- [ ] `supabase/verification/tenant_ocr_usage.sql` passed — environment and date
- [ ] Types regenerated (`reserve_tenant_ocr`, `settle_tenant_ocr`, `release_tenant_ocr`, `tenant_ocr_usage`)
- [ ] Runtime secrets set (`NUXT_AI_TENANT_ANTHROPIC_API_KEY`, `NUXT_AI_TENANT_VISION_MODEL`, price and limit variables)
- [ ] Flags confirmed off in production

## Benchmark

See [benchmark-results.md](./benchmark-results.md) after G4.
