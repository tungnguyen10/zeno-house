# Portal Financial Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a MapTrack-themed dual-line invoice chart and two compact financial insight cards to the tenant portal home.

**Architecture:** A pure utility derives the six-period financial series and summary values from the existing bootstrap invoices. A portal-only chart-theme composable resolves existing `.portal-shell` CSS variables into concrete Chart.js colors without changing dashboard chart theming. `PortalSpendingChart` renders the series, while the home page composes the two insight cards.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, Chart.js, vue-chartjs, TailwindCSS, Vitest, Vue Test Utils.

## Global Constraints

- Use only `TenantInvoiceListItem[]` already returned by the tenant bootstrap.
- Do not change APIs, services, repositories, database schema, DTOs, dashboard files, MapTrack tokens, fonts, radii, shadows, or navigation.
- Preserve `PortalSpendingChart` props: `invoices`, optional `limit`, and optional `height`.
- Keep the overview hidden when fewer than two invoices exist.
- Resolve chart colors from existing `--portal-*` variables; do not duplicate literal MapTrack color values.
- Respect `prefers-reduced-motion`.

---

### Task 1: Derive the financial series and insights

**Files:**
- Create: `app/utils/tenant-portal/financial-overview.ts`
- Test: `tests/utils/portal-financial-overview.test.ts`

**Interfaces:**
- Consumes: `TenantInvoiceListItem[]`, newest-first.
- Produces:

```ts
export interface PortalFinancialOverview {
  invoices: TenantInvoiceListItem[]
  labels: string[]
  totalAmounts: number[]
  paidAmounts: number[]
  averageMonthlyAmount: number
  paidRatio: number
}

export function buildPortalFinancialOverview(
  invoices: TenantInvoiceListItem[],
  limit?: number,
): PortalFinancialOverview
```

- [ ] **Step 1: Write the failing utility tests**

```ts
import { describe, expect, it } from 'vitest'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'
import { buildPortalFinancialOverview } from '~/utils/tenant-portal/financial-overview'

function invoice(month: number, totalAmount: number, paidAmount: number): TenantInvoiceListItem {
  return {
    id: `invoice-${month}`,
    invoiceCode: `HD-${month}`,
    billingPeriodId: `period-${month}`,
    periodYear: 2026,
    periodMonth: month,
    buildingId: 'building-1',
    buildingName: 'Zeno House',
    buildingSlug: 'zeno-house',
    roomId: 'room-1',
    roomNumber: 'A101',
    contractId: 'contract-1',
    contractCode: 'HD-A101',
    totalAmount,
    paidAmount,
    balanceAmount: Math.max(0, totalAmount - paidAmount),
    dueDate: null,
    status: paidAmount >= totalAmount ? 'paid' : 'partial',
    issuedAt: null,
    voidedAt: null,
    voidReason: null,
    notes: null,
  }
}

describe('buildPortalFinancialOverview', () => {
  it('limits newest-first input and returns chronological chart series', () => {
    const result = buildPortalFinancialOverview([
      invoice(6, 6_000_000, 3_000_000),
      invoice(5, 5_000_000, 5_000_000),
      invoice(4, 4_000_000, 4_000_000),
    ], 2)

    expect(result.labels).toEqual(['05/26', '06/26'])
    expect(result.totalAmounts).toEqual([5_000_000, 6_000_000])
    expect(result.paidAmounts).toEqual([5_000_000, 3_000_000])
    expect(result.averageMonthlyAmount).toBe(5_500_000)
    expect(result.paidRatio).toBe(73)
  })

  it('returns zero insights for an empty or zero-total series', () => {
    expect(buildPortalFinancialOverview([])).toMatchObject({
      averageMonthlyAmount: 0,
      paidRatio: 0,
    })
    expect(buildPortalFinancialOverview([invoice(6, 0, 0)])).toMatchObject({
      averageMonthlyAmount: 0,
      paidRatio: 0,
    })
  })

  it('clamps the paid ratio to one hundred percent', () => {
    expect(buildPortalFinancialOverview([invoice(6, 1_000_000, 2_000_000)]).paidRatio).toBe(100)
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run tests/utils/portal-financial-overview.test.ts`

Expected: FAIL because `financial-overview.ts` does not exist.

- [ ] **Step 3: Implement the pure derivation**

```ts
import type { TenantInvoiceListItem } from '~/types/tenant-portal'

export interface PortalFinancialOverview {
  invoices: TenantInvoiceListItem[]
  labels: string[]
  totalAmounts: number[]
  paidAmounts: number[]
  averageMonthlyAmount: number
  paidRatio: number
}

export function buildPortalFinancialOverview(
  invoices: TenantInvoiceListItem[],
  limit = 6,
): PortalFinancialOverview {
  const recent = [...invoices].slice(0, limit).reverse()
  const totalAmount = recent.reduce((sum, item) => sum + item.totalAmount, 0)
  const paidAmount = recent.reduce((sum, item) => sum + item.paidAmount, 0)

  return {
    invoices: recent,
    labels: recent.map(item =>
      `${String(item.periodMonth).padStart(2, '0')}/${String(item.periodYear).slice(-2)}`,
    ),
    totalAmounts: recent.map(item => item.totalAmount),
    paidAmounts: recent.map(item => item.paidAmount),
    averageMonthlyAmount: recent.length > 0 ? Math.round(totalAmount / recent.length) : 0,
    paidRatio: totalAmount > 0
      ? Math.min(100, Math.max(0, Math.round((paidAmount / totalAmount) * 100)))
      : 0,
  }
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npx vitest run tests/utils/portal-financial-overview.test.ts`

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/utils/tenant-portal/financial-overview.ts tests/utils/portal-financial-overview.test.ts
git commit -m "feat(portal): derive financial overview metrics"
```

### Task 2: Resolve Chart.js colors from portal tokens

**Files:**
- Create: `app/composables/tenant-portal/usePortalChartTheme.ts`
- Test: `tests/composables/usePortalChartTheme.test.ts`

**Interfaces:**
- Consumes: `usePortalTheme().resolvedTheme`, `.portal-shell`, and `prefers-reduced-motion`.
- Produces:

```ts
export interface PortalChartPalette {
  accent: string
  accentSoft: string
  positive: string
  border: string
  surfaceDeep: string
  title: string
  body: string
  muted: string
}

export function usePortalChartTheme(): {
  palette: Readonly<Ref<PortalChartPalette>>
  animationDuration: Readonly<Ref<number>>
  refresh: () => void
}
```

- [ ] **Step 1: Write failing adapter tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

describe('usePortalChartTheme', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="portal-shell"></div>'
    vi.resetModules()
  })

  it('resolves existing portal variables into concrete chart colors', async () => {
    vi.stubGlobal('getComputedStyle', vi.fn(() => ({
      getPropertyValue: (name: string) => ({
        '--portal-accent': '#0d9488',
        '--portal-accent-soft': '#e6fffa',
        '--portal-positive': '#10b981',
        '--portal-border': '#dbe7e8',
        '--portal-surface-deep': '#e2e8f0',
        '--portal-title': '#102a43',
        '--portal-body': '#475569',
        '--portal-muted': '#64748b',
      }[name] ?? ''),
    })))

    const { usePortalChartTheme } = await import('~/composables/tenant-portal/usePortalChartTheme')
    const theme = usePortalChartTheme()
    theme.refresh()

    expect(theme.palette.value).toMatchObject({
      accent: '#0d9488',
      positive: '#10b981',
      surfaceDeep: '#e2e8f0',
    })
  })

  it('disables animation for reduced motion', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn() })))
    const { usePortalChartTheme } = await import('~/composables/tenant-portal/usePortalChartTheme')
    const theme = usePortalChartTheme()
    await nextTick()
    expect(theme.animationDuration.value).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run tests/composables/usePortalChartTheme.test.ts`

Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Implement the portal-only adapter**

```ts
import type { DeepReadonly, Ref } from 'vue'
import { usePortalTheme } from './usePortalTheme'

export interface PortalChartPalette {
  accent: string
  accentSoft: string
  positive: string
  border: string
  surfaceDeep: string
  title: string
  body: string
  muted: string
}

const TRANSPARENT_PALETTE: PortalChartPalette = {
  accent: 'transparent',
  accentSoft: 'transparent',
  positive: 'transparent',
  border: 'transparent',
  surfaceDeep: 'transparent',
  title: 'transparent',
  body: 'transparent',
  muted: 'transparent',
}

function reducedMotionDuration(): number {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 220
}

export function usePortalChartTheme(): {
  palette: DeepReadonly<Ref<PortalChartPalette>>
  animationDuration: DeepReadonly<Ref<number>>
  refresh: () => void
} {
  const { resolvedTheme } = usePortalTheme()
  const palette = shallowRef<PortalChartPalette>({ ...TRANSPARENT_PALETTE })
  const animationDuration = ref(reducedMotionDuration())

  function refresh() {
    if (typeof document === 'undefined') return
    const shell = document.querySelector<HTMLElement>('.portal-shell')
    if (!shell) return

    const styles = getComputedStyle(shell)
    const read = (name: string) => styles.getPropertyValue(name).trim() || 'transparent'
    palette.value = {
      accent: read('--portal-accent'),
      accentSoft: read('--portal-accent-soft'),
      positive: read('--portal-positive'),
      border: read('--portal-border'),
      surfaceDeep: read('--portal-surface-deep'),
      title: read('--portal-title'),
      body: read('--portal-body'),
      muted: read('--portal-muted'),
    }
  }

  onMounted(refresh)
  watch(resolvedTheme, async () => {
    await nextTick()
    refresh()
  })

  return {
    palette: readonly(palette),
    animationDuration: readonly(animationDuration),
    refresh,
  }
}
```

Use only resolved CSS custom properties; the transparent initialization is a non-branded SSR-safe fallback, not a second palette.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npx vitest run tests/composables/usePortalChartTheme.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/composables/tenant-portal/usePortalChartTheme.ts tests/composables/usePortalChartTheme.test.ts
git commit -m "feat(portal): resolve chart colors from portal theme"
```

### Task 3: Upgrade the spending chart to two financial series

**Files:**
- Modify: `app/components/portal/PortalSpendingChart.vue`
- Create: `tests/components/portal/PortalSpendingChart.spec.ts`
- Modify: `app/pages/portal/ui-showcase.vue`

**Interfaces:**
- Consumes: `buildPortalFinancialOverview()`, `usePortalChartTheme()`, and existing component props.
- Produces: a dual-line Chart.js surface with external legend and text alternative.

- [ ] **Step 1: Write the failing chart component test**

Mock `vue-chartjs` with a `Line` component that exposes dataset labels, data, dash style, and animation duration as attributes. Mount `PortalSpendingChart` with a `ClientOnly` passthrough and two invoices. Assert:

```ts
expect(labels).toEqual(['Tổng hóa đơn', 'Đã thanh toán'])
expect(wrapper.text()).toContain('Tổng hóa đơn')
expect(wrapper.text()).toContain('Đã thanh toán')
expect(wrapper.get('[data-test="chart-summary"]').text()).toContain('02/26 đến 03/26')
expect(datasets[0].fill).toBe(true)
expect(datasets[1].borderDash).toEqual([5, 4])
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run tests/components/portal/PortalSpendingChart.spec.ts`

Expected: FAIL because the existing chart exposes one unnamed dataset and dashboard colors.

- [ ] **Step 3: Implement the dual-line chart**

Replace the old status-color derivation with these computed chart contracts:

```ts
import { usePortalChartTheme } from '~/composables/tenant-portal/usePortalChartTheme'
import { buildPortalFinancialOverview } from '~/utils/tenant-portal/financial-overview'

const overview = computed(() =>
  buildPortalFinancialOverview(props.invoices, props.limit ?? 6),
)
const hasData = computed(() => overview.value.invoices.length > 0)
const { palette, animationDuration } = usePortalChartTheme()

const chartData = computed<ChartData<'line'>>(() => ({
  labels: overview.value.labels,
  datasets: [
    {
      label: 'Tổng hóa đơn',
      data: overview.value.totalAmounts,
      borderColor: palette.value.accent,
      backgroundColor: palette.value.accentSoft,
      borderWidth: 2,
      fill: true,
      tension: 0.28,
      pointRadius: 3,
      pointHoverRadius: 5,
    },
    {
      label: 'Đã thanh toán',
      data: overview.value.paidAmounts,
      borderColor: palette.value.positive,
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [5, 4],
      fill: false,
      tension: 0.28,
      pointRadius: 3,
      pointHoverRadius: 5,
    },
  ],
}))

const chartSummary = computed(() => {
  const first = overview.value.labels[0]
  const last = overview.value.labels.at(-1)
  if (!first || !last) return ''
  return `${first} đến ${last}: tổng hóa đơn và số tiền đã thanh toán theo từng kỳ.`
})
```

Set `animation.duration` to `animationDuration.value`; use `surfaceDeep`, `title`, `body`, `muted`, and `border` for the tooltip, axes, tick labels, and grid. The tooltip callback must return
`` `${ctx.dataset.label}: ${formatCurrency(Number(ctx.parsed.y))}` ``.

Render the legend and text alternative inside the data branch:

```vue
<div v-if="hasData" class="w-full">
  <div :style="{ height: heightPx }">
    <Line :data="chartData" :options="chartOptions" />
  </div>
  <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-border-light pt-3">
    <span class="inline-flex items-center gap-2 portal-type-caption text-body">
      <span class="h-0.5 w-5 rounded-full bg-theme" aria-hidden="true" />
      Tổng hóa đơn
    </span>
    <span class="inline-flex items-center gap-2 portal-type-caption text-body">
      <span class="w-5 border-t-2 border-dashed border-portal-positive" aria-hidden="true" />
      Đã thanh toán
    </span>
  </div>
  <p data-test="chart-summary" class="sr-only">{{ chartSummary }}</p>
</div>
```

Keep the existing `ClientOnly`, height prop, empty message, and fallback skeleton unchanged around this data branch.

Update the showcase copy only if necessary to keep the component example accurate; do not add a second chart.

- [ ] **Step 4: Run component and showcase tests**

Run: `npx vitest run tests/components/portal/PortalSpendingChart.spec.ts tests/pages/portal-ui-showcase.spec.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/components/portal/PortalSpendingChart.vue app/pages/portal/ui-showcase.vue tests/components/portal/PortalSpendingChart.spec.ts
git commit -m "feat(portal): show billed and paid trends"
```

### Task 4: Compose the portal home financial overview

**Files:**
- Modify: `app/pages/portal/index.vue`
- Modify: `tests/pages/portal-home-ui.spec.ts`
- Modify: `openspec/specs/tenant-portal-ui/spec.md`

**Interfaces:**
- Consumes: `buildPortalFinancialOverview(invoices, 6)`, `formatCurrencyCompact()`, and `PortalSpendingChart`.
- Produces: the approved home order and insight cards.

- [ ] **Step 1: Write the failing page contract and spec assertions**

Add assertions that:

```ts
expect(page).toContain('const financialOverview = computed')
expect(page).toContain('Bình quân mỗi tháng')
expect(page).toContain('Tỷ lệ đã thanh toán')
expect(page).toContain('grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')
expect(page.indexOf('Financial overview')).toBeLessThan(page.indexOf('Quick actions'))
```

Append this accepted requirement to `openspec/specs/tenant-portal-ui/spec.md`:

```md
### Requirement: Tenant financial overview
The portal home SHALL summarize recent invoice activity using existing tenant invoice data and the portal design system.

#### Scenario: Tenant has enough invoice history
- **WHEN** the tenant has at least two invoices
- **THEN** the portal home displays up to the six newest invoice periods in chronological order
- **AND** the chart distinguishes total invoice value from paid value
- **AND** the home displays average monthly invoice value and the paid ratio
- **AND** chart colors resolve from the active portal theme
- **AND** chart animation is disabled when the tenant prefers reduced motion

#### Scenario: Tenant has insufficient invoice history
- **WHEN** the tenant has fewer than two invoices
- **THEN** the financial overview is not displayed
```

- [ ] **Step 2: Run the page test and verify RED**

Run: `npx vitest run tests/pages/portal-home-ui.spec.ts`

Expected: FAIL because the insight cards and approved section order do not exist.

- [ ] **Step 3: Implement the page composition**

In `app/pages/portal/index.vue`:

```ts
import { buildPortalFinancialOverview } from '~/utils/tenant-portal/financial-overview'

const financialOverview = computed(() => buildPortalFinancialOverview(invoices.value, 6))
```

Move the existing spending section before quick actions, rename it `Tổng quan tài chính`, and compose:

```vue
<PortalCard>
  <PortalSpendingChart :invoices="invoices" />
</PortalCard>
<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
  <PortalCard>
    <p class="portal-type-caption text-body">Bình quân mỗi tháng</p>
    <p class="portal-money mt-1 text-base font-semibold text-title">
      {{ formatCurrencyCompact(financialOverview.averageMonthlyAmount) }}
      <span class="portal-money-unit">₫</span>
    </p>
  </PortalCard>
  <PortalCard>
    <p class="portal-type-caption text-body">Tỷ lệ đã thanh toán</p>
    <p class="portal-money mt-1 text-base font-semibold text-portal-positive-ink">
      {{ financialOverview.paidRatio }}%
    </p>
  </PortalCard>
</div>
```

Remove the old status-dot legend because the new chart owns a two-series legend.

- [ ] **Step 4: Run focused tests and validate the spec**

Run:

```bash
npx vitest run tests/utils/portal-financial-overview.test.ts tests/composables/usePortalChartTheme.test.ts tests/components/portal/PortalSpendingChart.spec.ts tests/pages/portal-home-ui.spec.ts tests/pages/portal-ui-showcase.spec.ts
openspec validate --specs
```

Expected: focused tests and spec validation pass.

- [ ] **Step 5: Commit**

```bash
git add app/pages/portal/index.vue tests/pages/portal-home-ui.spec.ts openspec/specs/tenant-portal-ui/spec.md
git commit -m "feat(portal): add home financial overview"
```

### Task 5: Final verification and local integration

**Files:**
- Verify only.

- [ ] **Step 1: Run portal regression tests**

Run: `npx vitest run tests/components/portal tests/composables/usePortalTheme.test.ts tests/composables/usePortalChartTheme.test.ts tests/pages/portal-home-ui.spec.ts tests/pages/portal-ui-showcase.spec.ts tests/utils/portal-financial-overview.test.ts`

Expected: all selected tests pass.

- [ ] **Step 2: Run static checks**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Run the repository suite in the isolated worktree**

Run: `npm test`

Expected: all worktree tests pass. At the repository root, Vitest may discover sibling `.worktrees/**`; verify the feature in its isolated worktree before merging.

- [ ] **Step 4: Review scope**

Run: `git diff main...HEAD --name-only`

Expected: only portal UI, portal tests, the tenant portal spec, and this plan/spec documentation are listed; no dashboard file is changed.

- [ ] **Step 5: Merge locally after verification**

Merge the feature branch into local `main`, rerun the focused portal test command on `main`, then remove the owned worktree and delete the merged feature branch.
