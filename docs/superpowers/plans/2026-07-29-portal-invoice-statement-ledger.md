# Portal Invoice Statement Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the tenant invoice list and detail into a polished, production-ready statement-history experience without changing data contracts or the MapTrack portal design system.

**Architecture:** Add one small pure presentation helper for stable year grouping and bounded payment progress, then compose the existing portal pages around ledger rows and a document-like summary. Existing composables, status mapping, payment snapshot component, pull-to-refresh behavior, and server contracts remain unchanged.

**Tech Stack:** Nuxt 4 compatibility mode, Vue 3, TypeScript strict, TailwindCSS, existing MapTrack portal variables/primitives, Vitest, OpenSpec.

## Global Constraints

- Apply only to `/portal/invoices` and `/portal/invoices/[id]`; do not modify dashboard UI.
- Preserve the existing invoice order returned by `usePortalInvoices()`.
- Do not add filters, search, bulk actions, pagination changes, API changes, database changes, or dependencies.
- Preserve MapTrack portal light/dark variables, Inter typography, portal status semantics, and `nuxt-svgo` icon conventions.
- Do not introduce a new theme, font, token, generic primitive, or external component library.
- Preserve outstanding, paid-history, void, missing-snapshot, missing-QR, copy-loading, copy-success, and copy-error behavior.
- Follow test-first red-green-refactor for every production behavior change.
- Vietnamese source copy must include correct diacritics.

---

### Task 1: Pure Invoice Presentation Helpers

**Files:**
- Create: `app/utils/tenant-portal/invoice-statement.ts`
- Create: `tests/utils/portal-invoice-statement.test.ts`

**Interfaces:**
- Consumes: `TenantInvoiceListItem[]`.
- Produces:
  - `groupTenantInvoicesByYear(invoices): Array<{ year: number; invoices: TenantInvoiceListItem[] }>`
  - `tenantInvoicePaymentProgress(totalAmount: number, paidAmount: number): number`

- [ ] **Step 1: Write failing helper tests**

```ts
import { describe, expect, it } from 'vitest'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'
import {
  groupTenantInvoicesByYear,
  tenantInvoicePaymentProgress,
} from '~/utils/tenant-portal/invoice-statement'

describe('portal invoice statement helpers', () => {
  it('groups by first-seen year without changing invoice order', () => {
    const invoices = [
      { id: 'jul', periodYear: 2026 },
      { id: 'jan', periodYear: 2026 },
      { id: 'dec', periodYear: 2025 },
    ] as TenantInvoiceListItem[]

    expect(groupTenantInvoicesByYear(invoices)).toEqual([
      { year: 2026, invoices: [invoices[0], invoices[1]] },
      { year: 2025, invoices: [invoices[2]] },
    ])
  })

  it.each([
    [0, 0, 0],
    [1_000, -50, 0],
    [1_000, 250, 25],
    [1_000, 2_000, 100],
  ])('bounds payment progress for total %s and paid %s', (total, paid, expected) => {
    expect(tenantInvoicePaymentProgress(total, paid)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run the helper test and verify RED**

Run: `npx vitest run tests/utils/portal-invoice-statement.test.ts`

Expected: FAIL because `invoice-statement.ts` does not exist.

- [ ] **Step 3: Implement minimal pure helpers**

```ts
import type { TenantInvoiceListItem } from '~/types/tenant-portal'

export interface TenantInvoiceYearGroup {
  year: number
  invoices: TenantInvoiceListItem[]
}

export function groupTenantInvoicesByYear(
  invoices: TenantInvoiceListItem[],
): TenantInvoiceYearGroup[] {
  const groups: TenantInvoiceYearGroup[] = []
  const byYear = new Map<number, TenantInvoiceYearGroup>()

  for (const invoice of invoices) {
    let group = byYear.get(invoice.periodYear)
    if (!group) {
      group = { year: invoice.periodYear, invoices: [] }
      byYear.set(invoice.periodYear, group)
      groups.push(group)
    }
    group.invoices.push(invoice)
  }

  return groups
}

export function tenantInvoicePaymentProgress(totalAmount: number, paidAmount: number): number {
  if (totalAmount <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((paidAmount / totalAmount) * 100)))
}
```

- [ ] **Step 4: Run the helper test and verify GREEN**

Run: `npx vitest run tests/utils/portal-invoice-statement.test.ts`

Expected: all helper tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/utils/tenant-portal/invoice-statement.ts tests/utils/portal-invoice-statement.test.ts
git commit -m "feat: add portal invoice statement helpers"
```

### Task 2: Year-Grouped Statement Ledger

**Files:**
- Modify: `tests/pages/portal-invoices.spec.ts`
- Modify: `app/pages/portal/invoices/index.vue`

**Interfaces:**
- Consumes: `groupTenantInvoicesByYear`, `formatViDate`, `PortalStatusBadge`, `PortalPullToRefresh`.
- Produces: semantic year sections containing continuous interactive ledger rows.

- [ ] **Step 1: Extend the page test with failing ledger expectations**

Update the portal-card stub into a button that forwards click and add assertions equivalent to:

```ts
it('renders a year-grouped statement ledger in returned order', () => {
  invoicesState.invoices.value = [
    invoice({ id: 'jul-26', periodYear: 2026, periodMonth: 7 }),
    invoice({ id: 'jan-26', periodYear: 2026, periodMonth: 1 }),
    invoice({ id: 'dec-25', periodYear: 2025, periodMonth: 12 }),
  ]
  const wrapper = mountPage()

  expect(wrapper.findAll('[data-year]').map(node => node.attributes('data-year')))
    .toEqual(['2026', '2025'])
  expect(wrapper.findAll('[data-invoice-row]').map(node => node.attributes('data-invoice-row')))
    .toEqual(['jul-26', 'jan-26', 'dec-25'])
})

it('formats the due date and exposes one whole-row navigation target', async () => {
  invoicesState.invoices.value = [invoice({ dueDate: '2026-07-15' })]
  const wrapper = mountPage()

  expect(wrapper.text()).toContain('15/7/2026')
  await wrapper.get('[data-invoice-row="inv-1"]').trigger('click')
  expect(navigateTo).toHaveBeenCalledWith('/portal/invoices/inv-1')
  expect(wrapper.find('[data-invoice-row] button').exists()).toBe(false)
})
```

Also assert:

- `Lịch sử hoá đơn` and the honest loaded count are present;
- status badge and primary amount remain;
- loading skeletons use `data-ledger-skeleton`;
- the old `sm:grid-cols-2 xl:grid-cols-3` tile grid is absent.

- [ ] **Step 2: Run the page test and verify RED**

Run: `npx vitest run tests/pages/portal-invoices.spec.ts`

Expected: failures for missing year groups, ledger markers, formatted due date, and ledger loading shape.

- [ ] **Step 3: Implement the ledger page**

In `app/pages/portal/invoices/index.vue`:

```ts
import { formatViDate } from '~/utils/format/time'
import { groupTenantInvoicesByYear } from '~/utils/tenant-portal/invoice-statement'

const invoiceYearGroups = computed(() => groupTenantInvoicesByYear(invoices.value))
```

Compose:

- a non-card page introduction;
- loading as one bordered surface with six divider-separated skeleton rows;
- `section v-for="group in invoiceYearGroups"` with `h2`;
- one `PortalCard :padded="false"` per year;
- native full-width row buttons inside the non-interactive surface, with existing focus/active/reduced-motion classes;
- mobile two-tier layout and `md:grid-cols-[5rem_minmax(0,1fr)_minmax(8rem,auto)_auto]`;
- formatted due dates and one trailing chevron;
- no nested action.

- [ ] **Step 4: Run the list page and helper tests and verify GREEN**

Run:

```bash
npx vitest run tests/pages/portal-invoices.spec.ts tests/utils/portal-invoice-statement.test.ts
```

Expected: all tests pass with no Vue warnings.

- [ ] **Step 5: Commit**

```bash
git add app/pages/portal/invoices/index.vue tests/pages/portal-invoices.spec.ts
git commit -m "feat: redesign portal invoice history ledger"
```

### Task 3: Document-Like Invoice Detail Summary

**Files:**
- Modify: `tests/pages/portal-invoice-detail-ui.spec.ts`
- Modify: `app/pages/portal/invoices/[id].vue`

**Interfaces:**
- Consumes: `tenantInvoicePaymentProgress`, current detail DTO, existing transfer-instruction component.
- Produces: a statement summary with one headline amount and an accessible progress rail.

- [ ] **Step 1: Add failing detail source expectations**

Add assertions equivalent to:

```ts
it('renders an accessible bounded payment rail', () => {
  expect(page).toContain('tenantInvoicePaymentProgress')
  expect(page).toContain('const paymentProgress = computed')
  expect(page).toContain('role="progressbar"')
  expect(page).toContain(':aria-valuenow="paymentProgress"')
  expect(page).toContain(':style="{ width: `${paymentProgress}%` }"')
})

it('uses a document hierarchy without a circular chart', () => {
  expect(page).toContain('Thông tin hoá đơn')
  expect(page).toContain('Đã thanh toán')
  expect(page).toContain('Tổng cộng')
  expect(page).not.toContain('PortalPaymentRing')
  expect(page).not.toContain('<dl class="divide-y divide-border-light mt-4 border-y')
})
```

Retain all existing assertions for transfer-instruction ordering, paid history, void behavior, charge grouping, loading, semantic headings, and date formatting.

- [ ] **Step 2: Run the detail test and verify RED**

Run: `npx vitest run tests/pages/portal-invoice-detail-ui.spec.ts`

Expected: failures for the missing payment progress and document hierarchy.

- [ ] **Step 3: Implement the statement summary**

In `app/pages/portal/invoices/[id].vue`:

```ts
import { tenantInvoicePaymentProgress } from '~/utils/tenant-portal/invoice-statement'

const paymentProgress = computed(() => {
  if (!invoice.value) return 0
  return tenantInvoicePaymentProgress(invoice.value.totalAmount, invoice.value.paidAmount)
})
```

Refine the first `PortalCard` to:

- use a restrained `Thông tin hoá đơn` label;
- keep period/code/status and formatted metadata;
- render one primary amount;
- replace the repeated divider list with an ARIA progress rail;
- show compact total, paid, and conditional remaining values in one responsive grid;
- retain status accent and all downstream content order unchanged.

- [ ] **Step 4: Run detail, transfer, and helper tests and verify GREEN**

Run:

```bash
npx vitest run tests/pages/portal-invoice-detail-ui.spec.ts tests/components/portal/PortalInvoicePaymentInstructions.spec.ts tests/utils/portal-invoice-statement.test.ts
```

Expected: all tests pass with no warnings.

- [ ] **Step 5: Commit**

```bash
git add app/pages/portal/invoices/[id].vue tests/pages/portal-invoice-detail-ui.spec.ts
git commit -m "feat: polish portal invoice statement detail"
```

### Task 4: Accepted Requirements And Final Quality Gate

**Files:**
- Modify: `openspec/specs/tenant-portal-ui/spec.md`
- Modify: `openspec/changes/refresh-tenant-portal-ui/tasks.md`
- Review: all files changed by Tasks 1–3

**Interfaces:**
- Produces: accepted statement-ledger behavior and a verified feature branch ready for local main merge.

- [ ] **Step 1: Add accepted UI scenarios**

Document:

- list remains newest-first and groups by year without re-sorting;
- each row exposes statement identity, formatted due date, payment context, status, and whole-row navigation;
- detail exposes one primary amount and accessible bounded payment progress;
- existing transfer and void state ordering remains unchanged.

- [ ] **Step 2: Add active-change checklist entries**

Append section `7. Statement ledger polish` with checklist items for list, detail, state preservation, and verification. Check items only after their implementation and verification complete.

- [ ] **Step 3: Run focused verification**

Run:

```bash
npx vitest run tests/utils/portal-invoice-statement.test.ts tests/pages/portal-invoices.spec.ts tests/pages/portal-invoice-detail-ui.spec.ts tests/components/portal/PortalInvoicePaymentInstructions.spec.ts
openspec validate --specs
```

Expected: all tests and all specs pass.

- [ ] **Step 4: Run static verification**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 5: Run full regression**

Run: `npm test -- --exclude '.worktrees/**'`

Expected: every test file passes with zero failures.

- [ ] **Step 6: Perform the final UI critique**

Check:

- source behavior at 320, 375, 414, and 768px;
- no horizontal overflow, nested controls, two-line clickable labels, raw date strings, new raw colors, or new font declarations;
- loading, empty, error, default, hover, focus-visible, active, pull-refresh, outstanding, paid, void, missing-snapshot, copy-loading, copy-success, and copy-error states;
- Hallmark scores for Philosophy, Hierarchy, Execution, Specificity, Restraint, and Variety, revising any score below 3/5.

- [ ] **Step 7: Commit and merge**

Commit OpenSpec/checklist updates, merge the verified branch into local `main`, run the full regression again on the merged result, then remove the owned worktree and branch.
