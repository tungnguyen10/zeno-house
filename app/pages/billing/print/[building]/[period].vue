<script setup lang="ts">
import BillingPrintCard from '~/components/billing/BillingPrintCard.vue'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({ title: 'In phiếu thu', layout: false })

const route = useRoute()
const router = useRouter()

const buildingParam = String(route.params.building ?? '')
const periodToken = String(route.params.period ?? '')
const keysParam = String(route.query.keys ?? '')

const [yearStr, monthStr] = periodToken.split('-')
const periodYear = Number(yearStr)
const periodMonth = Number(monthStr)

if (!buildingParam || !Number.isFinite(periodYear) || !Number.isFinite(periodMonth) || periodMonth < 1 || periodMonth > 12) {
  throw createError({ statusCode: 404, statusMessage: 'Kỳ vận hành không hợp lệ' })
}

const selectedKeys = computed(() => keysParam.split(',').map(k => k.trim()).filter(Boolean))

const periodId = ref<string>('')
const resolveError = ref<string | null>(null)

async function resolvePeriod() {
  try {
    const resp = await $fetch<{ data: { id: string } }>('/api/billing/periods', {
      method: 'POST',
      body: { building_id: buildingParam, period_year: periodYear, period_month: periodMonth },
    })
    periodId.value = resp.data.id
  }
  catch (err) {
    resolveError.value = getApiErrorMessage(err, 'Không thể tải kỳ vận hành')
  }
}

const workspace = useBillingPeriodWorkspace(periodId)
const { period, overview, grid, gridLoading, loadGrid, loadOverview } = workspace

onMounted(async () => {
  await resolvePeriod()
  if (periodId.value) {
    await Promise.all([loadOverview(), loadGrid()])
  }
})

const buildingName = computed(() => overview.value?.buildingName ?? null)

const rows = computed(() => {
  if (!grid.value) return []
  const all = grid.value.rows.filter(r => r.rowType === 'billable_contract' && r.lines.length > 0)
  if (selectedKeys.value.length === 0) return all
  const keys = new Set(selectedKeys.value)
  return all.filter(r => keys.has(r.key))
})

const periodLabel = computed(() => {
  if (!period.value) return periodToken
  return `${String(period.value.periodMonth).padStart(2, '0')}/${period.value.periodYear}`
})

function triggerPrint() {
  const invoiceIds = rows.value
    .map(r => r.invoiceId)
    .filter((id): id is string => Boolean(id))
  if (periodId.value && invoiceIds.length > 0) {
    // Fire-and-forget audit ping; never block printing on it.
    $fetch(`/api/billing/periods/${periodId.value}/invoices-printed`, {
      method: 'POST',
      body: { invoice_ids: invoiceIds },
    }).catch(() => {})
  }
  window.print()
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push(`/billing/${buildingParam}/${periodToken}`)
}
</script>

<template>
  <div class="print-shell">
    <header class="print-toolbar no-print">
      <div class="print-toolbar-meta">
        <p class="print-toolbar-eyebrow">Kỳ {{ periodLabel }} · {{ buildingName ?? buildingParam }}</p>
        <h1 class="print-toolbar-title">{{ rows.length }} phiếu sẵn sàng in</h1>
      </div>
      <div class="print-toolbar-actions">
        <UiButton unstyled class="btn-ghost" @click="goBack">Đóng</UiButton>
        <UiButton unstyled class="btn-primary" :disabled="rows.length === 0" @click="triggerPrint">In ngay</UiButton>
      </div>
    </header>

    <div v-if="resolveError" class="print-state print-state--error">
      <p>{{ resolveError }}</p>
    </div>

    <div v-else-if="gridLoading && rows.length === 0" class="print-state">
      <p>Đang tải dữ liệu...</p>
    </div>

    <div v-else-if="rows.length === 0" class="print-state">
      <p>Không có phiếu nào để in.</p>
    </div>

    <main v-else class="print-sheet">
      <BillingPrintCard
        v-for="row in rows"
        :key="row.key"
        :row="row"
        :period="period"
        :building-name="buildingName"
      />
    </main>
  </div>
</template>

<style scoped>
.print-shell {
  min-height: 100vh;
  background: #2C2C2E;
  color: #fff;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

.print-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: #1c1c1e;
  border-bottom: 1px solid #2C2C2E;
}

.print-toolbar-meta {
  min-width: 0;
}

.print-toolbar-eyebrow {
  margin: 0;
  font-size: 11px;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.print-toolbar-title {
  margin: 2px 0 0 0;
  font-size: 16px;
  font-weight: 600;
}

.print-toolbar-actions {
  display: flex;
  gap: 8px;
}

.btn-ghost,
.btn-primary {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms;
  border: 1px solid transparent;
}

.btn-ghost {
  background: transparent;
  color: #d1d5db;
  border-color: #3a3a3c;
}

.btn-ghost:hover {
  background: #2c2c2e;
}

.btn-primary {
  background: #06b6d4;
  color: #001017;
}

.btn-primary:hover:not(:disabled) {
  background: #0891b2;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.print-state {
  padding: 64px 24px;
  text-align: center;
  color: #9ca3af;
}

.print-state--error {
  color: #fca5a5;
}

.print-sheet {
  width: 210mm;
  margin: 24px auto;
  padding: 12mm;
  background: white;
  color: #111;
  display: flex;
  flex-direction: column;
  gap: 6mm;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

@media print {
  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  .no-print {
    display: none !important;
  }

  .print-shell {
    background: white;
    min-height: auto;
  }

  .print-sheet {
    width: auto;
    margin: 0;
    padding: 0;
    box-shadow: none;
    gap: 6mm;
  }

  .print-sheet > :nth-child(2n) {
    page-break-after: always;
  }

  .print-sheet > * {
    page-break-inside: avoid;
  }
}
</style>
