# Portal Monthly Invoice Bar Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tenant portal financial overview’s dual-line chart with one vertical bar per month showing that month’s total invoice amount.

**Architecture:** Keep the existing `buildPortalFinancialOverview()` data derivation, portal chart-theme adapter, home layout, and insight cards. Change only `PortalSpendingChart` from the `vue-chartjs` `Line` renderer to `Bar`, then update the accepted tenant-portal behavior to describe the single monthly-total series.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, Chart.js, vue-chartjs, TailwindCSS, Vitest, Vue Test Utils, OpenSpec.

## Global Constraints

- Apply the change only to the tenant portal; do not modify dashboard charts.
- Render one vertical bar per displayed invoice period using `TenantInvoiceListItem.totalAmount`.
- Keep at most six chronological periods through the existing `buildPortalFinancialOverview(invoices, limit)` contract.
- Preserve the `PortalSpendingChart` props: `invoices`, optional `limit`, and optional `height`.
- Preserve `Bình quân mỗi tháng`, `Tỷ lệ đã thanh toán`, the client-only fallback, empty state, text alternative, light/dark theme behavior, and reduced-motion behavior.
- Use only existing `--portal-*` variables through `usePortalChartTheme()`; do not add colors, tokens, fonts, radii, shadows, primitives, APIs, DTOs, or dependencies.

---

### Task 1: Convert `PortalSpendingChart` to a single monthly-total bar series

**Files:**
- Modify: `tests/components/portal/PortalSpendingChart.spec.ts`
- Modify: `app/components/portal/PortalSpendingChart.vue`

**Interfaces:**
- Consumes: `buildPortalFinancialOverview(props.invoices, props.limit ?? 6)` and `usePortalChartTheme()`.
- Preserves:

```ts
defineProps<{
  invoices: TenantInvoiceListItem[]
  limit?: number
  height?: number
}>()
```

- Produces: one Chart.js `bar` dataset labeled `Tổng hóa đơn theo tháng`, sourced from `overview.totalAmounts`.

- [ ] **Step 1: Replace the component test with the failing bar-chart contract**

Replace `tests/components/portal/PortalSpendingChart.spec.ts` with:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'
import PortalSpendingChart from '~/components/portal/PortalSpendingChart.vue'

const source = readFileSync(
  resolve('app/components/portal/PortalSpendingChart.vue'),
  'utf8',
)

vi.mock('vue-chartjs', () => ({
  Bar: defineComponent({
    props: ['data', 'options'],
    setup(props) {
      return () => h('div', {
        'data-test': 'bar',
        'data-datasets': JSON.stringify(props.data?.datasets ?? []),
        'data-animation-duration': String(props.options?.animation?.duration ?? ''),
      })
    },
  }),
}))

function invoice(
  month: number,
  totalAmount: number,
  paidAmount: number,
): TenantInvoiceListItem {
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

function mountChart(invoices: TenantInvoiceListItem[]) {
  return mount(PortalSpendingChart, {
    props: { invoices },
    global: {
      stubs: {
        ClientOnly: defineComponent({
          setup(_, { slots }) {
            return () => slots.default?.()
          },
        }),
      },
    },
  })
}

describe('PortalSpendingChart', () => {
  it('renders one monthly invoice-total bar series with a text alternative', () => {
    const wrapper = mountChart([
      invoice(3, 4_000_000, 3_000_000),
      invoice(2, 3_500_000, 3_500_000),
    ])
    const datasets = JSON.parse(
      wrapper.get('[data-test="bar"]').attributes('data-datasets') ?? '[]',
    )

    expect(datasets).toHaveLength(1)
    expect(datasets[0]).toMatchObject({
      label: 'Tổng hóa đơn theo tháng',
      data: [3_500_000, 4_000_000],
      borderRadius: 6,
      borderSkipped: 'bottom',
      maxBarThickness: 28,
    })
    expect(wrapper.text()).toContain('Tổng hóa đơn theo tháng')
    expect(wrapper.text()).not.toContain('Đã thanh toán')
    expect(wrapper.get('[data-test="chart-summary"]').text())
      .toContain('02/26 đến 03/26')
    expect(wrapper.get('[data-test="chart-summary"]').text())
      .toContain('tổng tiền hóa đơn của từng tháng')
  })

  it('keeps the empty state when invoice data is unavailable', () => {
    const wrapper = mountChart([])

    expect(wrapper.text()).toContain('Chưa có dữ liệu')
    expect(wrapper.find('[data-test="bar"]').exists()).toBe(false)
  })

  it('uses the active portal accent token for the monthly-total legend', () => {
    expect(source).toContain('bg-theme')
    expect(source).not.toContain('border-[color:var(--portal-positive)]')
  })
})
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
npx vitest run tests/components/portal/PortalSpendingChart.spec.ts
```

Expected: FAIL because the component imports `Line`, the mocked module exposes only `Bar`, and the existing dataset still contains total and paid line series.

- [ ] **Step 3: Replace the chart implementation with the minimal bar version**

Replace `app/components/portal/PortalSpendingChart.vue` with:

```vue
<script setup lang="ts">
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import '~/utils/chart-registration'
import { Bar } from 'vue-chartjs'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'
import { usePortalChartTheme } from '~/composables/tenant-portal/usePortalChartTheme'
import { formatCurrency, formatCurrencyCompact } from '~/utils/format/currency'
import { buildPortalFinancialOverview } from '~/utils/tenant-portal/financial-overview'

const props = defineProps<{
  invoices: TenantInvoiceListItem[]
  /** How many recent periods to show (default 6) */
  limit?: number
  /** Chart canvas height in pixels (default 144) */
  height?: number
}>()

const overview = computed(() =>
  buildPortalFinancialOverview(props.invoices, props.limit ?? 6),
)
const { palette, animationDuration } = usePortalChartTheme()

const hasData = computed(() => overview.value.invoices.length > 0)

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: overview.value.labels,
  datasets: [
    {
      label: 'Tổng hóa đơn theo tháng',
      data: overview.value.totalAmounts,
      backgroundColor: palette.value.accent,
      borderColor: palette.value.accent,
      borderWidth: 0,
      borderRadius: 6,
      borderSkipped: 'bottom',
      maxBarThickness: 28,
    },
  ],
}))

const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: animationDuration.value },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: palette.value.surfaceDeep,
      titleColor: palette.value.title,
      bodyColor: palette.value.body,
      borderColor: palette.value.border,
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx: TooltipItem<'bar'>) =>
          `${ctx.dataset.label}: ${formatCurrency(Number(ctx.parsed.y))}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: palette.value.muted, font: { size: 11 } },
      border: { color: palette.value.border },
    },
    y: {
      beginAtZero: true,
      grid: { color: palette.value.border },
      ticks: {
        color: palette.value.muted,
        font: { size: 11 },
        maxTicksLimit: 4,
        callback: (value: number | string) => formatCurrencyCompact(Number(value)),
      },
      border: { display: false },
    },
  },
}))

const heightPx = computed(() => `${props.height ?? 144}px`)
const chartSummary = computed(() => {
  const first = overview.value.labels[0]
  const last = overview.value.labels.at(-1)
  if (!first || !last) return ''

  return `${first} đến ${last}: các cột thể hiện tổng tiền hóa đơn của từng tháng.`
})
</script>

<template>
  <ClientOnly>
    <div v-if="hasData" class="w-full">
      <div aria-hidden="true" :style="{ height: heightPx }">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
      <div class="mt-3 flex items-center border-t border-border-light pt-3">
        <span class="portal-type-caption inline-flex items-center gap-2 text-body">
          <span class="h-3 w-2 rounded-t bg-theme" aria-hidden="true" />
          Tổng hóa đơn theo tháng
        </span>
      </div>
      <p data-test="chart-summary" class="sr-only">{{ chartSummary }}</p>
    </div>
    <p v-else class="portal-type-caption py-4 text-center text-body">Chưa có dữ liệu</p>
    <template #fallback>
      <div class="w-full animate-pulse rounded-xl bg-border-light/50" :style="{ height: heightPx }" />
    </template>
  </ClientOnly>
</template>
```

- [ ] **Step 4: Run component and showcase tests and verify GREEN**

Run:

```bash
npx vitest run tests/components/portal/PortalSpendingChart.spec.ts tests/pages/portal-ui-showcase.spec.ts tests/composables/usePortalChartTheme.test.ts
```

Expected: 3 test files pass; the chart test reports 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/portal/PortalSpendingChart.vue tests/components/portal/PortalSpendingChart.spec.ts
git commit -m "feat(portal): show monthly invoice bar chart"
```

### Task 2: Align accepted tenant-portal behavior

**Files:**
- Modify: `tests/pages/portal-home-ui.spec.ts`
- Modify: `openspec/specs/tenant-portal-ui/spec.md`

**Interfaces:**
- Consumes: the existing `Tenant financial overview` OpenSpec requirement.
- Produces: an accepted requirement that describes one monthly total bar per displayed period while preserving both insight cards and theme/motion behavior.

- [ ] **Step 1: Add the failing accepted-spec assertions**

Replace the final test in `tests/pages/portal-home-ui.spec.ts` with:

```ts
it('records the monthly invoice bar behavior in the accepted portal spec', () => {
  expect(spec).toContain('### Requirement: Tenant financial overview')
  expect(spec).toContain('up to the six newest invoice periods in chronological order')
  expect(spec).toContain(
    'the chart displays each period’s total invoice value as one vertical bar',
  )
  expect(spec).not.toContain('distinguishes total invoice value from paid value')
  expect(spec).toContain('chart animation is disabled')
})
```

- [ ] **Step 2: Run the page test and verify RED**

Run:

```bash
npx vitest run tests/pages/portal-home-ui.spec.ts
```

Expected: FAIL because the accepted spec still requires distinct total and paid chart series.

- [ ] **Step 3: Update the exact OpenSpec scenario**

Replace:

```md
- **AND** the chart distinguishes total invoice value from paid value
```

with:

```md
- **AND** the chart displays each period’s total invoice value as one vertical bar
```

Keep the chronological-period, average-monthly, paid-ratio, active-theme, reduced-motion, and insufficient-history clauses unchanged.

- [ ] **Step 4: Run focused tests and OpenSpec validation**

Run:

```bash
npx vitest run tests/components/portal/PortalSpendingChart.spec.ts tests/pages/portal-home-ui.spec.ts tests/pages/portal-ui-showcase.spec.ts tests/utils/portal-financial-overview.test.ts tests/composables/usePortalChartTheme.test.ts
openspec validate --specs
```

Expected: 5 focused test files pass and OpenSpec reports `89 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add tests/pages/portal-home-ui.spec.ts openspec/specs/tenant-portal-ui/spec.md
git commit -m "docs(portal): specify monthly invoice bars"
```

### Task 3: Final verification and local integration

**Files:**
- Verify only.

**Interfaces:**
- Consumes: Tasks 1–2 on the isolated feature branch.
- Produces: a verified local `main` containing the portal-only bar chart change.

- [ ] **Step 1: Run portal regression tests**

Run:

```bash
npx vitest run tests/components/portal tests/composables/usePortalTheme.test.ts tests/composables/usePortalChartTheme.test.ts tests/pages/portal-home-ui.spec.ts tests/pages/portal-ui-showcase.spec.ts tests/utils/portal-financial-overview.test.ts
```

Expected: all selected portal tests pass in the isolated worktree.

- [ ] **Step 2: Run static and spec checks**

Run:

```bash
npm run typecheck
npm run lint
openspec validate --specs
git diff --check
```

Expected: every command exits `0`; OpenSpec reports `89 passed, 0 failed`.

- [ ] **Step 3: Run the full repository suite**

Run:

```bash
npm test
```

Expected: all repository tests pass in the isolated worktree.

- [ ] **Step 4: Inspect the rendered portal when browser tooling is available**

Use an already-running local portal runtime when available. If no runtime is
running, ask for explicit approval before starting one. Inspect `/portal` in
both light and dark mode at `320`, `375`, `414`, and `768` CSS pixels.

Verify:

- six bars and X-axis labels remain legible without horizontal overflow;
- the single legend reads `Tổng hóa đơn theo tháng`;
- the two insight cards remain unchanged and do not clip;
- the chart colors change with the portal theme;
- reduced-motion removes Chart.js animation.

If the browser backend is unavailable, record that limitation and rely on the
component, theme, responsive source-contract, and reduced-motion tests rather
than substituting an unrelated browser tool.

- [ ] **Step 5: Review scope**

Run:

```bash
git diff main...HEAD --name-only
```

Expected files:

```text
app/components/portal/PortalSpendingChart.vue
openspec/specs/tenant-portal-ui/spec.md
tests/components/portal/PortalSpendingChart.spec.ts
tests/pages/portal-home-ui.spec.ts
```

No dashboard, API, token, theme, utility, page-layout, or design-system file may appear.

- [ ] **Step 6: Merge locally and re-verify**

Merge the feature branch into local `main`, then run:

```bash
npx vitest run --exclude '.worktrees/**' tests/components/portal/PortalSpendingChart.spec.ts tests/pages/portal-home-ui.spec.ts tests/pages/portal-ui-showcase.spec.ts tests/composables/usePortalChartTheme.test.ts
npm test -- --exclude '.worktrees/**'
git status --short
```

Expected: focused tests and the full main suite pass, and `git status --short` prints no output. Remove the owned worktree and delete the merged feature branch only after those checks pass.
