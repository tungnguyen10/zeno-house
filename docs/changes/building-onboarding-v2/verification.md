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
- `npm test`: full run recorded at the end of this record's last update (see below).
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

## Browser verification (2026-11-17, local dev server against production data, admin account)

Run on a temporary building created for the test and deleted afterwards (building, 3 rooms, profiles removed; production is back to the original 4 buildings; the uploaded test QR image may remain as an orphan object in private storage).

Passed:

- Setup mode `?setup=1`: header "Thiết lập tòa nhà" with building name and "Hoàn tất 4 bước bắt buộc để lập hợp đồng"; first missing step opens; "Lưu và tiếp" saves the Basics step and opens the next step; progress 2/4 -> 3/4 -> 4/4.
- Completion state: "Sẵn sàng lập hợp đồng", "Lập hợp đồng đầu tiên" -> `/dashboard/contracts/create?building_id=<id>` (no `room_id` with 3 vacant rooms), "Xem tòa nhà", "Thoát thiết lập" (hidden outside setup mode). Checked at 1280 px dark and 390 px dark; no horizontal overflow at 390 px.
- Contract create filtered by `building_id`: only the building's rooms are offered and "Xem phòng của mọi tòa" is shown.
- Building detail: "Sẵn sàng lập hợp đồng" strip, header actions "Thêm phòng" and "Cài đặt", "Bên cho thuê" row (name, phone, email), building name shown once.
- Old hash `settings#contract-profile` opens "Bên cho thuê"; outside setup mode the page title is "Cài đặt tòa nhà".
- Create building page: slim form (no owner fields), "Phòng" block always visible, new description text.
- Inventory template in setup mode: after saving, "3 phòng chưa có nội thất" suggestion appears and the step stays open; applying it clears the suggestion.
- Buildings list in multi-select mode at 1280 px: checkbox does not overlap the title (link padding-left 48 px).
- Terms step in light mode: suggested values shown, deposit presets and fee fields render correctly.

Bug found and fixed during this run (commit "fix(buildings): refresh readiness before leaving the invoice step"): after saving the invoice profile in setup mode the readiness was not refreshed, so progress stayed 3/4 and the step did not advance until a reload. `InvoiceProfileStep.vue` now awaits `source.refresh()` before emitting `saved`; regression spec added.

Not covered: a building with 0 rooms end to end (covered by component tests only), a user without `building-contract-profile.pii.read` (covered by service tests only), 768 px, light mode of the setup completion card, keyboard-only walkthrough and reduced motion.

## Known deferred findings

See the SDD ledger notes; none blocks merge. Highlights: no unsaved-changes guard on the lessor and terms steps; `vacantRoomIds` sends every vacant room id for a `length === 1` check; `/api/rooms` ignores `available=true`; the setup header shows the building name in the description rather than the title.

## Promotion

Capabilities (`docs/capabilities/buildings-ui.md`, `buildings-api.md`) are **not** updated yet; update them and archive this bundle to `docs/history/` only after the browser checks above pass and the behavior is accepted.
