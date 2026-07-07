<script setup lang="ts">
import clsx from 'clsx'
import { computed, ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
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
  const body = (err as { data?: { error?: { message?: string } } })?.data
  return body?.error?.message ?? fallback
}

function expenseLabel(category: BuildingExpense['category']) {
  return EXPENSE_CATEGORY_LABELS[category]
}

/** Color a signed value: green when positive, red when negative. */
function signedClass(value: number): string {
  if (value > 0) return 'text-success-neon'
  if (value < 0) return 'text-error-vivid'
  return 'text-white'
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
          v-if="canRefreshReserveAccrual && report"
          size="sm"
          variant="secondary"
          :loading="refreshingReserve"
          :disabled="isLoading"
          @click="refreshCurrentReserveAccrual"
        >
          <IconRefresh class="h-4 w-4" aria-hidden="true" />
          Cập nhật quỹ
        </UiButton>
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
        <UiButton
          v-if="canExportReport"
          size="sm"
          variant="secondary"
          :loading="exportLoading"
          :disabled="!report || isLoading"
          @click="exportReportXlsx"
        >
          <IconDownload class="h-4 w-4" aria-hidden="true" />
          Xuất Excel
        </UiButton>
      </template>
    </UiPageHeader>

    <!-- Filters -->
    <div class="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <UiSelect
        v-model="buildingModel"
        aria-label="Tòa nhà"
        :options="buildingOptions"
        placeholder="Tòa nhà"
        class="col-span-2 sm:min-w-[200px]"
      />
      <UiSelect v-model="yearModel" aria-label="Năm" :options="yearOptions" class="sm:w-28" />
      <UiSelect v-model="monthModel" aria-label="Tháng" :options="monthOptions" class="sm:w-32" />
      <UiSelect
        v-model="expenseCategoryModel"
        aria-label="Loại chi"
        :options="expenseCategoryOptions"
        class="col-span-2 sm:min-w-[170px]"
      />
    </div>

    <UiAlert v-if="forbidden" severity="danger" class="mb-6">
      Bạn không có quyền xem báo cáo vận hành của tòa nhà này.
    </UiAlert>
    <UiAlert v-else-if="errorMessage" severity="danger" class="mb-6">
      {{ errorMessage }}
    </UiAlert>

    <div v-if="isLoading" class="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <UiSkeleton v-for="n in 4" :key="n" class="h-[72px] rounded-xl" />
    </div>

    <template v-else-if="report && metrics">
      <!-- Financial overview + composition -->
      <UiSection title="Cơ cấu doanh thu và chi phí">
        <!-- Core KPIs -->
        <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <UiMetric label="Doanh thu phát hành" :value="formatCurrency(metrics.issuedRevenue)" />
          <UiMetric label="Đã thu" :value="formatCurrency(metrics.collectedCash)" tone="accent" />
          <UiMetric
            label="Công nợ"
            :value="formatCurrency(metrics.debt)"
            :tone="metrics.debt > 0 ? 'warning' : 'default'"
          />
          <UiMetric label="Tổng chi phí" :value="formatCurrency(metrics.totalExpense)" />
        </div>

        <div class="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
          <div class="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
            <div class="border-b border-dark-border px-3 py-2 sm:px-4">
              <h3 class="text-sm font-semibold text-white">Doanh thu theo loại</h3>
            </div>

            <div class="divide-y divide-dark-border">
              <div
                v-for="row in revenueRows"
                :key="row.key"
                class="px-3 py-2 sm:px-4"
              >
                <div class="flex items-center justify-between gap-3 text-sm">
                  <span class="min-w-0 truncate text-muted">{{ row.label }}</span>
                  <span class="shrink-0 tabular-nums text-white">{{ formatCurrency(row.amount) }}</span>
                </div>
                <p
                  v-if="row.utility"
                  class="mt-1 flex items-center gap-x-2 text-xs text-muted"
                >
                  <span class="tabular-nums">Đầu vào {{ formatCurrency(row.utility.input) }}</span>
                  <span aria-hidden="true" class="text-dark-border">·</span>
                  <span
                    :class="signedClass(row.utility.margin)"
                    class="font-medium tabular-nums"
                  >
                    Chênh {{ formatCurrency(row.utility.margin) }}
                  </span>
                </p>
              </div>
              <div v-if="report.revenueByType.length === 0" class="px-5 py-6">
                <UiEmptyState title="Chưa có doanh thu" description="Kỳ này chưa phát hành hóa đơn." />
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
            <div class="grid divide-y divide-dark-border">
              <div>
                <div class="flex items-center justify-between gap-3 border-b border-dark-border px-3 py-2 sm:px-4">
                  <h3 class="text-sm font-semibold text-white">Chi phí cố định</h3>
                </div>

                <div class="divide-y divide-dark-border">
                  <div
                    v-for="fc in report.fixedCosts"
                    :key="fc.id"
                    class="flex items-start justify-between gap-3 px-3 py-2 text-sm sm:px-4"
                  >
                    <div class="min-w-0">
                      <span class="text-white">Tiền thuê nhà</span>
                      <p class="mt-0.5 text-xs text-muted">
                        Từ {{ fc.effectiveFromPeriodMonth }}/{{ fc.effectiveFromPeriodYear }}
                        <template v-if="fc.effectiveToPeriodYear">
                          đến {{ fc.effectiveToPeriodMonth }}/{{ fc.effectiveToPeriodYear }}
                        </template>
                      </p>
                    </div>
                    <span class="shrink-0 tabular-nums text-white">{{ formatCurrency(fc.amount) }}</span>
                  </div>
                  <div v-if="report.fixedCosts.length === 0" class="px-5 py-6">
                    <UiEmptyState
                      title="Chưa có chi phí cố định"
                      description="Thêm tiền thuê nhà để tính lợi nhuận chính xác."
                    />
                  </div>
                </div>
              </div>

              <div class="">
                <div class="flex items-start justify-between gap-3 border-b border-dark-border px-3 py-2.5 sm:px-4">
                  <div>
                    <p class="text-[11px] uppercase tracking-wide text-muted">Phân bổ kỳ này</p>
                    <h3 class="text-sm font-semibold text-white">Chi phí trả trước</h3>
                  </div>
                </div>

                <div class="divide-y divide-dark-border">
                  <div
                    v-for="item in report.prepaidItems"
                    :key="item.id"
                    class="flex items-start justify-between gap-3 px-3 py-2 text-sm sm:px-4"
                  >
                    <div class="min-w-0">
                      <span class="text-white">{{ item.name }}</span>
                      <p
                        v-if="EXPENSE_CATEGORY_LABELS[item.category] !== item.name"
                        class="mt-0.5 text-xs text-muted"
                      >
                        {{ EXPENSE_CATEGORY_LABELS[item.category] }}
                      </p>
                    </div>
                    <span class="shrink-0 tabular-nums text-white">{{ formatCurrency(item.monthlyAmount) }}</span>
                  </div>
                  <div v-if="report.prepaidItems.length === 0" class="px-5 py-6">
                    <UiEmptyState
                      title="Chưa có chi phí trả trước"
                      description="Các khoản trả trước đang hiệu lực sẽ được phân bổ tại đây."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UiSection>

      <!-- Profit highlight -->
      <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <UiMetric
          label="Lợi nhuận (theo phát hành)"
          :value="formatCurrency(metrics.profitByRevenue)"
          :tone="metrics.profitByRevenue >= 0 ? 'success' : 'danger'"
          caption="Doanh thu phát hành − tổng chi phí"
        />
        <UiMetric
          label="Lợi nhuận (theo tiền thu)"
          :value="formatCurrency(metrics.profitByCash)"
          :tone="metrics.profitByCash >= 0 ? 'success' : 'danger'"
          caption="Tiền đã thu − tổng chi phí"
        />
      </div>

      <UiSection
        v-if="canReadRecurring && upcomingRecurringExpenses.length > 0"
        title="Nhắc chi phí sắp đến hạn"
        class="mt-6"
      >
        <div class="rounded-2xl border border-dark-border bg-dark-surface divide-y divide-dark-border">
          <div
            v-for="item in upcomingRecurringExpenses"
            :key="item.id"
            class="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div class="font-medium text-white">{{ item.name }}</div>
              <div class="mt-1 text-xs text-muted">
                {{ EXPENSE_CATEGORY_LABELS[item.category] }} · {{ item.nextReminderAt }}
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 sm:justify-end">
              <span class="tabular-nums text-white">{{ formatCurrency(item.estimatedAmount) }}</span>
              <UiButton v-if="canWriteExpense" size="sm" @click="recordReminder(item)">
                Ghi nhận
              </UiButton>
              <UiButton size="sm" variant="secondary" @click="dismissReminder(item)">
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
          <span class="text-sm font-semibold tabular-nums text-white">
            {{ formatCurrency(expenseCategory ? filteredExpenseTotal : metrics.monthlyExpenseTotal) }}
          </span>
          <UiButton v-if="canWriteExpense" size="sm" @click="openCreateExpense">
            <IconPlus class="h-4 w-4" aria-hidden="true" />
            Thêm chi phí
          </UiButton>
        </template>
        <div class="overflow-hidden rounded-2xl border border-dark-border bg-dark-surface">
          <table class="hidden w-full text-sm md:table">
            <thead>
              <tr class="border-b border-dark-border text-left text-xs text-muted">
                <th class="px-5 py-3 font-medium">Loại</th>
                <th class="px-5 py-3 font-medium">Ngày</th>
                <th class="px-5 py-3 font-medium">Nhận</th>
                <th class="px-5 py-3 font-medium">Biên lai</th>
                <th class="px-5 py-3 text-right font-medium">Số tiền</th>
                <th class="px-5 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-border">
              <tr
                v-for="e in filteredExpenses"
                :key="e.id"
                :class="{ 'opacity-50': e.voidedAt }"
              >
                <td class="px-5 py-3">
                  <span class="text-white">{{ expenseLabel(e.category) }}</span>
                  <UiBadge v-if="e.voidedAt" class="ml-2" variant="danger">Đã hủy</UiBadge>
                  <UiBadge v-if="e.fundedBy === 'reserve_fund'" class="ml-2" variant="accent">
                    Quỹ dự phòng
                  </UiBadge>
                  <p v-if="e.note" class="text-xs text-muted mt-0.5">{{ e.note }}</p>
                </td>
                <td class="px-5 py-3 text-muted">{{ e.expenseDate ?? '—' }}</td>
                <td class="px-5 py-3 text-muted">{{ e.payee ?? '—' }}</td>
                <td class="px-5 py-3">
                  <a
                    v-if="e.receiptSignedUrl"
                    :href="e.receiptSignedUrl"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-1 text-sm text-cyan hover:text-cyan/80"
                  >
                    <IconLink class="h-4 w-4" aria-hidden="true" />
                    Xem
                  </a>
                  <span v-else class="text-muted">—</span>
                </td>
                <td class="px-5 py-3 text-right tabular-nums text-white">
                  {{ formatCurrency(e.amount) }}
                </td>
                <td class="px-5 py-3">
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
                    :title="expenseCategory ? 'Không có chi phí phù hợp' : 'Chưa có chi phí'"
                    :description="expenseCategory ? 'Đổi loại chi để xem các khoản khác trong tháng.' : 'Ghi nhận chi phí phát sinh để theo dõi lợi nhuận thực tế.'"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Mobile: card list -->
          <div class="divide-y divide-dark-border md:hidden">
            <div
              v-for="e in filteredExpenses"
              :key="e.id"
              :class="clsx('flex flex-col gap-2 p-4', e.voidedAt && 'opacity-50')"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-sm font-medium text-white">{{ expenseLabel(e.category) }}</span>
                    <UiBadge v-if="e.voidedAt" variant="danger">Đã hủy</UiBadge>
                    <UiBadge v-if="e.fundedBy === 'reserve_fund'" variant="accent">Quỹ dự phòng</UiBadge>
                  </div>
                  <p v-if="e.note" class="mt-0.5 text-xs text-muted">{{ e.note }}</p>
                </div>
                <span class="shrink-0 text-sm font-semibold tabular-nums text-white">
                  {{ formatCurrency(e.amount) }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span>{{ e.expenseDate ?? '—' }}</span>
                  <span v-if="e.payee" class="truncate">{{ e.payee }}</span>
                  <a
                    v-if="e.receiptSignedUrl"
                    :href="e.receiptSignedUrl"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-1 text-cyan hover:text-cyan/80"
                  >
                    <IconLink class="h-3.5 w-3.5" aria-hidden="true" />
                    Biên lai
                  </a>
                </div>
                <div class="flex shrink-0 items-center gap-1">
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
              </div>
            </div>
            <div v-if="filteredExpenses.length === 0" class="px-4 py-8">
              <UiEmptyState
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
        <p class="text-sm text-muted">
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
