---
type: Change Verification
title: "atomic-building-room-setup-verification"
status: draft
change_state: implementation-in-progress
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
- [ ] Final typecheck / test / lint / knowledge:check.
- [ ] Whole-PR review and CI.

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

- [ ] Desktop 1280px — final changed states.
- [ ] Mobile 375px — final changed states.
- [ ] Loading, duplicate, error and override/reset states.

## Cloud gates — human-run

Local tests and code reviews do not establish cloud rollout or runtime SQL correctness.

- [ ] Fresh backup before rollout.
- [ ] `supabase db push --dry-run` reviewed, then migration pushed.
- [ ] Migration `20261111090000_create_building_with_rooms.sql` applied.
- [ ] `supabase/verification/create_building_with_rooms.sql` passed.
- [ ] Separate-session batch and request concurrency checks passed.
- [ ] Effective grants: anon/authenticated cannot execute; service_role can execute.
- [ ] `app/types/database.types.ts` regenerated from the updated cloud schema, followed by typecheck.
- [ ] Application deployed and smoke checked: create 30 rooms atomically, retry after lost response resolves to the same building.

## Acceptance

- [ ] Cloud evidence attached and behavior accepted.
- [ ] Accepted capability deltas reconciled and change bundle archived with provenance.
