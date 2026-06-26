<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingPeriodSummary } from '~/types/billing'
import { BILLING_PERIOD_STATUSES } from '~/utils/constants/billing'
import { formatCurrency } from '~/utils/format/currency'
import { billingWorkspacePath } from '~/utils/routes/operational'

definePageMeta({ title: 'Vận hành tháng' })

const route = useRoute()
const router = useRouter()
const now = new Date()

const initialBuilding = typeof route.query.building === 'string' ? route.query.building : undefined
const initialYear = typeof route.query.year === 'string' ? Number(route.query.year) : now.getFullYear()
const initialStatus = typeof route.query.status === 'string' ? route.query.status : undefined

const { buildings, isLoading: buildingsLoading } = useBuildingList()
const { filters, periods, isLoading, refresh, openPeriod } = useBillingPeriodList({
  building_id: initialBuilding,
  period_year: initialYear,
  status: initialStatus as BillingPeriodSummary['period']['status'] | undefined,
})

const debtFilter = ref<'all' | 'has_debt'>('all')
watch(debtFilter, (value) => {
  filters.has_debt = value === 'has_debt' ? true : undefined
})

const buildingOptions = computed(() => [
  { value: '', label: '— Tất cả tòa nhà —' },
  ...buildings.value.map(b => ({ value: b.id, label: b.name })),
])
const yearOptions = computed(() => {
  const y = now.getFullYear()
  return [y - 1, y, y + 1].map(yy => ({ value: yy, label: String(yy) }))
})
const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }))
const statusOptions = computed(() => [
  { value: '', label: '— Tất cả trạng thái —' },
  ...BILLING_PERIOD_STATUSES.map(s => ({ value: s, label: statusLabel(s) })),
])
const debtOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'has_debt', label: 'Có công nợ' },
]

function statusLabel(s: string) {
  switch (s) {
    case 'draft': return 'Nháp'
    case 'readings': return 'Nhập chỉ số'
    case 'review': return 'Soát hoá đơn'
    case 'issued': return 'Đã phát hành'
    case 'collecting': return 'Đang thu'
    case 'closed': return 'Đã chốt'
    default: return s
  }
}

const queueGroups = computed(() => {
  const list = periods.value
  const needsReadings = list.filter(p =>
    p.period.status === 'draft' || p.period.status === 'readings'
    || (p.readingRequiredCount > 0 && p.readingCompleteCount < p.readingRequiredCount),
  )
  const readyToReview = list.filter(p => p.period.status === 'review')
  const issuedCollecting = list.filter(p => p.period.status === 'issued' || p.period.status === 'collecting')
  const hasDebt = list.filter(p => p.outstandingBalance > 0)
  const closed = list.filter(p => p.period.status === 'closed')
  return { needsReadings, readyToReview, issuedCollecting, hasDebt, closed }
})

const queueMetrics = computed(() => [
  { label: 'Cần nhập chỉ số', value: queueGroups.value.needsReadings.length, tone: 'warning' as const },
  { label: 'Soát chờ phát hành', value: queueGroups.value.readyToReview.length, tone: 'accent' as const },
  { label: 'Đang thu', value: queueGroups.value.issuedCollecting.length, tone: 'default' as const },
  { label: 'Còn công nợ', value: queueGroups.value.hasDebt.length, tone: 'danger' as const },
  { label: 'Đã chốt', value: queueGroups.value.closed.length, tone: 'success' as const },
])

const columns: UiTableColumn<BillingPeriodSummary>[] = [
  { key: 'building', label: 'Tòa nhà' },
  { key: 'period', label: 'Kỳ', width: 'w-24' },
  { key: 'status', label: 'Trạng thái', width: 'w-32' },
  { key: 'reading', label: 'Chỉ số', numeric: true, hideOnMobile: true },
  { key: 'invoiceCount', label: 'Hoá đơn', numeric: true, hideOnMobile: true },
  { key: 'issuedTotal', label: 'Phát hành', numeric: true, hideOnMobile: true },
  { key: 'paidTotal', label: 'Đã thu', numeric: true, hideOnMobile: true },
  { key: 'outstanding', label: 'Công nợ', numeric: true },
  { key: 'open', label: '', action: true, width: 'w-28' },
]

const showOpenModal = ref(false)
const openForm = reactive({
  building_id: '',
  period_year: now.getFullYear(),
  period_month: now.getMonth() + 1,
})
const openSubmitting = ref(false)
const openError = ref<string | null>(null)

function startOpenPeriod() {
  openForm.building_id = filters.building_id ?? ''
  openForm.period_year = filters.period_year ?? now.getFullYear()
  openForm.period_month = filters.period_month ?? now.getMonth() + 1
  openError.value = null
  showOpenModal.value = true
}

async function submitOpenPeriod() {
  if (!openForm.building_id) {
    openError.value = 'Vui lòng chọn tòa nhà'
    return
  }
  openSubmitting.value = true
  openError.value = null
  try {
    const period = await openPeriod({
      building_id: openForm.building_id,
      period_year: openForm.period_year,
      period_month: openForm.period_month,
    })
    showOpenModal.value = false
    const building = buildings.value.find(b => b.id === period.buildingId)
    await navigateTo(billingWorkspacePath(building ?? { id: period.buildingId }, period.periodYear, period.periodMonth))
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } }; statusMessage?: string }
    openError.value = e.data?.error?.message ?? e.statusMessage ?? 'Không thể mở kỳ vận hành'
  } finally {
    openSubmitting.value = false
  }
}

function gotoWorkspace(row: BillingPeriodSummary) {
  router.push(billingWorkspacePath(
    { id: row.buildingId, slug: row.buildingSlug, name: row.buildingName },
    row.period.periodYear,
    row.period.periodMonth,
  ))
}

function readingProgress(row: BillingPeriodSummary): string {
  if (row.readingRequiredCount === 0) return '—'
  return `${row.readingCompleteCount}/${row.readingRequiredCount}`
}

function periodLabel(row: BillingPeriodSummary): string {
  return `${String(row.period.periodMonth).padStart(2, '0')}/${row.period.periodYear}`
}
</script>

<template>
  <div class="space-y-5">
    <UiPageHeader
      title="Vận hành tháng"
      description="Danh sách các kỳ thanh toán theo tòa nhà — nhập chỉ số, soát phí, phát hành hóa đơn, thu tiền và chốt kỳ."
    >
      <template #actions>
        <UiButton @click="startOpenPeriod">+ Mở kỳ mới</UiButton>
      </template>
    </UiPageHeader>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <UiMetric
        v-for="m in queueMetrics"
        :key="m.label"
        :label="m.label"
        :value="m.value"
        :tone="m.tone"
        :loading="isLoading"
      />
    </div>

    <UiToolbar>
      <UiSelect
        v-model="filters.building_id"
        :options="buildingOptions"
        :disabled="buildingsLoading"
        class="w-48"
      />
      <UiSelect v-model="filters.period_year" :options="yearOptions" class="w-28" />
      <UiSelect v-model="filters.status" :options="statusOptions" class="w-44" />
      <UiSelect v-model="debtFilter" :options="debtOptions" class="w-36" />
      <template #actions>
        <UiButton variant="secondary" @click="refresh()">Làm mới</UiButton>
      </template>
    </UiToolbar>

    <UiTable
      :rows="periods"
      :columns="columns"
      :loading="isLoading"
      empty-title="Chưa có kỳ vận hành nào"
      empty-description="Mở kỳ mới cho tòa nhà cần xử lý."
      row-clickable
      @row-click="gotoWorkspace"
    >
      <template #cell-building="{ row }">
        <span class="text-white">{{ row.buildingName ?? '—' }}</span>
      </template>
      <template #cell-period="{ row }">
        <span class="tabular-nums">{{ periodLabel(row) }}</span>
      </template>
      <template #cell-status="{ row }">
        <UiStatusBadge :status="row.period.status" context="period" />
      </template>
      <template #cell-reading="{ row }">{{ readingProgress(row) }}</template>
      <template #cell-invoiceCount="{ row }">{{ row.invoiceCount }}</template>
      <template #cell-issuedTotal="{ row }">{{ formatCurrency(row.issuedTotal) }}</template>
      <template #cell-paidTotal="{ row }">{{ formatCurrency(row.paidTotal) }}</template>
      <template #cell-outstanding="{ row }">
        <span :class="row.outstandingBalance > 0 ? 'text-error-vivid' : ''">
          {{ formatCurrency(row.outstandingBalance) }}
        </span>
      </template>
      <template #cell-open="{ row }">
        <UiButton size="sm" variant="secondary" @click.stop="gotoWorkspace(row)">Mở</UiButton>
      </template>
    </UiTable>

    <UiModal :open="showOpenModal" title="Mở kỳ vận hành" @close="showOpenModal = false">
      <div class="space-y-3">
        <UiSection title="Tòa nhà">
          <UiSelect
            v-model="openForm.building_id"
            :options="buildings.map(b => ({ value: b.id, label: b.name }))"
            placeholder="— Chọn tòa nhà —"
            :disabled="buildingsLoading"
            class="w-full"
          />
        </UiSection>
        <div class="grid grid-cols-2 gap-3">
          <UiSection title="Tháng">
            <UiSelect v-model="openForm.period_month" :options="monthOptions" class="w-full" />
          </UiSection>
          <UiSection title="Năm">
            <UiSelect v-model="openForm.period_year" :options="yearOptions" class="w-full" />
          </UiSection>
        </div>
        <UiAlert v-if="openError" severity="danger">{{ openError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="openSubmitting" @click="showOpenModal = false">Huỷ</UiButton>
        <UiButton :loading="openSubmitting" @click="submitOpenPeriod">Mở kỳ</UiButton>
      </template>
    </UiModal>
  </div>
</template>
