# Portal Invoice Latest-First Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sort the tenant portal invoice ledger by billing period from latest to oldest regardless of API return order.

**Architecture:** Keep ordering in the pure portal presentation helper so the page has one deterministic source of display order. Copy the input before a stable year/month descending sort, then reuse the existing grouping pass.

**Tech Stack:** TypeScript, Vue/Nuxt, Vitest, OpenSpec.

## Global Constraints

- Apply only to the tenant portal invoice ledger.
- Sort by `periodYear DESC`, then `periodMonth DESC`.
- Preserve original relative order for invoices in the same billing period.
- Do not mutate the composable invoice array.
- Do not change APIs, DTOs, dashboard UI, invoice detail, or MapTrack design tokens.
- Follow test-first red-green-refactor.

---

### Task 1: Latest-First Ledger Ordering

**Files:**
- Modify: `tests/utils/portal-invoice-statement.test.ts`
- Modify: `tests/pages/portal-invoices.spec.ts`
- Modify: `app/utils/tenant-portal/invoice-statement.ts`
- Modify: `openspec/specs/tenant-portal-ui/spec.md`
- Modify: `openspec/changes/refresh-tenant-portal-ui/tasks.md`

**Interfaces:**
- Consumes: `TenantInvoiceListItem[]`
- Produces: `groupTenantInvoicesByYear(invoices): TenantInvoiceYearGroup[]` ordered by newest billing period without mutating `invoices`

- [ ] **Step 1: Write failing helper and page tests**

Replace the old API-order expectations with unordered fixtures and assert:

```ts
const invoices = [
  invoice('feb-2025', 2025, 2),
  invoice('jan-2026-a', 2026, 1),
  invoice('dec-2025', 2025, 12),
  invoice('jan-2026-b', 2026, 1),
]
const originalOrder = [...invoices]

expect(groupTenantInvoicesByYear(invoices)).toEqual([
  { year: 2026, invoices: [invoices[1], invoices[3]] },
  { year: 2025, invoices: [invoices[2], invoices[0]] },
])
expect(invoices).toEqual(originalOrder)
```

The page test supplies unordered composable data and expects rendered rows in `jan-2026`, `dec-2025`, `feb-2025` order.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npx vitest run tests/utils/portal-invoice-statement.test.ts tests/pages/portal-invoices.spec.ts
```

Expected: ordering assertions fail because the helper still preserves API order.

- [ ] **Step 3: Implement minimal stable ordering**

In `groupTenantInvoicesByYear()`:

```ts
const orderedInvoices = invoices
  .map((invoice, originalIndex) => ({ invoice, originalIndex }))
  .sort((left, right) =>
    right.invoice.periodYear - left.invoice.periodYear
    || right.invoice.periodMonth - left.invoice.periodMonth
    || left.originalIndex - right.originalIndex,
  )
  .map(({ invoice }) => invoice)
```

Group `orderedInvoices` using the existing map/group pass.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/utils/portal-invoice-statement.test.ts tests/pages/portal-invoices.spec.ts
```

Expected: all focused tests pass without Vue warnings.

- [ ] **Step 5: Update accepted behavior**

Change the tenant portal statement requirement to explicitly require billing-period latest-first sorting, and update checklist item 7.1 to match.

- [ ] **Step 6: Verify the complete change**

Run:

```bash
npx vitest run tests/utils/portal-invoice-statement.test.ts tests/pages/portal-invoices.spec.ts
openspec validate --specs
npm run typecheck
npm run lint
npm test -- --exclude '.worktrees/**'
```

Expected: every command exits 0.

- [ ] **Step 7: Commit and integrate**

Commit the tested implementation, fast-forward merge `fix/portal-invoice-latest` into local `main`, rerun the full test suite on `main`, then remove the owned worktree and merged branch.
