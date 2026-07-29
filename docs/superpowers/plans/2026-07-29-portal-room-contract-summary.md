# Portal Room Contract Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the complete material terms of the tenant's currently active contract on `/portal/room` while retaining its minimal portal layout.

**Architecture:** Extend the existing active-housing repository select, tenant portal DTO, and mapper with stored contract fields. The existing bootstrap composable transports the enriched summary to `portal/room.vue`, where one always-visible terms group and one conditional adjustment group render the new information.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, Supabase server repository, Tailwind CSS, Vitest.

## Global Constraints

- Return data only through the existing self-scoped tenant bootstrap flow.
- Do not add an endpoint, schema migration, permission, dependency, primitive, token, or icon.
- Preserve primary-tenant and roommate scope and disclosure.
- Keep the portal mobile-first and free of horizontal overflow at 320, 375, 414, and 768 pixels.
- Only show adjustment rows when their value is meaningful; never fabricate a contract value.
- Do not alter generated `app/types/database.types.ts`.

---

### Task 1: Enrich the active tenant contract DTO

**Files:**
- Modify: `app/types/tenant-portal.ts`
- Modify: `app/utils/mappers/tenant-portal.ts`
- Modify: `server/repositories/tenant-portal/housing.ts`
- Test: `tests/utils/mappers/tenant-portal.spec.ts`

**Interfaces:**
- Produces `TenantContractSummary.paymentDay`, `occupantCount`, `discountAmount`, `surchargeAmount`, and `notes`.
- The existing bootstrap and `usePortalContract` consume the same `TenantContractSummary` shape with no endpoint change.

- [ ] **Step 1: Write the failing mapper test**

Add a `mapTenantContractSummary` test with a row containing `payment_day: 5`,
`occupant_count: 2`, `discount_amount: 150000`, `surcharge_amount: 50000`, and
`notes: 'Không nuôi thú cưng'`; assert the camel-case DTO retains every value.

- [ ] **Step 2: Run the focused test and verify RED**

Run `npx vitest run tests/utils/mappers/tenant-portal.spec.ts`.
Expected: the test fails because the enriched fields are not on the DTO.

- [ ] **Step 3: Implement the smallest DTO and repository extension**

Add the five fields to `TenantContractSummary`, its mapper row interface and
return value, `ContractRow`, and `CONTRACT_SELECT`. Keep repository resolution,
permission checks, and bootstrap flow unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `npx vitest run tests/utils/mappers/tenant-portal.spec.ts`.
Expected: all tests pass.

### Task 2: Present the contract as a minimal lease statement

**Files:**
- Modify: `app/pages/portal/room.vue`
- Test: `tests/pages/portal-room-ui.spec.ts`

**Interfaces:**
- Consumes the enriched `TenantContractSummary` through `usePortalContract`.
- Produces the same room route with its existing loading, error, empty, primary,
  and roommate states.

- [ ] **Step 1: Write the failing room-page test**

Assert for `Điều khoản chính`, `Ngày thanh toán`, `Số người ở`, and conditional
guards for `contract.discountAmount`, `contract.surchargeAmount`, and
`contract.notes`.

- [ ] **Step 2: Run the focused test and verify RED**

Run `npx vitest run tests/pages/portal-room-ui.spec.ts`.
Expected: the test fails because the hierarchy and optional-field guards do not
exist.

- [ ] **Step 3: Implement the statement hierarchy**

Keep the room identity card. Add a title and divider-separated key-value rows
for primary terms. Render payment day as `Ngày {n} hằng tháng` when present,
otherwise `Chưa thỏa thuận`; render an adjustment group only when an adjustment
is non-zero or notes are non-empty. Use the existing portal typography, money,
border, and text classes; wrap long note content within a two-line row rather
than creating a nested card.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `npx vitest run tests/pages/portal-room-ui.spec.ts`.
Expected: all tests pass.

### Task 3: Verify the vertical slice

**Files:**
- Verify: `app/types/tenant-portal.ts`
- Verify: `app/utils/mappers/tenant-portal.ts`
- Verify: `server/repositories/tenant-portal/housing.ts`
- Verify: `app/pages/portal/room.vue`

- [ ] **Step 1: Run focused regressions**

Run `npx vitest run tests/utils/mappers/tenant-portal.spec.ts tests/pages/portal-room-ui.spec.ts tests/pages/portal-home-ui.spec.ts`.

- [ ] **Step 2: Run static checks**

Run `npm run typecheck`, `npm run lint`, and `openspec validate --specs`.

- [ ] **Step 3: Inspect responsive and state behavior**

When an authenticated portal runtime is available, inspect `/portal/room` at
320, 375, 414, and 768 pixels for active primary, active roommate, no contract,
loading, and error states. Confirm no horizontal scroll and that conditional
adjustments leave no empty group.
