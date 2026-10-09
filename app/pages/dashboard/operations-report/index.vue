<script setup lang="ts">

import clsx from 'clsx'
import { computed, ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { getApiErrorMessage } from '~/utils/api-error'
import { currentVietnamPeriod, parsePeriodString } from '~/utils/format/period'
import type {
  BuildingExpense,
  RecurringExpense,
  RecurringExpenseRecordPrefill,
} from '~/types/operations-report'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from '~/utils/constants/operations-report'
import { formatCurrency } from '~/utils/format/currency'
import {
  useOperationsMutations,
  useOperationsReport,
} from '~/composables/operations-report/useOperationsReport'
import { useToast } from '~/composables/useToast'

definePageMeta({ title: 'Báo cáo vận hành' })

const auth = useAuthStore()
const toast = useToast()

const {
  buildings,
  buildingId,
  periodYear,
  periodMonth,
  report,
  isLoading,
  errorMessage,
  forbidden,
  reload,
  exportXlsx,
} = useOperationsReport()

const {
  createExpense,
  updateExpense,
  voidExpense,
  uploadExpenseReceipt,
  removeExpenseReceipt,
  closeReport,
  reopenReport,
  refreshReserveAccrual,
} = useOperationsMutations()
const {
  upcomingRecurringExpenses,
  recordRecurringExpense,
  dismissRecurringExpense,
  refreshUpcomingRecurringExpenses,
} = useRecurringExpenses(buildingId)

// --- Capability gates ---------------------------------------------------
const isReportClosed = computed(() => report.value?.closure.status === 'closed')
const canWriteExpense = computed(() => auth.can('building-expenses.write') && !isReportClosed.value)
const canVoidExpense = computed(() => auth.can('building-expenses.delete') && !isReportClosed.value)
const canExportReport = computed(() => auth.can('operations-report.export'))
const canReadRecurring = computed(() => auth.can('recurring-expenses.read'))
const canReadReserveFund = computed(() => auth.can('reserve-fund.read'))
const canManageReserveFund = computed(() => auth.can('reserve-fund.manage'))
const canCloseReport = computed(() => auth.can('operations-report.close'))
const canReopenReport = computed(() => auth.can('operations-report.reopen'))
const canRefreshReserveAccrual = computed(() => auth.can('reserve-fund.refresh-accrual'))
const exportLoading = ref(false)
const closingReport = ref(false)
const reopeningReport = ref(false)
const refreshingReserve = ref(false)

async function exportReportXlsx() {
  exportLoading.value = true
  try {
    await exportXlsx()
    toast.success('Đã xuất file Excel.')
  }
  catch (err) {
    toast.error(resolveError(err, 'Không xuất được Excel.'))
  }
  finally {
    exportLoading.value = false
  }
}

function reportPeriodPayload() {
  if (!buildingId.value) throw new Error('No building id')
  return {
    building_id: buildingId.value,
    period_year: periodYear.value,
    period_month: periodMonth.value,
  }
}

async function closeCurrentReport() {
  closingReport.value = true
  try {
    await closeReport(reportPeriodPayload())
    toast.success('Đã chốt báo cáo vận hành.')
    await reload()
  }
  catch (err) {
    toast.error(resolveError(err, 'Không chốt được báo cáo vận hành.'))
  }
  finally {
    closingReport.value = false
  }
}

async function reopenCurrentReport() {
  const reason = window.prompt('Lý do mở lại báo cáo vận hành')
  if (!reason?.trim()) return
  reopeningReport.value = true
  try {
    await reopenReport({ ...reportPeriodPayload(), reason: reason.trim() })
    toast.success('Đã mở lại báo cáo vận hành.')
    await reload()
  }
  catch (err) {
    toast.error(resolveError(err, 'Không mở lại được báo cáo vận hành.'))
  }
  finally {
    reopeningReport.value = false
  }
}

async function refreshCurrentReserveAccrual() {
  refreshingReserve.value = true
  try {
    await refreshReserveAccrual(reportPeriodPayload())
    toast.success('Đã cập nhật quỹ dự phòng.')
    await reload()
  }
  catch (err) {
    toast.error(resolveError(err, 'Không cập nhật được quỹ dự phòng.'))
  }
  finally {
    refreshingReserve.value = false
  }
}

// --- Filter options -----------------------------------------------------
const buildingOptions = computed(() =>
  buildings.value.map(b => ({ value: b.id, label: b.name })),
)
const selectedBuilding = computed(() =>
  buildings.value.find(b => b.id === buildingId.value) ?? null,
)
const buildingStartPeriod = computed<{ year: number, month: number } | null>(() => {
  const year = selectedBuilding.value?.operationalStartYear
  const month = selectedBuilding.value?.operationalStartMonth
  if (year == null || month == null) return null
  return {
    year,
    month,
  }
})
const {
  yearOptions,
  monthOptions,
  normalizeSelection,
} = usePeriodOptions({
  selectedYear: periodYear,
  minPeriod: buildingStartPeriod,
})

normalizeSelection(periodYear, periodMonth)

const expenseCategory = ref<ExpenseCategory | ''>('')
const expenseCategoryOptions = computed(() => [
  { value: '', label: 'Tất cả loại chi' },
  ...EXPENSE_CATEGORIES.map(category => ({
    value: category,
    label: EXPENSE_CATEGORY_LABELS[category],
  })),
])

const buildingModel = computed<string | number | null>({
  get: () => buildingId.value ?? '',
  set: (v) => { buildingId.value = typeof v === 'string' && v ? v : null },
})
const yearModel = computed<string | number | null>({
  get: () => periodYear.value,
  set: (v) => { periodYear.value = Number(v) },
})
const monthModel = computed<string | number | null>({
  get: () => periodMonth.value,
  set: (v) => { periodMonth.value = Number(v) },
})
const expenseCategoryModel = computed<string | number | null>({
  get: () => expenseCategory.value,
  set: (v) => {
    expenseCategory.value =
      typeof v === 'string' && EXPENSE_CATEGORIES.includes(v as ExpenseCategory)
        ? (v as ExpenseCategory)
        : ''
  },
})

const defaultBuildingId = computed(() => buildings.value[0]?.id ?? null)
// Pinned to Vietnam time: `new Date().getMonth()` is local, so the server (UTC) and the
// browser (UTC+7) disagreed on the current period and mismatched on hydration.
const currentPeriod = parsePeriodString(currentVietnamPeriod())!
const activeFilterCount = computed(() => {
  let n = 0
  // Both sides must be resolved before comparing: on SSR `buildingId` is still null
  // (the watcher that seeds it from the default has not flushed), which would read as
  // an active filter on the server only.
  if (buildingId.value !== null
    && defaultBuildingId.value !== null
    && buildingId.value !== defaultBuildingId.value) n++
  if (periodYear.value !== currentPeriod.year || periodMonth.value !== currentPeriod.month) n++
  if (expenseCategory.value !== '') n++
  return n
})

function resetFilters() {
  buildingId.value = defaultBuildingId.value
  periodYear.value = currentPeriod.year
  periodMonth.value = currentPeriod.month
  expenseCategory.value = ''
}

const metrics = computed(() => report.value?.metrics ?? null)
// Merge pass-through utility input/margin into the matching revenue row so the
// detail renders inline instead of a separate table that repeats the collected
// amount already shown in the revenue list.
const revenueRows = computed(() => {
  const currentReport = report.value
  if (!currentReport) return []

  const utilityDetail: Record<string, { input: number, margin: number }> = {
    electricity: {
      input: currentReport.electricity.input,
      margin: currentReport.electricity.margin,
    },
    water: {
      input: currentReport.water.input,
      margin: currentReport.water.margin,
    },
  }

  return currentReport.revenueByType.map(row => ({
    ...row,
    utility: utilityDetail[row.key] ?? null,
  }))
})
const filteredExpenses = computed(() => {
  const expenses = report.value?.expenses ?? []
  if (!expenseCategory.value) return expenses
  return expenses.filter(expense => expense.category === expenseCategory.value)
})
const filteredExpenseTotal = computed(() =>
  filteredExpenses.value.reduce((total, expense) => total + expense.amount, 0),
)

// --- Expense modal ------------------------------------------------------
const expenseModalOpen = ref(false)
const editingExpense = ref<BuildingExpense | null>(null)
const expensePrefill = ref<RecurringExpenseRecordPrefill | null>(null)
const recurringRecordTarget = ref<RecurringExpense | null>(null)
const savingExpense = ref(false)

function openCreateExpense() {
  editingExpense.value = null
  expensePrefill.value = null
  recurringRecordTarget.value = null
  expenseModalOpen.value = true
}
function openEditExpense(expense: BuildingExpense) {
  editingExpense.value = expense
  expensePrefill.value = null
  recurringRecordTarget.value = null
  expenseModalOpen.value = true
}

function recordReminder(item: RecurringExpense) {
  editingExpense.value = null
  recurringRecordTarget.value = item
  expensePrefill.value = {
    buildingId: item.buildingId,
    periodYear: periodYear.value,
    periodMonth: periodMonth.value,
    expenseDate: item.nextReminderAt,
    category: item.category,
    amount: item.estimatedAmount,
    note: item.name,
  }
  expenseModalOpen.value = true
}

async function dismissReminder(item: RecurringExpense) {
  try {
    await dismissRecurringExpense(item.id)
    toast.success('Đã bỏ qua nhắc chi phí.')
  }
  catch (err) {
    toast.error(resolveError(err, 'Không bỏ qua được nhắc chi phí.'))
  }
}

async function submitExpense(payload: Record<string, unknown>) {
  savingExpense.value = true
  try {
    const receiptFile = payload.receipt_file instanceof File ? payload.receipt_file : null
    delete payload.receipt_file
    if (editingExpense.value) {
      await updateExpense(editingExpense.value.id, payload)
      if (receiptFile) await uploadExpenseReceipt(editingExpense.value.id, receiptFile)
      toast.success('Đã cập nhật chi phí.')
    }
    else {
      const created = await createExpense(payload)
      if (recurringRecordTarget.value) {
        await recordRecurringExpense(recurringRecordTarget.value.id, {
          period_year: periodYear.value,
          period_month: periodMonth.value,
        })
      }
      if (receiptFile) await uploadExpenseReceipt(created.id, receiptFile)
      toast.success('Đã thêm chi phí.')
    }
    expenseModalOpen.value = false
    expensePrefill.value = null
    recurringRecordTarget.value = null
    await reload()
    await refreshUpcomingRecurringExpenses()
  }
  catch (err) {
    toast.error(resolveError(err, 'Không lưu được chi phí.'))
  }
  finally {
    savingExpense.value = false
  }
}

async function removeReceipt(expense: BuildingExpense) {
  try {
    await removeExpenseReceipt(expense.id)
    toast.success('Đã xoá biên lai.')
    await reload()
  }
  catch (err) {
    toast.error(resolveError(err, 'Không xoá được biên lai.'))
  }
}

// --- Void modal ---------------------------------------------------------
const voidModalOpen = ref(false)
const voidTarget = ref<BuildingExpense | null>(null)
const voidReason = ref('')
const voidError = ref<string | null>(null)
const voiding = ref(false)

function openVoid(expense: BuildingExpense) {
  voidTarget.value = expense
  voidReason.value = ''
  voidError.value = null
  voidModalOpen.value = true
}

async function submitVoid() {
  voidError.value = null
  if (!voidReason.value.trim()) {
    voidError.value = 'Lý do hủy là bắt buộc.'
    return
  }
  if (!voidTarget.value) return
  voiding.value = true
  try {
    await voidExpense(voidTarget.value.id, voidReason.value.trim())
    toast.success('Đã hủy chi phí.')
    voidModalOpen.value = false
    await reload()
  }
  catch (err) {
    voidError.value = resolveError(err, 'Không hủy được chi phí.')
  }
  finally {
    voiding.value = false
  }
}

function resolveError(err: unknown, fallback: string): string {
  return getApiErrorMessage(err, fallback)
}

function expenseLabel(category: BuildingExpense['category']) {
  return EXPENSE_CATEGORY_LABELS[category]
}

/** Color a signed value: green when positive, red when negative. */
function signedClass(value: number): string {
  if (value > 0) return 'text-status-success'
  if (value < 0) return 'text-status-danger'
  return 'text-ui-primary'
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Báo cáo vận hành"
      description="Doanh thu, chi phí và lợi nhuận theo tòa nhà từng tháng."
    >
      <template #actions>
        <UiBadge
          v-if="report"
          :variant="isReportClosed ? 'success' : 'warning'"
        >
          {{ isReportClosed ? 'Đã chốt báo cáo' : 'Đang mở' }}
        </UiBadge>
        <UiButton
          v-if="canCloseReport && report && !isReportClosed"
          size="sm"
          :loading="closingReport"
          :disabled="isLoading"
          @click="closeCurrentReport"
        >
          <IconLock class="h-4 w-4" aria-hidden="true" />
          Chốt báo cáo
        </UiButton>
        <UiButton
          v-if="canReopenReport && report && isReportClosed"
          size="sm"
          variant="secondary"
          :loading="reopeningReport"
          :disabled="isLoading"
          @click="reopenCurrentReport"
        >
          <IconRefresh class="h-4 w-4" aria-hidden="true" />
          Mở lại
        </UiButton>
        <UiDropdownMenu v-if="(canRefreshReserveAccrual && !!report) || canExportReport">
          <UiDropdownMenuItem
            v-if="canRefreshReserveAccrual && report"
            :loading="refreshingReserve"
            :disabled="isLoading"
            @click="refreshCurrentReserveAccrual"
          >
            <template #icon>
              <IconRefresh class="h-4 w-4 shrink-0" aria-hidden="true" />
            </template>
            Cập nhật quỹ
          </UiDropdownMenuItem>
          <UiDropdownMenuItem
            v-if="canExportReport"
            :loading="exportLoading"
            :disabled="!report || isLoading"
            @click="exportReportXlsx"
          >
            <template #icon>
              <IconDownload class="h-4 w-4 shrink-0" aria-hidden="true" />
            </template>
            Xuất Excel
          </UiDropdownMenuItem>
        </UiDropdownMenu>
      </template>
    </UiPageHeader>

    <OperationsReportFilterBar
      :building-value="buildingModel"
      :year-value="yearModel"
      :month-value="monthModel"
      :expense-category-value="expenseCategoryModel"
      :building-options="buildingOptions"
      :year-options="yearOptions"
      :month-options="monthOptions"
      :expense-category-options="expenseCategoryOptions"
      :active-filter-count="activeFilterCount"
      @update:building-value="buildingModel = $event"
      @update:year-value="yearModel = $event"
      @update:month-value="monthModel = $event"
      @update:expense-category-value="expenseCategoryModel = $event"
      @reset="resetFilters"
    />

    <UiAlert v-if="forbidden" severity="danger" class="mb-6">
      Bạn không có quyền xem báo cáo vận hành của tòa nhà này.
    </UiAlert>
    <UiAlert v-else-if="errorMessage" severity="danger" class="mb-6">
      {{ errorMessage }}
    </UiAlert>

    <div v-if="isLoading" class="grid grid-cols-2 gap-2 lg:grid-cols-3">
      <UiSkeleton v-for="n in 6" :key="n" class="h-[72px] rounded-xl" />
    </div>

    <template v-else-if="report && metrics">
      <!-- Headline numbers: revenue, cost and both profit readings in one block -->
      <div class="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <UiMetric label="Doanh thu phát hành" :value="formatCurrency(metrics.issuedRevenue)" />
        <UiMetric label="Đã thu" :value="formatCurrency(metrics.collectedCash)" tone="accent" />
        <UiMetric
          label="Công nợ"
          :value="formatCurrency(metrics.debt)"
          :tone="metrics.debt > 0 ? 'warning' : 'default'"
        />
        <UiMetric label="Tổng chi phí" :value="formatCurrency(metrics.totalExpense)" />
        <UiMetric
          label="Lợi nhuận (phát hành)"
          :value="formatCurrency(metrics.profitByRevenue)"
          :tone="metrics.profitByRevenue >= 0 ? 'success' : 'danger'"
          caption="Doanh thu phát hành − tổng chi phí"
        />
        <UiMetric
          label="Lợi nhuận (tiền thu)"
          :value="formatCurrency(metrics.profitByCash)"
          :tone="metrics.profitByCash >= 0 ? 'success' : 'danger'"
          caption="Tiền đã thu − tổng chi phí"
        />
      </div>

      <div v-if="metrics.settlementAllocationTotal || metrics.refundTotal" class="mt-2 grid grid-cols-2 gap-2">
        <UiMetric label="Cấn trừ tiền có sẵn" :value="formatCurrency(metrics.settlementAllocationTotal)" caption="Đã áp dụng vào hóa đơn, không phải khoản thu mới" />
        <UiMetric label="Đã hoàn tiền" :value="formatCurrency(metrics.refundTotal)" caption="Hoàn tiền khách, không tính vào chi phí vận hành" />
      </div>

      <UiSection title="Cơ cấu doanh thu và chi phí" class="mt-6">
        <div class="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] md:items-start">
          <UiListPanel
            title="Doanh thu theo loại"
            :total="formatCurrency(metrics.issuedRevenue)"
            :empty="revenueRows.length === 0"
            empty-text="Kỳ này chưa phát hành hóa đơn."
          >
            <li
              v-for="row in revenueRows"
              :key="row.key"
              class="flex items-baseline justify-between gap-3 px-3.5 py-2"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm text-ui-primary">{{ row.label }}</span>
                <span v-if="row.utility" class="mt-0.5 block text-[11px] text-ui-muted">
                  Đầu vào <span class="tabular-nums">{{ formatCurrency(row.utility.input) }}</span>
                  ·
                  <span :class="signedClass(row.utility.margin)" class="font-medium tabular-nums">
                    chênh {{ formatCurrency(row.utility.margin) }}
                  </span>
                </span>
              </span>
              <span class="shrink-0 text-sm tabular-nums text-ui-primary">{{ formatCurrency(row.amount) }}</span>
            </li>
          </UiListPanel>

          <div class="grid gap-2">
            <UiListPanel
              title="Chi phí cố định"
              :empty="report.fixedCosts.length === 0"
              empty-text="Thêm tiền thuê nhà để tính lợi nhuận chính xác."
            >
              <li
                v-for="fc in report.fixedCosts"
                :key="fc.id"
                class="flex items-baseline justify-between gap-3 px-3.5 py-2"
              >
                <span class="min-w-0">
                  <span class="block truncate text-sm text-ui-primary">Tiền thuê nhà</span>
                  <span class="mt-0.5 block text-[11px] text-ui-muted">
                    Từ {{ fc.effectiveFromPeriodMonth }}/{{ fc.effectiveFromPeriodYear }}
                    <template v-if="fc.effectiveToPeriodYear">
                      đến {{ fc.effectiveToPeriodMonth }}/{{ fc.effectiveToPeriodYear }}
                    </template>
                  </span>
                </span>
                <span class="shrink-0 text-sm tabular-nums text-ui-primary">{{ formatCurrency(fc.amount) }}</span>
              </li>
            </UiListPanel>

            <UiListPanel
              title="Chi phí trả trước · phân bổ kỳ này"
              :empty="report.prepaidItems.length === 0"
              empty-text="Các khoản trả trước đang hiệu lực sẽ được phân bổ tại đây."
            >
              <li
                v-for="item in report.prepaidItems"
                :key="item.id"
                class="flex items-baseline justify-between gap-3 px-3.5 py-2"
              >
                <span class="min-w-0">
                  <span class="block truncate text-sm text-ui-primary">{{ item.name }}</span>
                  <span
                    v-if="EXPENSE_CATEGORY_LABELS[item.category] !== item.name"
                    class="mt-0.5 block text-[11px] text-ui-muted"
                  >
                    {{ EXPENSE_CATEGORY_LABELS[item.category] }}
                  </span>
                </span>
                <span class="shrink-0 text-sm tabular-nums text-ui-primary">
                  {{ formatCurrency(item.monthlyAmount) }}
                </span>
              </li>
            </UiListPanel>
          </div>
        </div>
      </UiSection>

      <UiSection
        v-if="canReadRecurring && upcomingRecurringExpenses.length > 0"
        title="Nhắc chi phí sắp đến hạn"
        class="mt-6"
      >
        <div class="overflow-hidden rounded-xl border border-ui-border bg-ui-surface divide-y divide-ui-border">
          <div
            v-for="item in upcomingRecurringExpenses"
            :key="item.id"
            class="flex items-center justify-between gap-3 px-3.5 py-2.5"
          >
            <div class="min-w-0">
              <p class="truncate text-sm text-ui-primary">{{ item.name }}</p>
              <p class="mt-0.5 text-[11px] text-ui-muted">
                {{ EXPENSE_CATEGORY_LABELS[item.category] }} · {{ item.nextReminderAt }} ·
                <span class="tabular-nums">{{ formatCurrency(item.estimatedAmount) }}</span>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <UiButton v-if="canWriteExpense" size="sm" @click="recordReminder(item)">
                Ghi nhận
              </UiButton>
              <UiButton size="sm" variant="ghost" @click="dismissReminder(item)">
                Bỏ qua
              </UiButton>
            </div>
          </div>
        </div>
      </UiSection>

      <UiSection v-if="canReadReserveFund && report.reserveFund" title="Quỹ dự phòng" class="mt-6">
        <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <UiMetric
            label="Tỷ lệ"
            :value="`${report.reserveFund.effectiveRatePercent}%`"
            caption="Áp dụng cho kỳ này"
          />
          <UiMetric
            label="Tiền quỹ tháng"
            :value="formatCurrency(report.reserveFund.monthlyAccrualIsEstimated ? report.reserveFund.monthlyAccrualEstimated : report.reserveFund.monthlyAccrual)"
            :caption="report.reserveFund.monthlyAccrualIsEstimated ? 'Ước tính (chưa chốt báo cáo)' : 'Đã chốt báo cáo'"
            tone="success"
          />
          <UiMetric
            label="Số dư tháng"
            :value="formatCurrency(report.reserveFund.monthlyBalance)"
            :tone="report.reserveFund.monthlyBalance >= 0 ? 'success' : 'danger'"
            caption="Tiền quỹ − Chi từ quỹ"
          />
          <UiMetric
            label="Tổng quỹ tòa nhà"
            :value="formatCurrency(report.reserveFund.cumulativeBalance)"
            :tone="report.reserveFund.cumulativeBalance >= 0 ? 'success' : 'danger'"
            :caption="report.reserveFund.cumulativeBalanceIsEstimated ? 'Ước tính theo kỳ đang mở' : 'Theo số đã chốt'"
          />
        </div>
      </UiSection>

      <!-- Expenses -->
      <UiSection title="Chi phí phát sinh trong tháng" class="mt-6">
        <template #actions>
          <span class="text-sm font-semibold tabular-nums text-ui-primary">
            {{ formatCurrency(expenseCategory ? filteredExpenseTotal : metrics.monthlyExpenseTotal) }}
          </span>
          <UiButton v-if="canWriteExpense" size="sm" @click="openCreateExpense">
            <IconPlus class="h-4 w-4" aria-hidden="true" />
            Thêm chi phí
          </UiButton>
        </template>
        <div class="overflow-hidden rounded-xl border border-ui-border bg-ui-surface">
          <table class="hidden w-full text-sm md:table">
            <thead>
              <tr class="border-b border-ui-border text-left text-xs text-ui-muted">
                <th class="px-4 py-2.5 font-medium">Loại</th>
                <th class="px-4 py-2.5 font-medium">Ngày</th>
                <th class="px-4 py-2.5 font-medium">Nhận</th>
                <th class="px-4 py-2.5 font-medium">Biên lai</th>
                <th class="px-4 py-2.5 text-right font-medium">Số tiền</th>
                <th class="px-4 py-2.5 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ui-border">
              <tr
                v-for="e in filteredExpenses"
                :key="e.id"
                :class="{ 'opacity-50': e.voidedAt }"
              >
                <td class="px-4 py-2.5">
                  <span class="text-ui-primary">{{ expenseLabel(e.category) }}</span>
                  <UiBadge v-if="e.voidedAt" class="ml-2" variant="danger">Đã hủy</UiBadge>
                  <UiBadge v-if="e.fundedBy === 'reserve_fund'" class="ml-2" variant="accent">
                    Quỹ dự phòng
                  </UiBadge>
                  <p v-if="e.note" class="text-xs text-ui-muted mt-0.5">{{ e.note }}</p>
                </td>
                <td class="px-4 py-2.5 text-ui-muted">{{ e.expenseDate ?? '—' }}</td>
                <td class="px-4 py-2.5 text-ui-muted">{{ e.payee ?? '—' }}</td>
                <td class="px-4 py-2.5">
                  <a
                    v-if="e.receiptSignedUrl"
                    :href="e.receiptSignedUrl"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-1 text-sm text-ui-accent hover:text-ui-accent/80"
                  >
                    <IconLink class="h-4 w-4" aria-hidden="true" />
                    Xem
                  </a>
                  <span v-else class="text-ui-muted">—</span>
                </td>
                <td class="px-4 py-2.5 text-right tabular-nums text-ui-primary">
                  {{ formatCurrency(e.amount) }}
                </td>
                <td class="px-4 py-2.5">
                  <div class="flex justify-end gap-1">
                    <UiButton
                      v-if="canWriteExpense && !e.voidedAt"
                      size="sm"
                      variant="ghost"
                      icon-only
                      aria-label="Sửa"
                      @click="openEditExpense(e)"
                    >
                      <IconPencilSquare class="h-4 w-4" aria-hidden="true" />
                    </UiButton>
                    <UiButton
                      v-if="canWriteExpense && e.receiptUrl && !e.voidedAt"
                      size="sm"
                      variant="ghost"
                      icon-only
                      aria-label="Xoá biên lai"
                      @click="removeReceipt(e)"
                    >
                      <IconX class="h-4 w-4" aria-hidden="true" />
                    </UiButton>
                    <UiButton
                      v-if="canVoidExpense && !e.voidedAt"
                      size="sm"
                      variant="ghost"
                      icon-only
                      aria-label="Hủy"
                      @click="openVoid(e)"
                    >
                      <IconTrash class="h-4 w-4" aria-hidden="true" />
                    </UiButton>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredExpenses.length === 0">
                <td colspan="6" class="px-5 py-8">
                  <UiEmptyState
                    size="sm"
                    :title="expenseCategory ? 'Không có chi phí phù hợp' : 'Chưa có chi phí'"
                    :description="expenseCategory ? 'Đổi loại chi để xem các khoản khác trong tháng.' : 'Ghi nhận chi phí phát sinh để theo dõi lợi nhuận thực tế.'"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Mobile: two-line rows with the row actions folded into a menu -->
          <div class="divide-y divide-ui-border md:hidden">
            <div
              v-for="e in filteredExpenses"
              :key="e.id"
              :class="clsx('flex items-start justify-between gap-3 px-3.5 py-2.5', e.voidedAt && 'opacity-50')"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-3">
                  <span class="min-w-0 truncate text-sm font-medium text-ui-primary">
                    {{ expenseLabel(e.category) }}
                  </span>
                  <span class="shrink-0 text-sm font-semibold tabular-nums text-ui-primary">
                    {{ formatCurrency(e.amount) }}
                  </span>
                </div>
                <div class="mt-0.5 flex min-w-0 items-center gap-x-1.5 text-[11px] text-ui-muted">
                  <span class="shrink-0">{{ e.expenseDate ?? '—' }}</span>
                  <span v-if="e.payee" class="truncate">· {{ e.payee }}</span>
                  <span v-if="e.note" class="truncate">· {{ e.note }}</span>
                  <UiBadge v-if="e.voidedAt" variant="danger">Đã hủy</UiBadge>
                  <UiBadge v-else-if="e.fundedBy === 'reserve_fund'" variant="accent">Quỹ</UiBadge>
                  <a
                    v-if="e.receiptSignedUrl"
                    :href="e.receiptSignedUrl"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex shrink-0 items-center gap-0.5 text-ui-accent"
                  >
                    <IconLink class="h-3 w-3" aria-hidden="true" />
                    Biên lai
                  </a>
                </div>
              </div>
              <UiDropdownMenu
                v-if="!e.voidedAt && (canWriteExpense || canVoidExpense)"
                class="shrink-0"
                :aria-label="`Thao tác ${expenseLabel(e.category)}`"
                trigger-class="min-h-11 min-w-11"
              >
                <UiDropdownMenuItem v-if="canWriteExpense" @click="openEditExpense(e)">
                  <template #icon>
                    <IconPencilSquare class="h-4 w-4 shrink-0" aria-hidden="true" />
                  </template>
                  Sửa
                </UiDropdownMenuItem>
                <UiDropdownMenuItem
                  v-if="canWriteExpense && e.receiptUrl"
                  @click="removeReceipt(e)"
                >
                  <template #icon>
                    <IconX class="h-4 w-4 shrink-0" aria-hidden="true" />
                  </template>
                  Xoá biên lai
                </UiDropdownMenuItem>
                <UiDropdownMenuItem v-if="canVoidExpense" variant="danger" @click="openVoid(e)">
                  <template #icon>
                    <IconTrash class="h-4 w-4 shrink-0" aria-hidden="true" />
                  </template>
                  Hủy chi phí
                </UiDropdownMenuItem>
              </UiDropdownMenu>
            </div>
            <div v-if="filteredExpenses.length === 0">
              <UiEmptyState
                size="sm"
                :title="expenseCategory ? 'Không có chi phí phù hợp' : 'Chưa có chi phí'"
                :description="expenseCategory ? 'Đổi loại chi để xem các khoản khác trong tháng.' : 'Ghi nhận chi phí phát sinh để theo dõi lợi nhuận thực tế.'"
              />
            </div>
          </div>
        </div>
      </UiSection>
    </template>

    <!-- Modals -->
    <OperationsExpenseModal
      v-if="buildingId"
      :open="expenseModalOpen"
      :expense="editingExpense"
      :prefill="expensePrefill"
      :building-id="buildingId"
      :period-year="periodYear"
      :period-month="periodMonth"
      :can-use-reserve="canManageReserveFund"
      :submitting="savingExpense"
      @close="expenseModalOpen = false"
      @submit="submitExpense"
    />

    <UiModal :open="voidModalOpen" title="Hủy chi phí" size="sm" @close="voidModalOpen = false">
      <div class="space-y-3">
        <p class="text-sm text-ui-muted">
          Chi phí sẽ được đánh dấu đã hủy và không tính vào tổng chi phí. Vui lòng nhập lý do.
        </p>
        <UiTextarea v-model="voidReason" label="Lý do hủy" :rows="3" required />
        <UiAlert v-if="voidError" severity="danger">{{ voidError }}</UiAlert>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" :disabled="voiding" @click="voidModalOpen = false">
            Đóng
          </UiButton>
          <UiButton variant="danger" :loading="voiding" @click="submitVoid">Hủy chi phí</UiButton>
        </div>
      </template>
    </UiModal>
  </div>
</template>
