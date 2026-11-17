---
type: Verification Record
title: "building-onboarding-v2-verification"
status: draft
change_state: verification-pending
tags: [change, verification, buildings, settings, contracts, onboarding, v2]
---

# Building onboarding V2 — verification

Branch `feat/building-onboarding-v2` (from `develop` bd9cf7ef). Evidence recorded 2026-11-17. Nothing below is claimed beyond what is stated.

## Source and local checks (passed)

- `npm run typecheck`: no errors.
- `npm test`: 492 files, 3063 tests passed at the last full run; later commits re-ran the related suites (482 tests in `tests/server/buildings` and `tests/utils`).
- `npm run lint`: 0 errors; 1 pre-existing warning (`vue/no-v-html`, `app/components/app/AppAiDevChat.vue`).
- `npm run knowledge:check`: passed.
- Every task was implemented test-first, reviewed against the spec and plan, and the whole branch had a final review (outcome: no Critical findings; two Important and several Minor findings were fixed in the fix round `93b41716..6ec5bdb9`).

## Cloud migration (production, project `alndujothmxhilmvykqs`)

- `supabase db push --remote --dry-run` listed only `20261118090000_building_owner_to_lessor.sql`; applied with user approval.
- Read-only verification after the push:
  - column `public.building_contract_profiles.lessor_email` exists (`text`);
  - 4 buildings had owner contact; 4 profiles exist; every owner name and phone and email that was present was copied (`*_not_copied` = 0); 4 profiles have a name, 2 a phone, 1 an email.
- `supabase/verification/building_owner_to_lessor.sql` (rolled-back fixtures for phone normalization, invalid values skipped, no overwrite) has **not been run** in the SQL editor yet.
- Types regenerated with Supabase CLI 3.1 and formatted with `prettier@3 --no-semi --trailing-comma all --print-width 80`; the diff against the previous file was exactly the three `lessor_email` lines. The temporary Insert-type cast in `server/repositories/building-contract-profiles.ts` was removed.
- `buildings.owner_*` columns were left in place by design.

## Browser verification (NOT done)

The integrated browser could not reach a fresh dev server: port 3000 is occupied by an unrelated `aem up` process, and a Nuxt dev server on port 3100 uses a new self-signed certificate that the browser rejects (`ERR_CERT_AUTHORITY_INVALID`). No UI state below has been checked visually.

To verify (390 / 768 / 1280 px, light and dark):

- [ ] Create a building with 0 rooms and with several rooms; lands on `settings?setup=1` with "Bên cho thuê" open; toast shown.
- [ ] "Lưu và tiếp" walks lessor → terms (prefilled 12/1/30/7/6 with the suggestion hint) → basics → invoice → services ("Tiếp") → inventory ("Bỏ qua", or save and apply the suggestion).
- [ ] Completion: "Lập hợp đồng đầu tiên" opens contract create filtered to the building; with exactly one vacant room it is preselected; with 0 rooms the primary action is "Thêm phòng".
- [ ] Leave halfway, open the building detail page: setup strip shows "Thiết lập x/4" and "Tiếp tục thiết lập".
- [ ] Old link `settings#contract-profile` opens "Bên cho thuê".
- [ ] A user without `building-contract-profile.pii.read` sees the lessor step read-only with masked PII, and cannot write PII.
- [ ] Buildings list in multi-select mode: checkbox does not cover the building name at `sm` and above.
- [ ] States: loading, save error keeps typed data, saving disables the button, focus-visible on "Lưu và tiếp", reduced motion on step scroll.

## Known deferred findings

See the SDD ledger notes; none blocks merge. Highlights: no unsaved-changes guard on the lessor and terms steps; `vacantRoomIds` sends every vacant room id for a `length === 1` check; `/api/rooms` ignores `available=true`; the setup header shows the building name in the description rather than the title.

## Promotion

Capabilities (`docs/capabilities/buildings-ui.md`, `buildings-api.md`) are **not** updated yet; update them and archive this bundle to `docs/history/` only after the browser checks above pass and the behavior is accepted.
