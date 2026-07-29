# Portal Debt Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make portal home prioritize outstanding debt and expose secure invoice-snapshot transfer instructions on tenant invoice detail.

**Architecture:** The portal detail API keeps tenant scope enforcement in `TenantInvoiceService`, then resolves the already-existing immutable payment-profile snapshot and signed assets after ownership is confirmed. The portal UI renders a dedicated domain component with status-controlled prominence while the home page is simplified into room identity, debt action, and one integrated finance card.

**Tech Stack:** Nuxt 4 compatibility mode, Vue 3, TypeScript strict, TailwindCSS, Vitest, Supabase-backed server repositories, OpenSpec.

## Global Constraints

- Apply only to `/portal`; do not change dashboard UI or dashboard behavior.
- Preserve the existing MapTrack portal light/dark variables and portal primitives.
- Do not add dependencies, database migrations, new tokens, or generic primitives.
- Browser business data must remain behind `/api/tenant/**`.
- Resolve tenant invoice ownership before reading or signing its snapshot assets.
- Follow test-first red-green-refactor for every behavior change.
- Vietnamese source copy must include correct diacritics.

---

### Task 1: Accept the portal debt and payment-snapshot behavior

**Files:**
- Modify: `openspec/specs/tenant-portal-api/spec.md`
- Modify: `openspec/specs/tenant-portal-ui/spec.md`
- Modify: `openspec/changes/refresh-tenant-portal-ui/tasks.md`

**Interfaces:**
- Produces: accepted API and UI requirements that later implementation tasks satisfy.

- [ ] **Step 1: Add API scenarios**

Document that owned invoice detail returns its immutable payment-profile snapshot with short-lived signed URLs, missing snapshots return `null`, and cross-tenant requests perform no snapshot lookup.

- [ ] **Step 2: Add UI scenarios**

Document action-first portal home behavior plus outstanding, paid, void, missing-snapshot, and missing-QR invoice-detail states.

- [ ] **Step 3: Record implementation tasks in the active change**

Add checked checklist entries only after the corresponding implementation and verification are complete.

- [ ] **Step 4: Validate specs**

Run: `openspec validate --specs`

Expected: all specs valid.

### Task 2: Expose immutable payment snapshots in tenant invoice detail

**Files:**
- Modify: `tests/server/tenant-portal/services.test.ts`
- Modify: `app/types/tenant-portal.ts`
- Modify: `app/utils/mappers/tenant-portal.ts`
- Modify: `server/services/tenant-portal/invoices.ts`

**Interfaces:**
- Consumes: `BuildingInvoiceProfileRepository.findInvoiceSnapshotsByIds(event, invoiceIds)` and `InvoiceProfileDisplayService.resolveMany(event, snapshots)`.
- Produces: `TenantInvoiceDetail.invoiceProfile: InvoiceProfileDisplay | null`.

- [ ] **Step 1: Write failing service tests**

Cover: owned detail includes the resolved profile; missing snapshot returns `null`; missing/cross-tenant detail never calls snapshot repository or signer.

- [ ] **Step 2: Run the service tests and verify RED**

Run: `npx vitest run tests/server/tenant-portal/services.test.ts`

Expected: failures because snapshot collaborators and `invoiceProfile` are not implemented.

- [ ] **Step 3: Implement the DTO, mapper, and scoped service orchestration**

Import `InvoiceProfileDisplay`, add the nullable field, accept it in `mapTenantInvoiceDetail`, and resolve the snapshot only after `findDetail` succeeds.

- [ ] **Step 4: Run the service tests and verify GREEN**

Run: `npx vitest run tests/server/tenant-portal/services.test.ts`

Expected: all tests pass.

### Task 3: Build the portal transfer-instructions component

**Files:**
- Create: `app/components/portal/PortalInvoicePaymentInstructions.vue`
- Create: `tests/components/portal/PortalInvoicePaymentInstructions.spec.ts`

**Interfaces:**
- Consumes props:
  - `profile: InvoiceProfileDisplay | null`
  - `amount: number`
  - `mode: 'outstanding' | 'history'`
- Produces: portal-scoped copy feedback through `usePortalToast`.

- [ ] **Step 1: Write failing component tests**

Mount outstanding, history, missing snapshot, and missing QR states. Assert outstanding mode shows amount/QR/copy controls; history mode omits them; fallback copy is honest. Mock `navigator.clipboard.writeText` and cover success/error toast messages.

- [ ] **Step 2: Run the component test and verify RED**

Run: `npx vitest run tests/components/portal/PortalInvoicePaymentInstructions.spec.ts`

Expected: failure because the component does not exist.

- [ ] **Step 3: Implement the component**

Use portal typography/money utilities, divider-led rows, bounded QR, safe wrapping, 44px copy controls, existing SVG icon components, and current portal theme variables only.

- [ ] **Step 4: Run the component test and verify GREEN**

Run: `npx vitest run tests/components/portal/PortalInvoicePaymentInstructions.spec.ts`

Expected: all tests pass.

### Task 4: Place transfer instructions by invoice state

**Files:**
- Modify: `tests/pages/portal-invoice-detail-ui.spec.ts`
- Modify: `app/pages/portal/invoices/[id].vue`

**Interfaces:**
- Consumes: `TenantInvoiceDetail.invoiceProfile` and `PortalInvoicePaymentInstructions`.
- Produces: status-aware placement for outstanding, paid, and void invoices.

- [ ] **Step 1: Write failing page source tests**

Assert outstanding instructions render before charge details, paid history renders after charges, void invoices render a reason and no instructions, and due dates use `formatViDate`.

- [ ] **Step 2: Run the page test and verify RED**

Run: `npx vitest run tests/pages/portal-invoice-detail-ui.spec.ts`

Expected: failures for the missing state branches.

- [ ] **Step 3: Implement status-aware page composition**

Add computed outstanding/paid/void state, place the component as designed, add the void notice, format due dates, and change section headings to `h2`.

- [ ] **Step 4: Run the page and component tests and verify GREEN**

Run: `npx vitest run tests/pages/portal-invoice-detail-ui.spec.ts tests/components/portal/PortalInvoicePaymentInstructions.spec.ts`

Expected: all tests pass.

### Task 5: Simplify portal home into room, debt action, and financial context

**Files:**
- Modify: `tests/pages/portal-home-ui.spec.ts`
- Modify: `app/pages/portal/index.vue`

**Interfaces:**
- Consumes: shared portal bootstrap `error`, `status`, and `refresh`; existing `PortalCard`, `PortalEmptyState`, `PortalSpendingChart`.
- Produces: one global error state, action-first invoice statement, and one integrated finance card.

- [ ] **Step 1: Write failing source tests**

Assert: bootstrap error/retry precedes content; date is removed from keycard; invoice heading is debt-aware; due date is formatted; explicit `Xem chi tiết` exists; finance metrics live in the chart card; duplicate request/profile quick actions are absent; section headings are `h2`; room skeleton matches the card.

- [ ] **Step 2: Run the home test and verify RED**

Run: `npx vitest run tests/pages/portal-home-ui.spec.ts`

Expected: failures for the current duplicated and missing states.

- [ ] **Step 3: Implement the home composition**

Consume one bootstrap error/refresher, gate content behind loading/error, remove date and quick actions, add debt-aware copy/affordance, integrate the finance metrics, format the due date, and correct heading semantics.

- [ ] **Step 4: Run the home tests and verify GREEN**

Run: `npx vitest run tests/pages/portal-home-ui.spec.ts tests/utils/portal-financial-overview.test.ts tests/components/portal/PortalSpendingChart.spec.ts`

Expected: all tests pass.

### Task 6: Finish documentation, polish, and verification

**Files:**
- Modify: `openspec/changes/refresh-tenant-portal-ui/tasks.md`
- Review: all files changed by Tasks 1–5

**Interfaces:**
- Produces: validated, committed implementation ready for local main merge.

- [ ] **Step 1: Run focused checks**

Run:

```bash
npx vitest run tests/server/tenant-portal/services.test.ts tests/components/portal/PortalInvoicePaymentInstructions.spec.ts tests/pages/portal-invoice-detail-ui.spec.ts tests/pages/portal-home-ui.spec.ts
openspec validate --specs
```

Expected: all pass.

- [ ] **Step 2: Run static verification**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Run full regression**

Run: `npm test -- --exclude '.worktrees/**'`

Expected: all test files and tests pass.

- [ ] **Step 4: Run the final Hallmark critique**

Check hierarchy, execution, specificity, restraint, responsive widths (320/375/414/768), touch targets, overflow, dark/light variables, loading/empty/error/default/focus/active/success/failure states. Revise any axis below 3/5.

- [ ] **Step 5: Commit and merge**

Commit the verified feature branch, merge it into local `main`, rerun the full regression on the merged result, then remove the owned worktree and branch.
