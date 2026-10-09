<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import clsx from 'clsx'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import BillingDraftGridExpandedRow from '~/components/billing/BillingDraftGridExpandedRow.vue'
import BillingDraftGridOverrideModal from '~/components/billing/BillingDraftGridOverrideModal.vue'
import BillingAutoIssueModal from '~/components/billing/BillingAutoIssueModal.vue'
import BillingIncidentalChargeModal from '~/components/billing/BillingIncidentalChargeModal.vue'
import type {
  BillingDraftGridResponse,
  BillingDraftGridRow,
  BillingDraftGridUtilityCell,
  BillingDraftGridRowStatus,
  BillingPeriod,
  Invoice,
  IssueInvoicesResult,
  BillingInvoiceIssuePreview,
  BillingUtilityUsage,
  BillingIncidentalCharge,
} from '~/types/billing'
import type { MeterReadingBulkInput } from '~/utils/validators/meter-readings'
import type {
  IncidentalChargeCreateInput,
  IncidentalChargeUpdateInput,
  IssueInvoicesInput,
  IssueInvoicesPreviewInput,
  UtilityUsageOverrideInput,
} from '~/utils/validators/billing'
import type { IssueAndPayInput } from '~/utils/validators/billing-issue-pay'
import { formatCurrency } from '~/utils/format/currency'
import { isPeriodLocked } from '~/utils/billing/lock'
import {
  BILLING_BLOCKER_CODES,
  BILLING_WARNING_CODES,
} from '~/utils/constants/billing'
import {
  formatOptimisticUsage,
  optimisticRowDisplay,
  type OptimisticRowDisplay,
  type OptimisticUtilityDisplay,
} from '~/utils/billing/draft-grid-optimistic'
import { useBillingDraftGridAutosave } from '~/composables/billing/useBillingDraftGridAutosave'
import { useBillingDraftGridFilters } from '~/composables/billing/useBillingDraftGridFilters'
import { useBillingDraftGridNavigation } from '~/composables/billing/useBillingDraftGridNavigation'
import { defaultInvoiceDueDate } from '~/utils/billing/due-date'
import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

type MeterType = 'electricity' | 'water'

const props = withDefaults(defineProps<{
  response: BillingDraftGridResponse | null
  loading: boolean
  period: BillingPeriod | null
  unapprovedOverrides?: BillingUtilityUsage[]
  incidentalCharges?: BillingIncidentalCharge[]
  canManageIncidental?: boolean
  onSaveReadings: (
    readings: MeterReadingBulkInput['readings'],
    options?: { refresh?: boolean; silent?: boolean; refreshDrafts?: boolean },
  ) => Promise<void>
  onSaveOverride: (input: UtilityUsageOverrideInput) => Promise<void>
  onDeleteOverride: (overrideId: string) => Promise<void>
  onApproveOverride?: (overrideId: string) => Promise<BillingUtilityUsage>
  onCreateIncidental: (input: IncidentalChargeCreateInput) => Promise<BillingIncidentalCharge>
  onUpdateIncidental: (chargeId: string, input: IncidentalChargeUpdateInput) => Promise<BillingIncidentalCharge>
  onDeleteIncidental: (chargeId: string, expectedUpdatedAt: string) => Promise<void>
  onPreviewIssue?: (input: IssueInvoicesPreviewInput) => Promise<BillingInvoiceIssuePreview>
  onIssue?: (input: IssueInvoicesInput) => Promise<IssueInvoicesResult | undefined>
  onAutoIssue?: (input: IssueAndPayInput) => Promise<Invoice | undefined>
}>(), {
  incidentalCharges: () => [],
  canManageIncidental: true,
})

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'intent:void-reissue', payload: { invoiceId: string }): void
}>()

// ---------------------------------------------------------------------------
// Period editability
// ---------------------------------------------------------------------------

const periodEditable = computed(() => {
  const status = props.period?.status
  // Keep client gating aligned with server grid row editability:
  // editing is allowed until the period is closed.
  return status !== 'closed'
})

// ---------------------------------------------------------------------------
// Toolbar state
// ---------------------------------------------------------------------------

const batchReadingDate = ref<string>('')
const bulkEntryOpen = ref(false)
const overrideOpen = ref(false)
const overrideRow = ref<BillingDraftGridRow | null>(null)
const overrideType = ref<MeterType | null>(null)
const incidentalOpen = ref(false)
const incidentalRow = ref<BillingDraftGridRow | null>(null)
const incidentalCharge = ref<BillingIncidentalCharge | null>(null)

function incidentalChargesFor(row: BillingDraftGridRow): BillingIncidentalCharge[] {
  return (props.incidentalCharges ?? []).filter(charge => charge.contractId === row.contractId)
}

function canAddIncidental(row: BillingDraftGridRow): boolean {
  return props.canManageIncidental && !!row.contractId && row.editable
}

function canOverrideReadings(row: BillingDraftGridRow): boolean {
  return !!(row.electricity?.required || row.water?.required) && row.editable
}

function openIncidentalModal(row: BillingDraftGridRow, charge: BillingIncidentalCharge | null = null) {
  if (!props.canManageIncidental || !row.contractId || !row.editable) return
  incidentalRow.value = row
  incidentalCharge.value = charge
  incidentalOpen.value = true
}

function closeIncidentalModal() {
  incidentalOpen.value = false
  incidentalRow.value = null
  incidentalCharge.value = null
}

const draftGridResponse = computed(() => props.response)
const draftGridPeriod = computed(() => props.period)

// displayedRows is a computed derived from displayGridRowMap (defined later — safe because
// computed callbacks are lazy and only evaluated after setup() completes).
const displayedRows = computed<BillingDraftGridRow[]>(() =>
  (props.response?.rows ?? []).map(row => displayGridRowMap.value.get(row.key) ?? row),
)

const {
  filter,
  filterTabs,
  filteredRows,
  detailRow,
  isDetailOpen,
  toggleDetail,
  closeDetail,
  selectedCount,
  selectedRows,
  allVisibleSelected,
  someVisibleSelected,
  isSelectable,
  isSelected,
  toggleSelect,
  selectAllVisible,
  toggleSelectAllVisible,
  clearSelection,
} = useBillingDraftGridFilters(displayedRows)

// ---------------------------------------------------------------------------
// Mobile: floor quick-jump chips + bulk-entry prompt for long room lists
// ---------------------------------------------------------------------------

const MOBILE_MANY_ROOMS_THRESHOLD = 8

const showMobileBulkEntryPrompt = computed(() =>
  periodEditable.value && filteredRows.value.length >= MOBILE_MANY_ROOMS_THRESHOLD,
)

// Explains what "Chọn tất cả" is for — selection only does something once at
// least one row has readings saved (no blockers), which isn't obvious upfront.
const hasSelectableRows = computed(() => filteredRows.value.some(row => isSelectable(row)))

function floorAnchorId(floor: number): string {
  return `draft-floor-${floor}`
}

// First row (in list order) for each floor — the row that carries the scroll anchor id.
const firstRowKeyByFloor = computed(() => {
  const map = new Map<number, string>()
  for (const row of filteredRows.value) {
    if (row.floor === null) continue
    if (!map.has(row.floor)) map.set(row.floor, row.key)
  }
  return map
})

const mobileFloorChips = computed(() =>
  Array.from(firstRowKeyByFloor.value.keys())
    .sort((a, b) => a - b)
    .map(floor => ({ floor, label: `Tầng ${floor}` })),
)

function rowFloorAnchorId(row: BillingDraftGridRow): string | undefined {
  if (row.floor === null) return undefined
  return firstRowKeyByFloor.value.get(row.floor) === row.key ? floorAnchorId(row.floor) : undefined
}

function scrollToFloor(floor: number) {
  document.getElementById(floorAnchorId(floor))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const readingBlockerCodes = new Set<string>([
  BILLING_BLOCKER_CODES.MISSING_CURRENT_READING,
  BILLING_BLOCKER_CODES.MISSING_PREVIOUS_READING,
  BILLING_BLOCKER_CODES.NEGATIVE_CONSUMPTION,
])

function utilityReadiness(display: OptimisticUtilityDisplay): 'ready' | 'warning' | 'missing' {
  const cell = display.cell
  if (!cell || !cell.required || cell.source === 'fixed' || cell.source === 'per_person' || cell.source === 'not_applicable') {
    return 'ready'
  }
  // Server has already flagged this reading as negative — treat as warning even before user re-enters
  if (cell.blockerCode === BILLING_BLOCKER_CODES.NEGATIVE_CONSUMPTION) return 'warning'
  if (
    display.status === 'below_previous'
    || display.status === 'usage_spike'
    || display.status === 'usage_drop'
    || display.status === 'zero_usage'
  ) return 'warning'
  if (display.status === 'invalid' || display.status === 'empty' || display.status === 'unsupported') return 'missing'
  if (cell.previousValue === null || display.currentValue === null) return 'missing'
  return 'ready'
}

function deriveOptimisticStatus(
  row: BillingDraftGridRow,
  electricityDisplay: OptimisticUtilityDisplay,
  waterDisplay: OptimisticUtilityDisplay,
): BillingDraftGridRowStatus {
  if (row.invoiceStatus === 'paid') return 'paid'
  if (row.invoiceStatus === 'partial') return 'partial'
  if (row.invoiceStatus === 'issued' || row.invoiceStatus === 'overdue') return 'issued'
  if (row.rowType === 'vacant_baseline') return 'baseline'
  if (row.blockers.some(blocker => !readingBlockerCodes.has(blocker.code))) return 'blocked'

  const electricityState = utilityReadiness(electricityDisplay)
  const waterState = utilityReadiness(waterDisplay)

  if (electricityState === 'warning' || waterState === 'warning') return 'warning'
  if (electricityState === 'missing' || waterState === 'missing') return 'missing_reading'
  if (row.warnings.some(warning => warning.code === BILLING_WARNING_CODES.USAGE_OVERRIDE_APPLIED)) return 'warning'
  return 'ready'
}

// ---------------------------------------------------------------------------
// Bulk issue (merged from the former "Phát hành" tab)
// ---------------------------------------------------------------------------

const issuableSelectedRows = computed<BillingDraftGridRow[]>(() =>
  selectedRows.value.filter(row => !!row.contractId && !row.invoiceId),
)
const issuableSelectedCount = computed(() => issuableSelectedRows.value.length)
const issuePreviewOpen = ref(false)
const issuePreview = ref<BillingInvoiceIssuePreview | null>(null)
const issuePreviewLoading = ref(false)
const issuePreviewError = ref<string | null>(null)
const issuePreviewStale = ref(false)
const issueDueDate = ref(defaultInvoiceDueDate())
const issueUseOverride = ref(false)
const issueSubmitting = ref(false)
const approveOverridesOpen = ref(false)
const approvingOverrides = ref<BillingUtilityUsage[]>([])
const approvingInProgress = ref(false)
const overridesToApprove = computed(() => props.unapprovedOverrides ?? [])

async function loadIssuePreview() {
  if (!props.onPreviewIssue || issuableSelectedCount.value === 0) return
  issuePreviewLoading.value = true
  issuePreviewError.value = null
  issuePreviewStale.value = false
  try {
    const contractIds = issuableSelectedRows.value
      .map(row => row.contractId)
      .filter((id): id is string => !!id)
    issuePreview.value = await props.onPreviewIssue({
      contract_ids: contractIds,
      due_date_override: issueUseOverride.value ? issueDueDate.value : null,
    })
  }
  catch (error) {
    issuePreview.value = null
    issuePreviewError.value = getApiErrorMessage(error, 'Không thể tải bản xem trước hóa đơn.')
  }
  finally {
    issuePreviewLoading.value = false
  }
}

async function openIssuePreview() {
  try {
    await saveAll()
  }
  catch {
    toast.error('Chưa thể lưu hết chỉ số. Sửa lỗi lưu trước khi xem hóa đơn.')
    return
  }
  if (dirtyCountValue.value > 0 || Object.keys(rowSaveError.value).length > 0) {
    toast.error('Còn chỉ số chưa lưu hoặc đang lỗi. Hoàn tất lưu trước khi xem hóa đơn.')
    return
  }
  issuePreviewOpen.value = true
  await loadIssuePreview()
}

async function startIssue() {
  if (issuableSelectedCount.value === 0) return
  // Check for unapproved overrides
  if (overridesToApprove.value.length > 0) {
    approvingOverrides.value = overridesToApprove.value
    approveOverridesOpen.value = true
    return
  }
  await openIssuePreview()
}

async function approveAllOverrides() {
  if (!props.onApproveOverride || approvingOverrides.value.length === 0) return
  approvingInProgress.value = true
  try {
    for (const override of approvingOverrides.value) {
      await props.onApproveOverride(override.id)
    }
    approveOverridesOpen.value = false
    approvingOverrides.value = []
    await openIssuePreview()
  }
  catch (err) {
    console.error('Failed to approve overrides:', err)
  }
  finally {
    approvingInProgress.value = false
  }
}

async function confirmIssue() {
  if (!props.onIssue || !issuePreview.value || issuePreviewStale.value) return
  issueSubmitting.value = true
  issuePreviewError.value = null
  try {
    await props.onIssue({
      contract_ids: issuePreview.value.items.map(item => item.key),
      due_date_override: issuePreview.value.dueDateOverride,
      snapshot_hash: issuePreview.value.snapshotHash,
      operation_id: issuePreview.value.operationId,
    })
    issuePreviewOpen.value = false
    issuePreview.value = null
    clearSelection()
    emit('refresh')
  }
  catch (error) {
    const details = getApiErrorDetails<{ reason?: string }>(error)
    if (getApiErrorCode(error) === 'CONFLICT' && details?.reason === 'STALE_ISSUE_PREVIEW') {
      issuePreviewStale.value = true
      issuePreviewError.value = 'Dữ liệu kỳ đã thay đổi sau khi xem trước. Tải lại để duyệt số liệu mới trước khi phát hành.'
    }
    else {
      issuePreviewError.value = getApiErrorMessage(error, 'Phát hành hóa đơn thất bại.')
    }
  }
  finally {
    issueSubmitting.value = false
  }
}

function closeIssuePreview() {
  if (issueSubmitting.value) return
  issuePreviewOpen.value = false
  issuePreview.value = null
  issuePreviewError.value = null
  issuePreviewStale.value = false
}

async function changeIssueDueDate(value: string) {
  if (!value || value === issueDueDate.value) return
  issueDueDate.value = value
  await loadIssuePreview()
}

async function changeIssueOverride(value: boolean) {
  if (value === issueUseOverride.value) return
  issueUseOverride.value = value
  await loadIssuePreview()
}

// ---------------------------------------------------------------------------
// Single-row auto-issue (issue + full payment in one step). Feature-flagged.
// ---------------------------------------------------------------------------

const autoIssueEnabled = computed(() => useRuntimeConfig().public.billingAutoIssueEnabled === true)
const periodLocked = computed(() => isPeriodLocked(props.period))

const autoIssueRow = ref<BillingDraftGridRow | null>(null)
const autoIssueOpen = ref(false)
const autoIssueSubmitting = ref(false)

function canAutoIssue(row: BillingDraftGridRow): boolean {
  return autoIssueEnabled.value
    && !periodLocked.value
    && !row.checkoutId
    && row.status === 'ready'
    && !!row.contractId
    && !row.invoiceId
}

function startAutoIssue(row: BillingDraftGridRow) {
  if (!canAutoIssue(row)) return
  autoIssueRow.value = row
  autoIssueOpen.value = true
}

function closeAutoIssue() {
  autoIssueOpen.value = false
  autoIssueRow.value = null
}

async function submitAutoIssue(payload: { payment_date: string; payment_method: string | null; note: string | null }) {
  const row = autoIssueRow.value
  if (!props.onAutoIssue || !row?.contractId) return
  autoIssueSubmitting.value = true
  try {
    const result = await props.onAutoIssue({
      contract_id: row.contractId,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      note: payload.note,
    })
    if (result) {
      closeAutoIssue()
      emit('refresh')
    }
  }
  finally {
    autoIssueSubmitting.value = false
  }
}

watch(
  () => props.response?.batchReadingDate,
  (next) => {
    if (next && !batchReadingDate.value) batchReadingDate.value = next
  },
  { immediate: true },
)

const toast = useToast()

const {
  effectiveReadings,
  isSaving,
  rowSaveError,
  readingDraftValue,
  setReadingDraftValue,
  saveAll,
  saveRowNow,
  rowSaveStateOf,
  isCellDirty,
  dirtyCountValue,
} = useBillingDraftGridAutosave({
  response: draftGridResponse,
  period: draftGridPeriod,
  periodEditable,
  batchReadingDate,
  onSaveReadings: props.onSaveReadings,
  onAllSaved: (count) => {
    if (count > 0) toast.success(`Đã lưu ${count} chỉ số`)
    emit('refresh')
  },
})

const {
  isPasteHighlighted,
  handleReadingKeydown,
  handleReadingPaste,
  highlightReadingCells,
  cellKey,
} = useBillingDraftGridNavigation({
  filteredRows,
  setReadingDraftValue,
})

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

function statusBadgeFor(row: BillingDraftGridRow): { status: string; context: 'period' | 'invoice' | 'correction' } {
  switch (row.status) {
    case 'paid':
      return { status: 'paid', context: 'invoice' }
    case 'partial':
      return { status: 'partial', context: 'invoice' }
    case 'issued':
      return { status: 'issued', context: 'invoice' }
    case 'missing_reading':
      return { status: 'missing_reading', context: 'correction' }
    case 'blocked':
      return { status: 'blocked', context: 'correction' }
    case 'warning':
      return { status: 'review', context: 'period' }
    case 'baseline':
      return { status: 'baseline', context: 'correction' }
    case 'ready':
    default:
      return { status: 'ready', context: 'correction' }
  }
}

// ---------------------------------------------------------------------------
// Cell formatting — single-pass optimistic derivation per row
// ---------------------------------------------------------------------------

// One `optimisticRowDisplay` call per row per reactive update.
// Both the row-map (status/amounts) and the display helpers (labels) read from here.
const displayMetaMap = computed<Map<string, OptimisticRowDisplay>>(() => {
  const map = new Map<string, OptimisticRowDisplay>()
  for (const row of props.response?.rows ?? []) {
    map.set(row.key, optimisticRowDisplay(row, effectiveReadings.value))
  }
  return map
})

function rowDisplay(row: BillingDraftGridRow): OptimisticRowDisplay {
  return displayMetaMap.value.get(row.key) ?? optimisticRowDisplay(row, effectiveReadings.value)
}

function utilityDisplay(row: BillingDraftGridRow, type: MeterType): OptimisticUtilityDisplay {
  const display = rowDisplay(row)
  return type === 'electricity' ? display.electricity : display.water
}

function readingInputClass(row: BillingDraftGridRow, type: MeterType): string {
  const status = utilityDisplay(row, type).status
  return clsx(
    isPasteHighlighted(row, type) && 'bg-status-warning/40',
    status === 'below_previous' && 'border-status-danger/70 ring-1 ring-status-danger/40',
    (status === 'usage_spike' || status === 'usage_drop' || status === 'zero_usage') && 'border-status-warning/70 ring-1 ring-status-warning/40',
  )
}

function formatDisplayAmount(display: OptimisticUtilityDisplay): string {
  return display.amount !== null ? formatCurrency(display.amount) : '—'
}

function displayDraftTotal(row: BillingDraftGridRow): number | null {
  return rowDisplay(row).draftTotal
}

const displayGridRowMap = computed<Map<string, BillingDraftGridRow>>(() => {
  const map = new Map<string, BillingDraftGridRow>()
  for (const row of props.response?.rows ?? []) {
    const display = displayMetaMap.value.get(row.key)!
    map.set(row.key, {
      ...row,
      status: deriveOptimisticStatus(row, display.electricity, display.water),
      draftTotal: display.draftTotal,
      electricity: row.electricity
        ? {
            ...row.electricity,
            currentValue: display.electricity.currentValue,
            usage: display.electricity.usage,
            amount: display.electricity.amount,
          }
        : null,
      water: row.water
        ? {
            ...row.water,
            currentValue: display.water.currentValue,
            usage: display.water.usage,
            amount: display.water.amount,
          }
        : null,
    })
  }
  return map
})

const displayedTotals = computed(() => {
  return displayedRows.value.reduce(
    (totals, row) => {
      if (row.status === 'ready') totals.readyDraftCount += 1
      if (row.status === 'blocked' || row.status === 'missing_reading') totals.blockedDraftCount += 1
      if (row.rowType !== 'vacant_baseline' && row.status !== 'paid' && row.status !== 'partial' && row.status !== 'issued') {
        totals.draftTotal += row.draftTotal ?? 0
      }
      return totals
    },
    { readyDraftCount: 0, blockedDraftCount: 0, draftTotal: 0 },
  )
})

function displayGridRow(row: BillingDraftGridRow): BillingDraftGridRow {
  return displayGridRowMap.value.get(row.key) ?? row
}

function previousReadingHint(cell: BillingDraftGridUtilityCell | null): string {
  if (!cell || cell.previousValue === null) return '—'
  return `Kỳ trước · ${cell.previousValue}`
}

function applyBulkReadings(updates: Array<{ row: BillingDraftGridRow; type: MeterType; value: string }>) {
  const keys: string[] = []
  for (const update of updates) {
    setReadingDraftValue(update.row, update.type, update.value)
    keys.push(cellKey(update.row, update.type))
  }
  highlightReadingCells(keys)
}

defineExpose({ applyBulkReadings })

function handleReadingBlur(row: BillingDraftGridRow) {
  void saveRowNow(row)
}

// ---------------------------------------------------------------------------
// Override modal coordination
// ---------------------------------------------------------------------------

function openOverrideModal(row: BillingDraftGridRow, type?: MeterType) {
  if (!row.editable) return
  const hasElec = !!row.electricity?.required
  const hasWater = !!row.water?.required
  if (!hasElec && !hasWater) return
  overrideRow.value = row
  overrideType.value = type ?? null
  overrideOpen.value = true
}

function closeOverrideModal() {
  overrideOpen.value = false
  overrideRow.value = null
  overrideType.value = null
}

// ---------------------------------------------------------------------------
// Table columns (desktop)
// ---------------------------------------------------------------------------

const columns: UiTableColumn<BillingDraftGridRow>[] = [
  { key: 'select', label: '', action: true, width: 'w-10' },
  { key: 'room', label: 'Phòng & khách thuê' },
  { key: 'electricity_input', label: 'Điện mới', numeric: true, width: 'w-32' },
  { key: 'water_input', label: 'Nước mới', numeric: true, width: 'w-32' },
  { key: 'electricity_amount', label: 'Tiền điện', numeric: true, width: 'w-36' },
  { key: 'water_amount', label: 'Tiền nước', numeric: true, width: 'w-36' },
  { key: 'rent_service', label: 'Phòng & DV', numeric: true, width: 'w-32' },
  { key: 'draft_total', label: 'Tổng nháp', numeric: true, width: 'w-40' },
  { key: 'status', label: 'Trạng thái', width: 'w-32' },
  { key: 'actions', label: '', action: true, width: 'w-28' },
]
</script>

<template>
  <div class="space-y-4">
    <UiSection
      title="Soạn kỳ"
      description="Mỗi phòng một dòng. Nhập chỉ số mới, lưu để tính lại tiền điện/nước và tổng hoá đơn nháp."
      title-class="hidden md:block"
    >
      <template #actions>
        <div class="hidden md:block">
          <UiButton variant="secondary" size="sm" @click="$emit('refresh')">Tải lại</UiButton>
        </div>
      </template>

      <!-- Toolbar: batch reading date + filters -->
      <UiToolbar>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex min-w-0 flex-1 items-center gap-2 text-xs text-ui-muted">
            <span class="shrink-0">Ngày đọc</span>
            <UiDatePicker
              id="batch-reading-date"
              v-model="batchReadingDate"
              date-mode="reading"
              class="w-40"
              aria-label="Ngày đọc"
              :disabled="!periodEditable"
            />
          </div>
          <div v-if="periodEditable" class="hidden md:block">
            <UiButton
              variant="ghost"
              size="sm"
              @click="bulkEntryOpen = true"
            >
              Nhập nhanh
            </UiButton>
          </div>
          <div class="flex shrink-0 items-center gap-1 md:hidden">
            <UiButton
              variant="ghost"
              icon-only
              aria-label="Tải lại"
              class="min-h-11 min-w-11"
              @click="$emit('refresh')"
            >
              <IconRefresh class="h-4 w-4" aria-hidden="true" />
            </UiButton>
            <UiButton
              v-if="showMobileBulkEntryPrompt"
              variant="ghost"
              icon-only
              aria-label="Nhập nhanh cho nhiều phòng"
              class="min-h-11 min-w-11"
              @click="bulkEntryOpen = true"
            >
              <IconCopy class="h-4 w-4" aria-hidden="true" />
            </UiButton>
          </div>
        </div>
        <template #actions>
          <div
            role="tablist"
            aria-label="Lọc dòng theo trạng thái"
            class="inline-flex max-w-full items-center gap-0.5 overflow-x-auto no-scrollbar rounded-lg border border-ui-border bg-ui-chrome p-0.5"
          >
            <UiButton
              v-for="t in filterTabs"
              :key="t.key"
              unstyled
              role="tab"
              :aria-selected="filter === t.key"
              :class="clsx(
                'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/30',
                filter === t.key
                  ? 'bg-ui-hover text-ui-primary'
                  : 'text-ui-muted hover:text-ui-primary',
              )"
              @click="filter = t.key"
            >
              {{ t.label }}
            </UiButton>
          </div>
        </template>
      </UiToolbar>

      <!-- Save bar (desktop) -->
      <div
        v-if="periodEditable"
        class="hidden flex-wrap items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-surface px-3 py-2 md:flex"
      >
        <p class="text-sm text-ui-muted">
          <template v-if="dirtyCountValue > 0">
            Đang nhập <span class="font-semibold text-ui-primary">{{ dirtyCountValue }}</span> chỉ số. Tự động lưu sau khi dừng gõ.
          </template>
          <template v-else>
            Mọi thay đổi đã được tự động lưu.
          </template>
        </p>
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="dirtyCountValue === 0 || isSaving"
          @click="saveAll"
        >
          {{ isSaving ? 'Đang lưu...' : 'Lưu ngay' }}
        </UiButton>
      </div>

      <!-- Selection action bar -->
      <UiBulkActionsBar
        v-if="selectedCount > 0"
        aria-label="Thao tác hàng loạt phiếu"
        :count="selectedCount"
        @clear="clearSelection"
      >
        <UiButton
          v-if="!allVisibleSelected"
          variant="ghost"
          size="sm"
          class="whitespace-nowrap"
          @click="selectAllVisible"
        >
          Chọn tất cả trong lọc
        </UiButton>
        <UiButton
          v-if="onIssue && onPreviewIssue && issuableSelectedCount > 0"
          variant="primary"
          size="sm"
          class="whitespace-nowrap"
          @click="startIssue"
        >
          Xem trước &amp; phát hành ({{ issuableSelectedCount }})
        </UiButton>
      </UiBulkActionsBar>

      <!-- Loading -->
      <div v-if="loading" class="space-y-3">
        <UiSkeleton class="h-24 w-full" />
        <UiSkeleton class="h-24 w-full" />
        <UiSkeleton class="h-24 w-full" />
      </div>

      <!-- Empty -->
      <UiEmptyState
        v-else-if="!response || response.rows.length === 0"
        title="Chưa có phòng"
        description="Toà nhà này chưa có phòng được khai báo."
      />

      <!-- Grid -->
      <UiTable
        v-else
        :columns="columns"
        :rows="filteredRows"
        row-key="key"
        :empty-title="'Không có dòng phù hợp với bộ lọc'"
        :empty-description="'Đổi bộ lọc để xem các dòng khác.'"
        class="hidden md:block"
      >
        <template #header-select>
          <UiCheckbox
            :model-value="allVisibleSelected"
            :indeterminate="someVisibleSelected"
            aria-label="Chọn tất cả phòng"
            @update:model-value="toggleSelectAllVisible"
          />
        </template>

        <template #cell-select="{ row }">
          <UiCheckbox
            v-if="isSelectable(row as BillingDraftGridRow)"
            :model-value="isSelected(row as BillingDraftGridRow)"
            :aria-label="`Chọn phòng ${(row as BillingDraftGridRow).roomNumber ?? ''}`"
            @update:model-value="toggleSelect(row as BillingDraftGridRow)"
          />
        </template>

        <template #cell-room="{ row }">
          <div class="flex items-start gap-2">
            <UiButton
              unstyled
              class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ui-muted transition-colors hover:bg-ui-hover hover:text-ui-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
              :aria-label="isDetailOpen(row as BillingDraftGridRow) ? 'Thu gọn chi tiết' : 'Xem chi tiết'"
              :aria-expanded="isDetailOpen(row as BillingDraftGridRow)"
              @click="toggleDetail(row as BillingDraftGridRow)"
            >
              <IconChevronRight
                class="h-3.5 w-3.5 transition-transform"
                :class="isDetailOpen(row as BillingDraftGridRow) && 'rotate-90'"
                aria-hidden="true"
              />
            </UiButton>
            <div class="flex min-w-0 flex-col leading-tight">
              <span class="text-sm font-semibold text-ui-primary">
                {{ (row as BillingDraftGridRow).roomNumber ?? '—' }}
                <span v-if="(row as BillingDraftGridRow).floor !== null" class="ml-1 text-xs font-normal text-ui-muted">
                  · Tầng {{ (row as BillingDraftGridRow).floor }}
                </span>
              </span>
              <span class="truncate text-xs text-ui-muted">
                {{ (row as BillingDraftGridRow).tenantName ?? 'Chưa có khách' }}
              </span>
            </div>
          </div>
        </template>

        <template #cell-electricity_input="{ row }">
          <div
            v-if="(row as BillingDraftGridRow).electricity"
            class="flex flex-col items-end gap-1"
          >
            <UiInput
              v-if="(row as BillingDraftGridRow).electricity!.editable"
              type="number"
              number-mode="meter"
              :data-reading-cell="`${(row as BillingDraftGridRow).roomId}::electricity`"
              :model-value="readingDraftValue(row as BillingDraftGridRow, 'electricity')"
              density="compact"
              class="w-28"
              :class="readingInputClass(row as BillingDraftGridRow, 'electricity')"
              @update:model-value="setReadingDraftValue(row as BillingDraftGridRow, 'electricity', String($event ?? ''))"
              @keydown="handleReadingKeydown($event, row as BillingDraftGridRow, 'electricity')"
              @paste="handleReadingPaste($event, row as BillingDraftGridRow, 'electricity')"
              @blur="handleReadingBlur(row as BillingDraftGridRow)"
            />
            <span v-else class="text-sm text-ui-primary tabular-nums">
              {{ (row as BillingDraftGridRow).electricity!.currentValue ?? '—' }}
            </span>
            <p class="flex items-center justify-end gap-1.5 text-[10px] leading-none tabular-nums">
              <span
                aria-hidden="true"
                :class="clsx(
                  'inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-[background-color,opacity] duration-150',
                  rowSaveStateOf(row as BillingDraftGridRow) === 'saving' ? 'bg-ui-accent/70 animate-pulse motion-reduce:animate-none' :
                  rowSaveStateOf(row as BillingDraftGridRow) === 'saved' ? 'bg-status-success' :
                  rowSaveStateOf(row as BillingDraftGridRow) === 'error' ? 'bg-status-danger' :
                  isCellDirty(row as BillingDraftGridRow, 'electricity') ? 'bg-status-warning/60' :
                  'opacity-0',
                )"
              />
              <span class="text-ui-muted">{{ previousReadingHint((row as BillingDraftGridRow).electricity) }}</span>
            </p>
          </div>
          <span v-else class="text-xs text-ui-muted">—</span>
        </template>

        <template #cell-water_input="{ row }">
          <div
            v-if="(row as BillingDraftGridRow).water"
            class="flex flex-col items-end gap-1"
          >
            <UiInput
              v-if="(row as BillingDraftGridRow).water!.editable"
              type="number"
              number-mode="meter"
              :data-reading-cell="`${(row as BillingDraftGridRow).roomId}::water`"
              :model-value="readingDraftValue(row as BillingDraftGridRow, 'water')"
              density="compact"
              class="w-28"
              :class="readingInputClass(row as BillingDraftGridRow, 'water')"
              @update:model-value="setReadingDraftValue(row as BillingDraftGridRow, 'water', String($event ?? ''))"
              @keydown="handleReadingKeydown($event, row as BillingDraftGridRow, 'water')"
              @paste="handleReadingPaste($event, row as BillingDraftGridRow, 'water')"
              @blur="handleReadingBlur(row as BillingDraftGridRow)"
            />
            <span v-else class="text-sm text-ui-primary tabular-nums">
              {{ (row as BillingDraftGridRow).water!.currentValue ?? '—' }}
            </span>
            <p class="flex items-center justify-end gap-1.5 text-[10px] leading-none tabular-nums">
              <span
                aria-hidden="true"
                :class="clsx(
                  'inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-[background-color,opacity] duration-150',
                  rowSaveStateOf(row as BillingDraftGridRow) === 'saving' ? 'bg-ui-accent/70 animate-pulse motion-reduce:animate-none' :
                  rowSaveStateOf(row as BillingDraftGridRow) === 'saved' ? 'bg-status-success' :
                  rowSaveStateOf(row as BillingDraftGridRow) === 'error' ? 'bg-status-danger' :
                  isCellDirty(row as BillingDraftGridRow, 'water') ? 'bg-status-warning/60' :
                  'opacity-0',
                )"
              />
              <span class="text-ui-muted">{{ previousReadingHint((row as BillingDraftGridRow).water) }}</span>
            </p>
          </div>
          <span v-else class="text-xs text-ui-muted">—</span>
        </template>

        <template #cell-electricity_amount="{ row }">
          <div class="flex flex-col items-end gap-0.5">
            <span class="text-sm tabular-nums text-ui-primary">
              {{ formatDisplayAmount(utilityDisplay(row as BillingDraftGridRow, 'electricity')) }}
            </span>
            <span class="text-[10px] text-ui-muted">
              {{ formatOptimisticUsage(utilityDisplay(row as BillingDraftGridRow, 'electricity')) }}
            </span>
          </div>
        </template>

        <template #cell-water_amount="{ row }">
          <div class="flex flex-col items-end gap-0.5">
            <span class="text-sm tabular-nums text-ui-primary">
              {{ formatDisplayAmount(utilityDisplay(row as BillingDraftGridRow, 'water')) }}
            </span>
            <span class="text-[10px] text-ui-muted">
              {{ formatOptimisticUsage(utilityDisplay(row as BillingDraftGridRow, 'water')) }}
            </span>
          </div>
        </template>

        <template #cell-rent_service="{ row }">
          <span class="text-sm tabular-nums text-ui-primary">
            {{ (row as BillingDraftGridRow).rowType === 'billable_contract' ? formatCurrency((row as BillingDraftGridRow).rentAndServiceTotal) : '—' }}
          </span>
        </template>

        <template #cell-draft_total="{ row }">
          <div class="flex items-center justify-end gap-2.5">
            <span class="hidden h-5 w-[2px] rounded-full bg-ui-accent/60 md:inline-block" aria-hidden="true" />
            <span class="text-[15px] font-semibold tabular-nums text-ui-primary">
              {{ displayDraftTotal(row as BillingDraftGridRow) !== null ? formatCurrency(displayDraftTotal(row as BillingDraftGridRow)!) : '—' }}
            </span>
          </div>
        </template>

        <template #cell-status="{ row }">
          <UiStatusBadge
            :status="statusBadgeFor(row as BillingDraftGridRow).status"
            :context="statusBadgeFor(row as BillingDraftGridRow).context"
          />
        </template>

        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-2">
            <NuxtLink
              v-if="(row as BillingDraftGridRow).checkoutHref"
              :to="(row as BillingDraftGridRow).checkoutHref!"
              data-test="checkout-link"
              class="whitespace-nowrap rounded px-2 py-1.5 text-xs font-medium text-ui-accent hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent"
            >Quyết toán</NuxtLink>
            <span
              v-if="rowSaveStateOf(row as BillingDraftGridRow) === 'saving'"
              class="whitespace-nowrap text-[11px] text-ui-muted"
            >
              Đang lưu…
            </span>
            <span
              v-else-if="rowSaveStateOf(row as BillingDraftGridRow) === 'saved'"
              class="whitespace-nowrap text-[11px] text-status-success"
            >
              Đã lưu ✓
            </span>
            <span
              v-else-if="rowSaveStateOf(row as BillingDraftGridRow) === 'error'"
              class="whitespace-nowrap text-[11px] text-status-danger"
              :title="rowSaveError[(row as BillingDraftGridRow).roomId]"
            >
              Lỗi
            </span>
            <UiButton
              v-if="onAutoIssue && canAutoIssue(row as BillingDraftGridRow)"
              variant="primary"
              size="sm"
              class="whitespace-nowrap"
              @click="startAutoIssue(row as BillingDraftGridRow)"
            >
              Đã thu
            </UiButton>
            <UiDropdownMenu
              v-if="canAddIncidental(row as BillingDraftGridRow) || canOverrideReadings(row as BillingDraftGridRow)"
              :aria-label="`Hành động cho phòng ${(row as BillingDraftGridRow).roomNumber ?? ''}`"
            >
              <UiDropdownMenuItem
                v-if="canAddIncidental(row as BillingDraftGridRow)"
                :data-test="`desktop-add-incidental-${(row as BillingDraftGridRow).roomId}`"
                @click="openIncidentalModal(row as BillingDraftGridRow)"
              >
                <template #icon>
                  <IconPlus class="h-4 w-4 shrink-0" aria-hidden="true" />
                </template>
                Thêm phát sinh
              </UiDropdownMenuItem>
              <UiDropdownMenuItem
                v-if="canOverrideReadings(row as BillingDraftGridRow)"
                :data-test="`desktop-override-${(row as BillingDraftGridRow).roomId}`"
                @click="openOverrideModal(row as BillingDraftGridRow)"
              >
                <template #icon>
                  <IconPencilSquare class="h-4 w-4 shrink-0" aria-hidden="true" />
                </template>
                Điều chỉnh chỉ số
              </UiDropdownMenuItem>
            </UiDropdownMenu>
          </div>
        </template>
      </UiTable>

      <!-- Mobile: floor quick-jump so a long room list isn't one flat scroll -->
      <div
        v-if="mobileFloorChips.length > 1 && !loading && response && filteredRows.length > 0"
        class="relative md:hidden"
      >
        <div class="-mx-4 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-4 pb-0.5">
          <UiButton
            v-for="chip in mobileFloorChips"
            :key="chip.floor"
            unstyled
            class="shrink-0 snap-start rounded-full border border-ui-border bg-ui-surface px-3 py-1.5 text-xs text-ui-muted transition hover:border-ui-border-strong hover:bg-ui-hover/40 hover:text-ui-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40"
            @click="scrollToFloor(chip.floor)"
          >
            {{ chip.label }}
          </UiButton>
        </div>
        <div class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-ui-canvas to-transparent" aria-hidden="true" />
      </div>

      <!-- Mobile: merged save-status + select-all panel -->
      <div
        v-if="!loading && response && filteredRows.length > 0"
        class="flex flex-col gap-2 rounded-lg border border-ui-border bg-ui-surface px-3 py-2 md:hidden"
      >
        <div v-if="periodEditable" class="flex items-center justify-between gap-3">
          <p class="text-xs text-ui-muted">
            <template v-if="dirtyCountValue > 0">
              Đang nhập <span class="font-semibold text-ui-primary">{{ dirtyCountValue }}</span> chỉ số.
            </template>
            <template v-else>
              Mọi thay đổi đã được tự động lưu.
            </template>
          </p>
          <UiButton
            variant="ghost"
            size="sm"
            :disabled="dirtyCountValue === 0 || isSaving"
            @click="saveAll"
          >
            {{ isSaving ? 'Đang lưu...' : 'Lưu ngay' }}
          </UiButton>
        </div>
        <div v-if="periodEditable" class="border-t border-ui-border" />
        <UiSelectAllBar
          variant="bare"
          :model-value="allVisibleSelected"
          :indeterminate="someVisibleSelected"
          :disabled="!hasSelectableRows"
          :page-count="filteredRows.length"
          :total-selected="selectedCount"
          aria-label="Chọn tất cả phòng để phát hành hàng loạt"
          :description="hasSelectableRows
            ? 'Chọn để xem trước & phát hành nhiều phòng cùng lúc.'
            : 'Xuất hiện khi phòng đã đủ chỉ số — dùng để phát hành hàng loạt.'"
          @update:model-value="toggleSelectAllVisible"
        />
      </div>

      <!-- Mobile cards (stacked) -->
      <div
        v-if="!loading && response && filteredRows.length > 0"
        :class="clsx('space-y-2 md:hidden', selectedCount > 0 && 'pb-28')"
      >
        <BillingMobileDraftRow
          v-for="row in filteredRows"
          :id="rowFloorAnchorId(row)"
          :key="row.key"
          class="scroll-mt-24"
          :row="displayGridRow(row)"
          :selectable="isSelectable(row)"
          :selected="isSelected(row)"
          :reading-value-of="readingDraftValue"
          :is-cell-dirty="isCellDirty"
          :is-paste-highlighted="isPasteHighlighted"
          :save-state-of="rowSaveStateOf"
          :can-manage-incidental="canManageIncidental"
          @update="setReadingDraftValue($event.row, $event.type, $event.value)"
          @keydown="handleReadingKeydown($event.event, $event.row, $event.type)"
          @paste="handleReadingPaste($event.event, $event.row, $event.type)"
          @override="openOverrideModal($event)"
          @detail="toggleDetail($event)"
          @add-incidental="openIncidentalModal($event)"
          @select="toggleSelect($event)"
          @blur="handleReadingBlur($event.row)"
        />
      </div>

      <!-- Detail drawer -->
      <UiDrawer
        :model-value="detailRow !== null"
        :title="detailRow ? `Chi tiết phòng ${detailRow.roomNumber ?? '—'}` : 'Chi tiết dòng'"
        width="w-full sm:w-[480px]"
        @update:model-value="(open) => { if (!open) closeDetail() }"
      >
        <BillingDraftGridExpandedRow
          v-if="detailRow"
          :row="detailRow"
          :period="period"
          :incidental-charges="incidentalChargesFor(detailRow)"
          :can-manage-incidental="canManageIncidental"
          @close="closeDetail"
          @add-incidental="openIncidentalModal(detailRow)"
          @edit-incidental="openIncidentalModal(detailRow, $event)"
          @intent:void-reissue="$emit('intent:void-reissue', $event)"
        />
      </UiDrawer>

      <!-- Inline summary -->
      <p
        v-if="displayedTotals.readyDraftCount > 0 || displayedTotals.blockedDraftCount > 0"
        class="mt-4 text-xs text-ui-muted"
      >
        <span>Sẵn sàng: <span class="text-status-success tabular-nums">{{ displayedTotals.readyDraftCount }}</span></span>
        <span class="mx-2 text-dark-border">·</span>
        <span>Có lỗi: <span :class="displayedTotals.blockedDraftCount > 0 ? 'text-status-danger tabular-nums' : 'text-ui-primary tabular-nums'">{{ displayedTotals.blockedDraftCount }}</span></span>
      </p>
    </UiSection>

    <BillingDraftGridOverrideModal
      :open="overrideOpen"
      :row="overrideRow"
      :initial-type="overrideType"
      :on-save-override="props.onSaveOverride"
      :on-delete-override="props.onDeleteOverride"
      @close="closeOverrideModal"
    />
    <BillingIncidentalChargeModal
      :open="incidentalOpen"
      :row="incidentalRow"
      :charge="incidentalCharge"
      :on-create="props.onCreateIncidental"
      :on-update="props.onUpdateIncidental"
      :on-delete="props.onDeleteIncidental"
      @close="closeIncidentalModal"
    />
    <BillingBulkReadingEntryModal
      :open="bulkEntryOpen"
      :rows="filteredRows"
      @close="bulkEntryOpen = false"
      @apply="applyBulkReadings"
    />
    <UiModal
      :open="approveOverridesOpen"
      title="Duyệt các điều chỉnh"
      size="md"
      @close="approveOverridesOpen = false"
    >
      <div class="space-y-4">
        <p class="text-sm text-ui-muted">
          Cần duyệt <span class="font-semibold text-ui-primary">{{ approvingOverrides.length }}</span> điều chỉnh trước khi phát hành:
        </p>
        <div class="max-h-80 space-y-2 overflow-y-auto">
          <div
            v-for="override in approvingOverrides"
            :key="override.id"
            class="rounded-lg border border-ui-border bg-ui-chrome p-3"
          >
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium text-ui-muted">{{ override.meterType === 'electricity' ? 'Điện' : 'Nước' }}</p>
                <p class="text-sm font-semibold text-ui-primary">{{ override.previousReadingValue }} → {{ override.currentReadingValue }}</p>
                <p class="text-xs text-ui-muted">Tiêu thụ: {{ override.billableUsage }} <span v-if="override.meterType === 'electricity'">kWh</span><span v-else>m³</span></p>
              </div>
            </div>
          </div>
        </div>
        <div class="flex gap-2 pt-2">
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="approvingInProgress"
            @click="approveOverridesOpen = false"
          >
            Huỷ
          </UiButton>
          <UiButton
            variant="primary"
            size="sm"
            :loading="approvingInProgress"
            @click="approveAllOverrides"
          >
            Duyệt tất cả & Phát hành
          </UiButton>
        </div>
      </div>
    </UiModal>
    <BillingInvoiceIssuePreviewModal
      :open="issuePreviewOpen"
      :preview="issuePreview"
      :due-date="issueDueDate"
      :use-override="issueUseOverride"
      :loading="issuePreviewLoading"
      :submitting="issueSubmitting"
      :error="issuePreviewError"
      :stale="issuePreviewStale"
      @close="closeIssuePreview"
      @refresh="loadIssuePreview"
      @confirm="confirmIssue"
      @update:due-date="changeIssueDueDate"
      @update:use-override="changeIssueOverride"
    />
    <BillingAutoIssueModal
      :open="autoIssueOpen"
      :row="autoIssueRow"
      :submitting="autoIssueSubmitting"
      @close="closeAutoIssue"
      @submit="submitAutoIssue"
    />
  </div>
</template>
