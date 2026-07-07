<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingPeriodSummary } from '~/types/billing'
import { BILLING_PERIOD_STATUSES } from '~/utils/constants/billing'
import { formatCurrency } from '~/utils/format/currency'
import { billingWorkspacePath } from '~/utils/routes/operational'

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

// v-model wrappers so empty selects map cleanly to `undefined` on the filter object.
const buildingFilter = computed<string | number | null>({
  get: () => filters.building_id ?? '',
  set: (v) => { filters.building_id = typeof v === 'string' && v ? v : undefined },
})
const statusFilter = computed<string | number | null>({
  get: () => filters.status ?? '',
  set: (v) => { filters.status = (typeof v === 'string' && v ? v : undefined) as BillingPeriodStatus | undefined },
})

const { yearOptions, monthOptions } = usePeriodOptions({
  selectedYear: computed(() => filters.period_year),
})

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

type QueueKey = 'needsReadings' | 'readyToReview' | 'issuedCollecting' | 'hasDebt' | 'closed'

const queueGroups = computed(() => {
  const g: Record<QueueKey, BillingPeriodSummary[]> = {
    needsReadings: [],
    readyToReview: [],
    issuedCollecting: [],
    hasDebt: [],
    closed: [],
  }
  for (const p of periods.value) {
    const s = p.period.status
    if (s === 'draft' || s === 'readings' || (p.readingRequiredCount > 0 && p.readingCompleteCount < p.readingRequiredCount)) {
      g.needsReadings.push(p)
    }
    if (s === 'review') g.readyToReview.push(p)
    if (s === 'issued' || s === 'collecting') g.issuedCollecting.push(p)
    if (p.outstandingBalance > 0) g.hasDebt.push(p)
    if (s === 'closed') g.closed.push(p)
  }
  return g
})

const queueMetrics = computed<Array<{ key: QueueKey; label: string; shortLabel: string; value: number; tone: 'warning' | 'accent' | 'default' | 'danger' | 'success' }>>(() => [
  { key: 'needsReadings', label: 'Cần nhập chỉ số', shortLabel: 'Nhập chỉ số', value: queueGroups.value.needsReadings.length, tone: 'warning' },
  { key: 'readyToReview', label: 'Soát chờ phát hành', shortLabel: 'Chờ phát hành', value: queueGroups.value.readyToReview.length, tone: 'accent' },
  { key: 'issuedCollecting', label: 'Đang thu', shortLabel: 'Đang thu', value: queueGroups.value.issuedCollecting.length, tone: 'default' },
  { key: 'hasDebt', label: 'Còn công nợ', shortLabel: 'Công nợ', value: queueGroups.value.hasDebt.length, tone: 'danger' },
  { key: 'closed', label: 'Đã chốt', shortLabel: 'Đã chốt', value: queueGroups.value.closed.length, tone: 'success' },
])

const activeQueue = ref<QueueKey | null>(null)
function toggleQueue(key: QueueKey) {
  activeQueue.value = activeQueue.value === key ? null : key
}

const displayedPeriods = computed(() => {
  if (!activeQueue.value) return periods.value
  return queueGroups.value[activeQueue.value]
})

const activeQueueLabel = computed(() =>
  activeQueue.value ? queueMetrics.value.find(m => m.key === activeQueue.value)?.label : null,
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

const QUEUE_CHIP_TONE: Record<'warning' | 'accent' | 'default' | 'danger' | 'success', { value: string; ring: string; dot: string }> = {
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

    <div class="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 md:mx-0 md:grid md:grid-cols-5 md:px-0 md:pb-0">
      <UiButton
        v-for="m in queueMetrics"
        :key="m.key"
        unstyled
        :aria-pressed="activeQueue === m.key"
        :class="[
          'group flex shrink-0 snap-start flex-col gap-1 rounded-xl border bg-dark-surface px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40 min-w-[10rem] md:min-w-0 md:shrink',
          activeQueue === m.key
            ? `${QUEUE_CHIP_TONE[m.tone].ring} ring-2`
            : 'border-dark-border hover:border-dark-hover hover:bg-dark-hover/40',
        ]"
        @click="toggleQueue(m.key)"
      >
        <span class="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
          <span :class="['h-1.5 w-1.5 rounded-full shrink-0', QUEUE_CHIP_TONE[m.tone].dot]" />
          <span class="whitespace-nowrap md:hidden">{{ m.shortLabel }}</span>
          <span class="hidden whitespace-nowrap md:inline">{{ m.label }}</span>
        </span>
        <UiSkeleton v-if="isLoading" class="h-7 w-12" />
        <span
          v-else
          :class="['text-2xl font-semibold tabular-nums leading-none', QUEUE_CHIP_TONE[m.tone].value]"
        >
          {{ m.value }}
        </span>
      </UiButton>
    </div>

    <div
      class="flex flex-col gap-2 rounded-xl border border-dark-border bg-dark-surface/40 p-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <div class="flex flex-1 flex-wrap items-center gap-2">
        <!-- Building -->
        <div class="w-full sm:w-56">
          <UiSelect
            v-model="buildingFilter"
            :options="buildings.map(b => ({ value: b.id, label: b.name }))"
            placeholder="Tất cả tòa nhà"
            :disabled="buildingsLoading"
            aria-label="Tòa nhà"
            class="w-full"
          >
            <template #prefix>
              <IconBuilding class="h-4 w-4" />
            </template>
          </UiSelect>
        </div>

        <!-- Year -->
        <div class="w-full sm:w-28">
          <UiSelect
            v-model="filters.period_year"
            :options="yearOptions"
            aria-label="Năm"
            class="w-full"
          >
            <template #prefix>
              <IconClock class="h-4 w-4" />
            </template>
          </UiSelect>
        </div>

        <!-- Status -->
        <div class="w-full sm:w-48">
          <UiSelect
            v-model="statusFilter"
            :options="BILLING_PERIOD_STATUSES.map(s => ({ value: s, label: statusLabel(s) }))"
            placeholder="Tất cả trạng thái"
            aria-label="Trạng thái"
            class="w-full"
          >
            <template #prefix>
              <IconTag class="h-4 w-4" />
            </template>
          </UiSelect>
        </div>

        <!-- Debt toggle -->
        <UiButton
          unstyled
          :aria-pressed="!!filters.has_debt"
          :class="[
            'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/30',
            filters.has_debt
              ? 'border-error/60 bg-error/10 text-error-vivid'
              : 'border-dark-border bg-dark-surface text-muted hover:border-dark-hover hover:text-white',
          ]"
          @click="filters.has_debt = filters.has_debt ? undefined : true"
        >
          <IconAlertCircle class="h-4 w-4" aria-hidden="true" />
          <span class="whitespace-nowrap">Có công nợ</span>
        </UiButton>

        <!-- Active queue chip -->
        <UiButton
          v-if="activeQueue"
          unstyled
          class="inline-flex h-9 items-center gap-1.5 rounded-md border border-cyan/60 bg-cyan/10 px-3 text-sm text-cyan transition hover:bg-cyan/20"
          @click="activeQueue = null"
        >
          <span class="whitespace-nowrap">{{ activeQueueLabel }}</span>
          <IconX class="h-3.5 w-3.5" aria-hidden="true" />
        </UiButton>

        <!-- Clear all -->
        <UiButton
          v-if="hasActiveFilters"
          unstyled
          class="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-dark-hover hover:text-white"
          @click="clearFilters"
        >
          <IconX class="h-3.5 w-3.5" aria-hidden="true" />
          Xóa lọc
        </UiButton>
      </div>

      <div class="flex shrink-0 items-center gap-3">
        <span v-if="!isLoading" class="text-xs tabular-nums text-muted">
          {{ displayedPeriods.length }} kỳ
        </span>
        <UiButton
          unstyled
          :class="[
            'inline-flex h-9 items-center gap-1.5 rounded-md border border-dark-border px-3 text-sm text-muted transition hover:bg-dark-hover hover:text-white',
            isLoading && 'pointer-events-none opacity-50',
          ]"
          :aria-label="isLoading ? 'Đang tải' : 'Làm mới danh sách'"
          @click="refresh()"
        >
          <IconRefresh
            :class="['h-4 w-4', isLoading && 'animate-spin']"
            aria-hidden="true"
          />
          <span class="hidden sm:inline">Làm mới</span>
        </UiButton>
      </div>
    </div>

    <!-- Mobile: card list -->
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

    <!-- Desktop: table -->
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
            :options="buildings.map(b => ({ value: b.id, label: b.name }))"
            placeholder="— Chọn tòa nhà —"
            :disabled="buildingsLoading"
            aria-label="Tòa nhà mở kỳ"
            class="w-full"
          />
        </UiSection>
        <div class="grid grid-cols-2 gap-3">
          <UiSection title="Tháng">
            <UiSelect
              v-model="openForm.period_month"
              :options="monthOptions"
              aria-label="Tháng mở kỳ"
              class="w-full"
            />
          </UiSection>
          <UiSection title="Năm">
            <UiSelect
              v-model="openForm.period_year"
              :options="yearOptions"
              aria-label="Năm mở kỳ"
              class="w-full"
            />
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
