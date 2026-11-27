---
type: Change Verification
title: "settings-redesign-verification"
status: draft
tags: [superpowers, change, settings, verification]
---

# Settings redesign verification

Branch `feat/settings-redesign`: gates first recorded at `1a78347a`, re-run after the final fix wave at `d14fb412`, verified 2026-11-27.

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm run knowledge:check` | Pass | `OKF structure verified: 359 concepts, 33 index files` |
| `npm run typecheck` | Pass | `nuxt typecheck` exited 0 with no type errors |
| `npm test` | Pass | 521 test files passed, 3320 tests passed |
| `npm run lint` | Pass (0 errors, 1 warning) | `eslint .` reported 1 warning: `vue/no-v-html` at `app/components/app/AppAiDevChat.vue:427`. The file is not changed by this branch and the usage is documented as safe by `79f897ad` |
| Browser QA (admin, owner, manager × 320/390/1280 × light/dark) | Partial pass (admin only) | Admin session on the dev server. 1280px dark: `/dashboard/settings` redirects to `/dashboard/settings/profile`; all 8 items (profile, security, managers, tenant-accounts, access-requests, buildings, history, building-settings) have no horizontal overflow, an `h1` matching the nav label, correct `aria-current`, no duplicate IDs, and primary actions clear of the floating header actions. Users drawer (owner with 2 buildings) shows header, info, building rows with permission toggle and unassign, assign select, and danger zone; Escape closes. Light theme on tenant accounts is readable. 390px: grouped drill-in list at `/dashboard/settings`, no overflow, access-requests and managers tabs are 44px, single line and scroll horizontally. 320px: managers, profile, security and buildings have no overflow; the role tablist scrolls; the profile avatar row wraps. No data was created, changed or deleted. After the final fix wave (`d14fb412`), tenant-accounts, history, access-requests, managers and building-settings were re-checked at 320, 390 and 768px with no page overflow (only the access-requests segmented tablist scrolls inside itself, by design) |

## Open items

- Owner and manager were checked in the browser by overriding the client-side role on an admin session, with no real accounts and no server writes. Server data stayed admin-scoped, so this verifies UI gating and layout only.
  - Owner sees Hồ sơ, Bảo mật, Người dùng, Tài khoản người thuê and Cài đặt tòa nhà at 1280 and 390px. The Users page has no role tabs, and the row action is off for other owners.
  - Manager sees Hồ sơ, Bảo mật and Cài đặt tòa nhà. `/dashboard/settings/managers` redirects to `/dashboard`.
  - Server-scoped owner data still needs a real owner account.
- The pending badge and access-request rows were checked with client-injected pending data at 1280 and 390px: badge `3`, `99+` for 128, an unverified row and a long email.
  - This led to two fixes. The email now truncates on its own, and provider and date stay visible (on a second line on mobile).
  - Sidebar footer and user-menu role labels now use the Vietnamese product terms (`managedRoleLabel`) instead of raw `admin`/`Admin`.
  - Gates after these fixes: 524 test files and 3378 tests pass; typecheck passes; lint has 0 errors and the same single warning; knowledge check passes.
- `prefers-reduced-motion: reduce` was not emulated in the browser.
- Capability promotion (`admin-shell`, `manager-assignment-ui`) was applied in the final fix wave on the user's pre-approval of full completion; `docs/changes/index.md` updated at finish.
- Final fix wave re-ran `npx vitest run tests/pages tests/components tests/utils tests/composables` (243 files, 1440 tests passed), `npm run typecheck` (exit 0), `npm run lint` (0 errors, same single warning) and `npm run knowledge:check` (359 concepts).
- Unrelated uncommitted contract-handover work in the checkout did not cause any gate failure.
