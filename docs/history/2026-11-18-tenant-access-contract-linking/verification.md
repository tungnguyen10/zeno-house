---
type: Verification Record
title: "tenant-access-contract-linking — verification"
status: stable
change_state: archived
tags: [change, verification, tenants, contracts, security]
---

# Tenant Access & Contract Linking — verification

## Local source evidence (2026-11-18)

| Check | Result |
| --- | --- |
| `npx vitest run` (full suite) | 499 files, 3138 tests passed |
| `npm run typecheck` | exit 0 |
| `npm run lint` | 0 errors (1 pre-existing `v-html` warning in `AppAiDevChat.vue`) |
| `npm run check:patterns`, `npm run knowledge:check` | pass |
| API inventory | adds `POST /api/tenants/link-verify` (240 routes) |

Suites added or extended:

- `tests/server/utils/tenant-link-token.test.ts` — round trip, expiry, foreign secret, tampered payload, malformed tokens, nonce, short secret.
- `tests/server/tenants/linkable.test.ts` — full/basic allowed, none and unknown → 404 `TENANT_NOT_LINKABLE`, token bound to actor/tenant/building, missing secret ignores tokens.
- `tests/server/tenants/link.test.ts` — ID tier, ID-image tier, normalized name tier, identical 404 for unknown phone and wrong proof, limiter unit per failure, audit without PII, busy only after proof, 503 without secret, rate limit before lookup, capability gate.
- `tests/server/contracts/tenant-linking.test.ts` — create/update/occupant-add checks, spoofed tenants rejected before writes, building from room, client `building_id` ignored, cross-building move → 409.
- `tests/server/contracts/tenant-availability-migration.test.ts` — trigger SQL contract and 409 mapping.
- `tests/components/tenants/*`, `tests/components/contracts/ContractForm.spec.ts`, `tests/pages/contract-create-page.spec.ts`, `tests/utils/contract-create-blocks.test.ts` — verify row, token emit, error lines, stale states, conflict hand-off, edit-form building and token, tokens never in drafts.

## Cloud evidence (production project `zeno-house`, 2026-11-18)

- Read-only preflight before the migration: 41 active contracts and 44 open occupancies, no tenant violating the new rule.
- Migration `20261118120000_tenant_availability_guard` applied; `supabase migration list --remote` shows it on both local and remote.
- `supabase/verification/tenant_availability_guard.sql` ran on production inside a rolled-back transaction with no `VERIFY` failure (run twice, the second after all code changes). Afterwards: both triggers present, no leftover fixture buildings or tenants, 41 active contracts unchanged.
- `NUXT_TENANT_LINK_SECRET` exists encrypted on Vercel Production for `zenocorp/zeno-house` (value never printed).

## Visual QA (2026-11-18, dev server, authenticated admin session, real data, nothing saved)

Run on `https://localhost:3000/dashboard/contracts/create` with room K01 and an unknown phone `0999000111`.

- **Defect found and fixed:** the verify row was first placed under the combobox, but the open popup (`absolute z-50`) covered it, so users saw only "Thêm khách mới" and no verification path. `UiCombobox` gained an optional `footer` slot (backward compatible, scope `{ close, query }`); `TenantPicker` now renders the row inside the popup. When the popup is closed (quick-create conflict hand-off) the row sits under the field. Covered by new `UiCombobox`, `TenantPicker` and `TenantLinkVerifyRow` tests.
- **Touch size at 375 px:** the first version had 28 px input and 30 px button. Now the input is the normal-density 44 px field and the button is `md` (38 px, the app-wide `UiButton` size), stacked full width below `sm`. No horizontal scroll (`scrollWidth` = 375).
- Desktop 1280 px, dark and light themes: row sits inside the popup, single line. Helper text contrast 5.34:1 (dark) and 5.48:1 (light), above the 4.5:1 AA threshold.
- Keyboard and focus: action disabled while the field is empty; clicking inside the row keeps the popup open; focus lands on the labelled input with a visible outline; Escape from the search box closes the popup; Enter in the field submits.
- Error state: one short line with `role="alert"` inside the popup, popup stays open, no toast. One real verification attempt was submitted with a wrong ID number and returned the expected `404`; it wrote one `tenant.link_verify_failed` audit event and used one rate-limit unit of the tester's budget. No further attempts were made.
- Quick-create dialog from the unmatched phone opens with the phone prefilled; closed without saving. The conflict hand-off itself is covered by component tests only (triggering it on real data would need an existing out-of-scope identity).
- Known and unchanged: the floating AI-chat button overlaps the right edge of the popup at some scroll positions on a phone; it no longer covers the Verify button.

## Reusable smoke script

`scripts/tenant-linking-smoke.mjs` (pure rules in `evaluateSmoke`, unit-tested in `tests/scripts/tenant-linking-smoke.test.ts`) sends only requests a correct system rejects: anonymous link-verify, spoofed create, spoofed occupant add, and an unknown-phone versus wrong-proof comparison. It requires the `--confirm` flag and the tester's own cookie. A vulnerable system would create data, so it must not be run against production without approval.

## Deltas from design

- The picker's verify block is a `div` with Enter handling, not a nested `<form>`, because `ContractOccupantForm` wraps the picker in a form.
- A transient network error while restoring a draft keeps the selection; only a 404 asks to verify again.
- The contract edit form also offers verification: `ContractForm` passes the room's building and returns `{ tenantLinkToken }` with `submit`, kept out of the form data.
- Pending occupant tokens on the create page are bound to the building verified for; changing to a room in another building makes the server reject them with `TENANT_NOT_LINKABLE`.

## Open gates (not verified; do not infer pass)

- [ ] **Application deployment:** the code is uncommitted in the working tree; the Vercel production deployment does not yet contain `link-verify` or the new checks until this branch is merged and deployed. The database trigger is already live and protects data on its own.
- [ ] **Deployed smoke** (use `scripts/tenant-linking-smoke.mjs`, then the manual two-owner part): two real owners, a former tenant of owner A rented by owner B with the same Tenant ID (A keeps basic history, B full), direct API spoofing, two concurrent creates.
- [x] Visual QA of the verify row (375 px, desktop, dark and light, keyboard, error state): done, see above. Still unchecked in a browser: the verified hint, the stale hint and the edit-contract page; they are covered by component tests only.
- [ ] Follow-up change `tenant-required-profile` (7 contract fields required on every tenant create path, superseding Tenant V2 UX-02) is approved but not started.
