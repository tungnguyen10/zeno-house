---
type: Change Verification
title: "atomic-building-room-setup-verification"
status: draft
change_state: implementation-review
tags: [change, verification, buildings, rooms]
---

# Atomic Building + Room setup — verification

## Preparation and baseline

- 2026-11-11: user confirmed the one-time preparation was complete (dependency commit, migration parity and production backup). This records the user's confirmation; this implementation session did not rerun the production checks.
- Branch: `feat/v2-pr0-atomic-building-room-setup`, from `develop` at `5fd7b484`.
- Baseline `npm test`: 388 files / 2,420 tests passed before source changes.

## Local source verification

- Task 1: RED/GREEN validator tests, 7 passed; focused ESLint passed; spec and quality review approved.
- Task 2: RED/GREEN migration contract tests, 5 passed; focused ESLint passed; SQL review approved. SQL has not been executed in this session.
- Task 8: six source contract tests observed RED before implementation, then GREEN. Focused page/preview/form suite passed: 3 files / 50 tests, including three rendered interaction checks for override persistence/reset, edited payload submission, same-price reset, room validation, server duplicate rows and loading locks. `npm run typecheck` and scoped ESLint passed. Browser visual QA remains a separate pending gate.
- [x] 2026-11-11 full local gate: `npm run typecheck && npm test && npm run lint && npm run knowledge:check` exited 0. Typecheck passed; 393 test files / 2,495 tests passed; ESLint reported 0 errors and one warning in unchanged `AppAiDevChat.vue:427` (`vue/no-v-html`); OKF verified 329 concepts / 26 indexes. Full output: `/private/tmp/zeno-pr0-sdd/task-9-full-checks.log` (local session artifact).
- [ ] Whole-PR review and CI.

## SQL source review and adaptations

- Both RPCs declare `SECURITY INVOKER` and an empty `search_path`; migration source revokes execution from PUBLIC/anon/authenticated and grants it to service_role inside BEGIN/COMMIT. Static contract checks cover this structure; effective cloud privileges remain unchecked.
- SQL enforces room JSON types and the 1–200 batch, 1–20-character room number, integer floor 1–100, nonnegative rent and positive nullable area bounds. Malformed non-null wrapper room payloads fail instead of silently creating only a building.
- The human-run verification script looks up existing actors as postgres, then switches to service_role for RPC calls/assertions inside a rollback transaction. It creates no users or privileged helpers. Runtime and concurrency behavior have not been executed.
- 2026-11-11: nullable-assertion issue resolved in the verification SQL (`is distinct from` and `coalesce` so missing JSON fields fail loudly). Migration contract tests still pass (5); the script itself has not been executed.

## UI decisions

User approved the focused PR0 direction and dev server on 2026-11-11:

- Preserve the current building form hierarchy, semantic theme, typography and existing primitives.
- Add editable floor and area columns alongside room number and rent; keep generator defaults above the preview.
- Identify manual overrides with restrained existing tokens and an accessible per-cell reset to defaults.
- Preserve edits for rooms still in the generated range; the same-price option resets rent overrides.
- Keep the mobile page within the viewport and allow the preview table to scroll horizontally.
- Show actionable duplicate and validation errors; disable affected controls during submission.
- No new primitives, tokens, theme files, icon conventions or dependencies.
- Task 8 implementation: same-price control sits before the table so rent editability is visible before editing. A short note explains override retention and same-price reset. Each edited cell uses a restrained semantic accent surface, “Đã sửa”, and a small ghost “Mặc định” button with an accessible field-and-room label.
- Task 8 error presentation: render flattened `errors.rooms` alongside the preview; duplicate codes appear in a warning and on their matching rows with “Mã trùng”. Preserve the composable-driven API error banner.
- Task 8 containment: a named keyboard-focusable horizontal scroll region contains a 640px minimum table; every quick-room generator, cell and reset control is disabled while submission is in flight.

The user also approved correcting the network-error copy on 2026-11-11: “Chưa xác nhận được kết quả. Bấm thử lại để kiểm tra và tiếp tục.” A lost response can follow a successful commit; retries keep the same `request_id`. Preserve specific validation, permission and conflict errors from the server.

## Visual QA

The user authorized the dev server and manually handled Chrome's local certificate warning. The authenticated create page was observed at `https://localhost:3001/dashboard/buildings/create` before UI changes. This is setup evidence, not final visual QA.

Native Chrome QA is currently blocked by `cgWindowNotFound` and an unavailable browser host; a user unlock/reopen request is pending. Rendered component tests do not replace visual inspection.

- 2026-11-11 browser pass at the shared tab's fixed ~873px CSS width (bottom-nav layout; viewport resize was not applied by the tool), dark theme, dev server on `https://localhost:3001`: generator defaults above the preview; floor, rent and area overrides each show the tinted cell, "Đã sửa" and a "Mặc định" reset; same-price off makes rent editable; reset returns the cell to the default; address validation blocks submit; room validation shows "Kiểm tra thông tin phòng: Diện tích phải > 0" above the preview. No building was submitted.
- [ ] Desktop 1280px — not observed (tab width could not be changed).
- [ ] Mobile 375px — not observed (tab width could not be changed).
- [ ] Loading, duplicate server-error and network-error states — need the migration applied or a mocked API; not observed.

## Cloud gates — human-run

Local tests and code reviews do not establish cloud rollout or runtime SQL correctness.

- [x] Fresh backup before rollout — user confirmed 2026-11-11 (not independently verified).
- [x] `supabase db push --dry-run` reviewed (2026-11-11, production `zeno-house`): exactly one pending migration, `20261111090000`; then pushed.
- [x] Migration `20261111090000_create_building_with_rooms.sql` applied to production on 2026-11-11 with `supabase db push --linked --yes` after the user's explicit approval; CLI reported "Finished supabase db push".
- [x] `supabase/verification/create_building_with_rooms.sql` passed on production, 2026-11-11, run with `supabase db query --linked --yes -f` after the user's explicit approval. The first run failed at VERIFY 4 only because the script expected duplicate detail `["A1","a1"]` while the database collation orders it `["a1","A1"]`; the assertion now compares as a set and the rerun completed without error. Afterwards no `pr0-%` buildings or `building.create:%` operations remained (rolled back).
- [ ] Separate-session batch and request concurrency checks passed — not run.
- [x] Effective grants (read-only query on production, 2026-11-11): `create_building_with_rooms(jsonb,jsonb,uuid,uuid,uuid)` and `create_rooms_batch(uuid,jsonb)` both have anon=false, authenticated=false, service_role=true, `prosecdef=false`, `search_path=""`.
- [x] `app/types/database.types.ts` regenerated from the cloud schema (+33 lines, both RPCs only); `npm run typecheck` passed.
- [ ] Application deployed and smoke checked: create 30 rooms atomically, retry after lost response resolves to the same building.

## Acceptance

- [ ] Cloud evidence attached and behavior accepted.
- [ ] Accepted capability deltas reconciled and change bundle archived with provenance.
