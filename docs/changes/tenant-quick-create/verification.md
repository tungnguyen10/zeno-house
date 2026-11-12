---
type: Verification Record
title: "tenant-quick-create — verification checkpoint"
status: draft
change_state: verification-pending
tags: [change, verification, tenants, contracts]
---

# Tenant quick create — verification

> Tasks 1–6 implemented TDD-first on Node 22; client-only (no API/migration). Code only (no git, no visual QA). Cloud gate: none (no migration).

## UI decisions (Task 2)

- Reused existing primitives only (`UiCombobox`, `UiModal` mobile-fullscreen, `UiInput`, `UiDatePicker`, `UiFormSection`, `UiAlert`, `UiButton`). No new tokens/primitives.
- `TenantPicker` wraps `UiCombobox` with `remote-search` + `allow-custom` (gated on `tenants.create`); 250 ms debounced server search against `GET /api/tenants?q=&available=true&limit=20`; `excludeTenantIds` filtered client-side; current selection summary loaded via `GET /api/tenants/{id}` for draft restore / edit mode.
- `TenantQuickCreateDialog`: name + phone required, collapsible "Thông tin giấy tờ (không bắt buộc)" (id number / dob / issued date-place / permanent address), validated with `tenantCreateSchema`. Duplicate (change B `TENANT_DUPLICATE`) → a "Dùng khách này" card showing the existing tenant, disabled with "Khách đang ở theo hợp đồng khác" when `hasActiveContract`/`activeAssignment`. Generic `TENANT_IDENTITY_CONFLICT` 409 → warning alert verbatim, no action. State resets on close. No tenant PII written to localStorage/sessionStorage.
- Phone-like custom entry prefills the phone field (via `normalizeTenantPhone`), otherwise the name field.

## Deltas from plan

- `TenantPicker` imports `useAuthStore` explicitly (it is a Nuxt auto-import in the app; the explicit import lets the component test mock `~/stores/auth`). No behaviour change.
- `contracts/create.vue` resolves `room_id` (uuid or room code) in `onMounted` rather than top-level await, to keep the Nuxt composable context intact for the composables declared above it; the initial snapshot is synced so the prefilled room is not treated as a dirty edit.
- `ContractOccupantForm` drops the now-unused `available` prop; its submit payload gains `tenantName` (used by the create wizard to label pending occupants without a tenant list). The extra field is stripped server-side by the non-strict occupant validator, so the contract-detail add-occupant path is unaffected.
- Task 6 basic-access search guard: PR3 adds no server behaviour; the change-B basic-access field reduction remains covered by the existing `tests/server/tenants` suite, so no brittle new assertion was added. Noted here instead.

## Local (source) — run on Node 22 (2026-11-12)

- [x] `npm run typecheck` — pass (Supabase env warnings only).
- [x] `npm test` — **2602/2602 pass** (426 files).
- [x] `npm run lint` — 0 errors (fixed two `import/first` in the new tenant component tests via `--fix`; 1 pre-existing `vue/no-v-html` warning, unrelated).
- [x] `npm run knowledge:check` — OK (332 concepts).

## Visual QA — run by maintainer

- [ ] Picker search / empty / loading — desktop + mobile
- [ ] Quick create success; duplicate (free, busy); generic conflict
- [ ] Roommate add in create wizard and contract detail
- [ ] Room "Tạo hợp đồng" preselects the room (code → uuid)
- [ ] Manager: no "Thêm khách mới" row

## Privacy

- [x] `useTenantQuickCreate` never calls `localStorage.setItem` (unit test); dialog clears in-memory state on close.
