<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingPeriodSummary } from '~/types/billing'
import { BILLING_PERIOD_STATUSES } from '~/utils/constants/billing'
import { formatCurrency } from '~/utils/format/currency'
import { billingWorkspacePath } from '~/utils/routes/operational'
import { getApiErrorMessage } from '~/utils/api-error'
import { formatPeriodString, parsePeriodString } from '~/utils/format/period'

definePageMeta({ title: 'Vận hành tháng' })

type BillingPeriodStatus = BillingPeriodSummary['period']['status']

const route = useRoute()
const router = useRouter()
const now = new Date()
const initialYear = now.getFullYear()

const initialBuilding = typeof route.query.building === 'string' ? route.query.building : undefined
const initialYearParam = typeof route.query.year === 'string' ? Number(route.query.year) : initialYear
const initialStatus = typeof route.query.status === 'string' ? route.query.status : undefined

const { buildings, isLoading: buildingsLoading } = useBuildingList()
const { filters, periods, isLoading, refresh, openPeriod } = useBillingPeriodList({
  building_id: initialBuilding,
  period_year: initialYearParam,
  status: initialStatus as BillingPeriodStatus | undefined,
})

const buildingFilter = computed<string | number | null>({
  get: () => filters.building_id ?? '',
  set: (value) => { filters.building_id = typeof value === 'string' && value ? value : undefined },
})

const statusFilter = computed<string | number | null>({
  get: () => filters.status ?? '',
  set: (value) => {
    filters.status = (typeof value === 'string' && value ? value : undefined) as BillingPeriodStatus | undefined
  },
})

const { yearOptions } = usePeriodOptions({
  selectedYear: computed(() => filters.period_year),
})

function statusLabel(status: string) {
  switch (status) {
    case 'draft': return 'Nháp'
    case 'readings': return 'Nhập chỉ số'
    case 'review': return 'Soát hoá đơn'
    case 'issued': return 'Đã phát hành'
    case 'collecting': return 'Đang thu'
    case 'closed': return 'Đã chốt'
    default: return status
  }
}

type QueueKey = 'needsReadings' | 'readyToReview' | 'issuedCollecting' | 'hasDebt' | 'closed'

const queueGroups = computed(() => {
  const groups: Record<QueueKey, BillingPeriodSummary[]> = {
    needsReadings: [],
    readyToReview: [],
    issuedCollecting: [],
    hasDebt: [],
    closed: [],
  }

  for (const period of periods.value) {
    const status = period.period.status
    if (status === 'draft' || status === 'readings' || (period.readingRequiredCount > 0 && period.readingCompleteCount < period.readingRequiredCount)) {
      groups.needsReadings.push(period)
    }
    if (status === 'review') groups.readyToReview.push(period)
    if (status === 'issued' || status === 'collecting') groups.issuedCollecting.push(period)
    if (period.outstandingBalance > 0) groups.hasDebt.push(period)
    if (status === 'closed') groups.closed.push(period)
  }

  return groups
})

const queueMetrics = computed<Array<{ key: QueueKey; label: string; shortLabel: string; value: number; tone: 'warning' | 'accent' | 'default' | 'danger' | 'success' }>>(() => [
  { key: 'needsReadings', label: 'Cần nhập chỉ số', shortLabel: 'Nhập chỉ số', value: queueGroups.value.needsReadings.length, tone: 'warning' },
  { key: 'readyToReview', label: 'Soát chờ phát hành', shortLabel: 'Chờ phát hành', value: queueGroups.value.readyToReview.length, tone: 'accent' },
  { key: 'issuedCollecting', label: 'Đang thu', shortLabel: 'Đang thu', value: queueGroups.value.issuedCollecting.length, tone: 'default' },
  { key: 'hasDebt', label: 'Còn công nợ', shortLabel: 'Công nợ', value: queueGroups.value.hasDebt.length, tone: 'danger' },
  { key: 'closed', label: 'Đã chốt', shortLabel: 'Đã chốt', value: queueGroups.value.closed.length, tone: 'success' },
])

const activeQueue = ref<QueueKey | null>(null)
const actionMenuOpen = ref(false)

function toggleQueue(key: QueueKey) {
  activeQueue.value = activeQueue.value === key ? null : key
}

const displayedPeriods = computed(() => {
  if (!activeQueue.value) return periods.value
  return queueGroups.value[activeQueue.value]
})

const activeQueueLabel = computed(() =>
  activeQueue.value ? queueMetrics.value.find(metric => metric.key === activeQueue.value)?.label : null,
)

const buildingFilterOptions = computed(() =>
  buildings.value.map(building => ({ value: building.id, label: building.name })),
)

const billingStatusOptions = computed(() =>
  BILLING_PERIOD_STATUSES.map(status => ({ value: status, label: statusLabel(status) })),
)

const hasActiveFilters = computed(() =>
  !!filters.building_id
  || !!filters.status
  || !!filters.has_debt
  || filters.period_year !== initialYear
  || activeQueue.value !== null,
)

function clearFilters() {
  filters.building_id = undefined
  filters.status = undefined
  filters.has_debt = undefined
  filters.period_year = initialYear
  activeQueue.value = null
}

const queueChipTone: Record<'warning' | 'accent' | 'default' | 'danger' | 'success', { value: string; ring: string; dot: string }> = {
  warning: { value: 'text-warning', ring: 'ring-warning/40 border-warning/60', dot: 'bg-warning' },
  accent: { value: 'text-cyan', ring: 'ring-cyan/40 border-cyan/60', dot: 'bg-cyan' },
  default: { value: 'text-white', ring: 'ring-white/20 border-white/30', dot: 'bg-white/60' },
  danger: { value: 'text-error-vivid', ring: 'ring-error/40 border-error/60', dot: 'bg-error-vivid' },
  success: { value: 'text-success-neon', ring: 'ring-success-neon/40 border-success-neon/60', dot: 'bg-success-neon' },
}

const columns: UiTableColumn<BillingPeriodSummary>[] = [
  { key: 'building', label: 'Tòa nhà' },
  { key: 'period', label: 'Kỳ', width: 'w-20' },
  { key: 'status', label: 'Trạng thái', width: 'w-32' },
  { key: 'reading', label: 'Chỉ số', numeric: true, hideOnMobile: true, width: 'w-20' },
  { key: 'invoiceCount', label: 'Hoá đơn', numeric: true, hideOnMobile: true, width: 'w-20' },
  { key: 'collection', label: 'Tiến độ thu', hideOnMobile: true, width: 'w-56' },
  { key: 'outstanding', label: 'Công nợ', numeric: true, width: 'w-32' },
  { key: 'open', label: '', action: true, width: 'w-8' },
]

function collectionRatio(row: BillingPeriodSummary): number {
  if (row.issuedTotal <= 0) return 0
  return Math.max(0, Math.min(1, row.paidTotal / row.issuedTotal))
}

function isClosed(row: BillingPeriodSummary): boolean {
  return row.period.status === 'closed'
}

const showOpenModal = ref(false)
const openForm = reactive({
  building_id: '',
  period: formatPeriodString(now.getFullYear(), now.getMonth() + 1),
})
const openSubmitting = ref(false)
const openError = ref<string | null>(null)

function startOpenPeriod() {
  actionMenuOpen.value = false
  openForm.building_id = filters.building_id ?? ''
  const year = filters.period_year ?? now.getFullYear()
  const month = filters.period_month ?? now.getMonth() + 1
  openForm.period = formatPeriodString(year, month)
  openError.value = null
  showOpenModal.value = true
}

async function submitOpenPeriod() {
  if (!openForm.building_id) {
    openError.value = 'Vui lòng chọn tòa nhà'
    return
  }
  const parsed = parsePeriodString(openForm.period)
  if (!parsed) {
    openError.value = 'Vui lòng chọn kỳ vận hành'
    return
  }
  openSubmitting.value = true
  openError.value = null
  try {
    const period = await openPeriod({
      building_id: openForm.building_id,
      period_year: parsed.year,
      period_month: parsed.month,
    })
    showOpenModal.value = false
    const building = buildings.value.find(item => item.id === period.buildingId)
    await navigateTo(billingWorkspacePath(building ?? { id: period.buildingId }, period.periodYear, period.periodMonth))
  }
  catch (err) {
    openError.value = getApiErrorMessage(err, 'Không thể mở kỳ vận hành')
  }
  finally {
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
        <div class="relative">
          <UiButton
            variant="ghost"
            size="sm"
            @click="actionMenuOpen = !actionMenuOpen"
          >
            <span>Hành động</span>
            <IconChevronDown class="h-4 w-4 -mr-1" aria-hidden="true" />
          </UiButton>
          <template v-if="actionMenuOpen">
            <div
              class="fixed inset-0 z-30"
              aria-hidden="true"
              @click="actionMenuOpen = false"
            />
            <div
              class="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-dark-border bg-dark-card py-1 shadow-lg shadow-black/40"
            >
              <UiButton
                variant="ghost"
                size="sm"
                class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-white hover:!bg-dark-surface"
                @click="startOpenPeriod"
              >
                <IconPlus class="h-4 w-4" aria-hidden="true" />
                <span>Mở kỳ mới</span>
              </UiButton>
            </div>
          </template>
        </div>
      </template>
    </UiPageHeader>

    <div class="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 md:mx-0 md:grid md:grid-cols-5 md:px-0 md:pb-0">
      <UiButton
        v-for="metric in queueMetrics"
        :key="metric.key"
        unstyled
        :aria-pressed="activeQueue === metric.key"
        :class="[
          'group flex shrink-0 snap-start flex-col gap-1 rounded-xl border bg-dark-surface px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40 min-w-[10rem] md:min-w-0 md:shrink',
          activeQueue === metric.key
            ? `${queueChipTone[metric.tone].ring} ring-2`
            : 'border-dark-border hover:border-dark-hover hover:bg-dark-hover/40',
        ]"
        @click="toggleQueue(metric.key)"
      >
        <span class="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
          <span :class="['h-1.5 w-1.5 rounded-full shrink-0', queueChipTone[metric.tone].dot]" />
          <span class="whitespace-nowrap md:hidden">{{ metric.shortLabel }}</span>
          <span class="hidden whitespace-nowrap md:inline">{{ metric.label }}</span>
        </span>
        <UiSkeleton v-if="isLoading" class="h-7 w-12" />
        <span
          v-else
          :class="['text-2xl font-semibold tabular-nums leading-none', queueChipTone[metric.tone].value]"
        >
          {{ metric.value }}
        </span>
      </UiButton>
    </div>

    <BillingPeriodFilterBar
      :building-value="buildingFilter"
      :year-value="filters.period_year ?? initialYear"
      :status-value="statusFilter"
      :building-options="buildingFilterOptions"
      :year-options="yearOptions"
      :status-options="billingStatusOptions"
      :buildings-loading="buildingsLoading"
      :has-debt="!!filters.has_debt"
      :active-queue-label="activeQueueLabel"
      :has-active-filters="hasActiveFilters"
      :is-loading="isLoading"
      :period-count="displayedPeriods.length"
      @update:building-value="buildingFilter = $event"
      @update:year-value="filters.period_year = $event"
      @update:status-value="statusFilter = $event"
      @toggle-debt="filters.has_debt = filters.has_debt ? undefined : true"
      @clear-queue="activeQueue = null"
      @reset="clearFilters"
      @refresh="refresh()"
    />

    <div class="space-y-2 md:hidden">
      <template v-if="isLoading">
        <UiSkeleton v-for="n in 4" :key="`m-skel-${n}`" class="h-24 w-full rounded-xl" />
      </template>
      <UiEmptyState
        v-else-if="displayedPeriods.length === 0"
        title="Không có kỳ nào khớp bộ lọc"
        description="Bỏ filter hoặc mở kỳ mới cho tòa nhà cần xử lý."
      />
      <UiButton
        v-for="row in displayedPeriods"
        v-else
        :key="row.period.id"
        unstyled
        class="flex w-full flex-col gap-2 rounded-xl border border-dark-border bg-dark-surface p-3 text-left transition hover:bg-dark-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
        @click="gotoWorkspace(row)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p :class="['truncate text-sm', isClosed(row) ? 'text-muted' : 'font-medium text-white']">
              {{ row.buildingName ?? '—' }}
            </p>
            <p class="text-xs tabular-nums text-muted">Kỳ {{ periodLabel(row) }}</p>
          </div>
          <UiStatusBadge :status="row.period.status" context="period" />
        </div>

        <div v-if="row.issuedTotal > 0" class="flex flex-col gap-1">
          <div class="flex items-baseline justify-between gap-2 text-xs tabular-nums">
            <span :class="isClosed(row) ? 'text-muted' : 'text-white'">
              Đã thu {{ formatCurrency(row.paidTotal) }}
            </span>
            <span class="text-muted">/ {{ formatCurrency(row.issuedTotal) }}</span>
          </div>
          <div class="h-1 overflow-hidden rounded-full bg-dark-border">
            <div
              :class="[
                'h-full rounded-full transition-all',
                collectionRatio(row) >= 1
                  ? 'bg-success-neon'
                  : row.outstandingBalance > 0 && !isClosed(row)
                    ? 'bg-cyan'
                    : 'bg-muted/40',
              ]"
              :style="{ width: `${Math.max(2, collectionRatio(row) * 100)}%` }"
            />
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-3 text-muted">
            <span>Chỉ số <span class="text-white tabular-nums">{{ readingProgress(row) }}</span></span>
            <span>HĐ <span class="text-white tabular-nums">{{ row.invoiceCount }}</span></span>
          </div>
          <span
            v-if="row.outstandingBalance > 0"
            :class="['font-semibold tabular-nums', isClosed(row) ? 'text-muted' : 'text-error-vivid']"
          >
            Nợ {{ formatCurrency(row.outstandingBalance) }}
          </span>
        </div>
      </UiButton>
    </div>

    <UiTable
      class="hidden md:block"
      :rows="displayedPeriods"
      :columns="columns"
      :loading="isLoading"
      empty-title="Không có kỳ nào khớp bộ lọc"
      empty-description="Bỏ filter hoặc mở kỳ mới cho tòa nhà cần xử lý."
      row-clickable
      @row-click="gotoWorkspace"
    >
      <template #cell-building="{ row }">
        <span :class="isClosed(row) ? 'text-muted' : 'font-medium text-white'">
          {{ row.buildingName ?? '—' }}
        </span>
      </template>
      <template #cell-period="{ row }">
        <span :class="['tabular-nums', isClosed(row) ? 'text-muted' : 'text-white']">
          {{ periodLabel(row) }}
        </span>
      </template>
      <template #cell-status="{ row }">
        <UiStatusBadge :status="row.period.status" context="period" />
      </template>
      <template #cell-reading="{ row }">
        <span :class="isClosed(row) ? 'text-muted' : ''">{{ readingProgress(row) }}</span>
      </template>
      <template #cell-invoiceCount="{ row }">
        <span :class="isClosed(row) ? 'text-muted' : ''">{{ row.invoiceCount }}</span>
      </template>
      <template #cell-collection="{ row }">
        <div v-if="row.issuedTotal > 0" class="flex flex-col gap-1">
          <div class="flex items-baseline justify-between gap-2 text-xs tabular-nums">
            <span :class="isClosed(row) ? 'text-muted' : 'text-white'">
              {{ formatCurrency(row.paidTotal) }}
            </span>
            <span class="text-muted">/ {{ formatCurrency(row.issuedTotal) }}</span>
          </div>
          <div class="h-1 overflow-hidden rounded-full bg-dark-border">
            <div
              :class="[
                'h-full rounded-full transition-all',
                collectionRatio(row) >= 1
                  ? 'bg-success-neon'
                  : row.outstandingBalance > 0 && !isClosed(row)
                    ? 'bg-cyan'
                    : 'bg-muted/40',
              ]"
              :style="{ width: `${Math.max(2, collectionRatio(row) * 100)}%` }"
            />
          </div>
        </div>
        <span v-else class="text-xs text-muted">—</span>
      </template>
      <template #cell-outstanding="{ row }">
        <span
          v-if="row.outstandingBalance > 0"
          :class="['font-semibold', isClosed(row) ? 'text-muted' : 'text-error-vivid']"
        >
          {{ formatCurrency(row.outstandingBalance) }}
        </span>
        <span v-else class="text-muted">—</span>
      </template>
      <template #cell-open="{ row }">
        <UiButton
          variant="ghost"
          size="sm"
          icon-only
          :aria-label="`Mở kỳ ${periodLabel(row)} ${row.buildingName ?? ''}`"
          @click.stop="gotoWorkspace(row)"
        >
          <IconChevronRight class="h-4 w-4" />
        </UiButton>
      </template>
    </UiTable>

    <UiModal :open="showOpenModal" title="Mở kỳ vận hành" @close="showOpenModal = false">
      <div class="space-y-3">
        <UiSection title="Tòa nhà">
          <UiSelect
            v-model="openForm.building_id"
            :options="buildings.map(building => ({ value: building.id, label: building.name }))"
            placeholder="— Chọn tòa nhà —"
            :disabled="buildingsLoading"
            aria-label="Tòa nhà mở kỳ"
            class="w-full"
          />
        </UiSection>
        <UiDatePicker
          v-model="openForm.period"
          label="Kỳ vận hành"
          picker-mode="month"
          required
        />
        <UiAlert v-if="openError" severity="danger">{{ openError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="openSubmitting" @click="showOpenModal = false">Huỷ</UiButton>
        <UiButton :loading="openSubmitting" @click="submitOpenPeriod">Mở kỳ</UiButton>
      </template>
    </UiModal>
  </div>
</template>
