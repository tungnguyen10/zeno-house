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
} = useOperationsMutations()
const {
  upcomingRecurringExpenses,
  recordRecurringExpense,
  dismissRecurringExpense,
  refreshUpcomingRecurringExpenses,
} = useRecurringExpenses(buildingId)

// --- Capability gates ---------------------------------------------------
const canWriteExpense = computed(() => auth.can('building-expenses.write'))
const canVoidExpense = computed(() => auth.can('building-expenses.delete'))
const canExportReport = computed(() => auth.can('operations-report.export'))
const canReadRecurring = computed(() => auth.can('recurring-expenses.read'))
const canReadReserveFund = computed(() => auth.can('reserve-fund.read'))
const canManageReserveFund = computed(() => auth.can('reserve-fund.manage'))
const exportLoading = ref(false)

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

// --- Filter options -----------------------------------------------------
const buildingOptions = computed(() =>
  buildings.value.map(b => ({ value: b.id, label: b.name })),
)
const now = new Date()
const yearOptions = computed(() =>
  [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => ({
    value: y,
    label: String(y),
  })),
)
const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `Tháng ${i + 1}`,
}))

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
    <div class="mb-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <UiSelect
        v-model="buildingModel"
        label="Tòa nhà"
        :options="buildingOptions"
        placeholder="Chọn tòa nhà"
        class="col-span-2 sm:min-w-[200px]"
      />
      <UiSelect v-model="yearModel" label="Năm" :options="yearOptions" class="sm:w-32" />
      <UiSelect v-model="monthModel" label="Tháng" :options="monthOptions" class="sm:w-36" />
      <UiSelect
        v-model="expenseCategoryModel"
        label="Loại chi"
        :options="expenseCategoryOptions"
        class="col-span-2 sm:min-w-[190px]"
      />
    </div>

    <UiAlert v-if="forbidden" severity="danger" class="mb-6">
      Bạn không có quyền xem báo cáo vận hành của tòa nhà này.
    </UiAlert>
    <UiAlert v-else-if="errorMessage" severity="danger" class="mb-6">
      {{ errorMessage }}
    </UiAlert>

    <div v-if="isLoading" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <UiSkeleton v-for="n in 4" :key="n" class="h-20 rounded-xl" />
    </div>

    <template v-else-if="report && metrics">
      <!-- Core KPIs -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <UiMetric label="Doanh thu phát hành" :value="formatCurrency(metrics.issuedRevenue)" />
        <UiMetric label="Đã thu" :value="formatCurrency(metrics.collectedCash)" tone="accent" />
        <UiMetric
          label="Công nợ"
          :value="formatCurrency(metrics.debt)"
          :tone="metrics.debt > 0 ? 'warning' : 'default'"
        />
        <UiMetric label="Tổng chi phí" :value="formatCurrency(metrics.totalExpense)" />
      </div>

      <!-- Profit highlight -->
      <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        class="mt-8"
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

      <UiSection v-if="canReadReserveFund && report.reserveFund" title="Quỹ dự phòng" class="mt-8">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <UiMetric
            label="Tỷ lệ"
            :value="`${report.reserveFund.effectiveRatePercent}%`"
            caption="Áp dụng cho kỳ này"
          />
          <UiMetric
            label="Tiền quỹ tháng"
            :value="formatCurrency(report.reserveFund.monthlyAccrualIsEstimated ? report.reserveFund.monthlyAccrualEstimated : report.reserveFund.monthlyAccrual)"
            :caption="report.reserveFund.monthlyAccrualIsEstimated ? 'Ước tính (chưa chốt kỳ)' : 'Đã chốt kỳ'"
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

      <!-- Utility margins -->
      <div class="mt-8 grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-dark-border bg-dark-surface p-4 sm:p-5">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white">Điện — chênh lệch</h3>
            <span :class="signedClass(report.electricity.margin)" class="text-sm font-semibold tabular-nums">
              {{ formatCurrency(report.electricity.margin) }}
            </span>
          </div>
          <dl class="mt-3 space-y-1.5 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted">Thu từ khách</dt>
              <dd class="tabular-nums text-white">{{ formatCurrency(report.electricity.collected) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted">Đầu vào</dt>
              <dd class="tabular-nums text-white">{{ formatCurrency(report.electricity.input) }}</dd>
            </div>
          </dl>
        </div>
        <div class="rounded-2xl border border-dark-border bg-dark-surface p-4 sm:p-5">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white">Nước — chênh lệch</h3>
            <span :class="signedClass(report.water.margin)" class="text-sm font-semibold tabular-nums">
              {{ formatCurrency(report.water.margin) }}
            </span>
          </div>
          <dl class="mt-3 space-y-1.5 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted">Thu từ khách</dt>
              <dd class="tabular-nums text-white">{{ formatCurrency(report.water.collected) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted">Đầu vào</dt>
              <dd class="tabular-nums text-white">{{ formatCurrency(report.water.input) }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Revenue breakdown -->
      <UiSection title="Doanh thu theo loại" class="mt-8">
        <template #actions>
          <span class="text-sm font-semibold tabular-nums text-white">
            {{ formatCurrency(metrics.issuedRevenue) }}
          </span>
        </template>
        <div class="rounded-2xl border border-dark-border bg-dark-surface divide-y divide-dark-border">
          <div
            v-for="row in report.revenueByType"
            :key="row.key"
            class="flex items-center justify-between px-4 py-3 text-sm sm:px-5"
          >
            <span class="text-muted">{{ row.label }}</span>
            <span class="tabular-nums text-white">{{ formatCurrency(row.amount) }}</span>
          </div>
          <div v-if="report.revenueByType.length === 0" class="px-5 py-6">
            <UiEmptyState title="Chưa có doanh thu" description="Kỳ này chưa phát hành hóa đơn." />
          </div>
        </div>
      </UiSection>

      <!-- Fixed costs -->
      <UiSection title="Chi phí cố định" class="mt-8">
        <template #actions>
          <span class="text-sm font-semibold tabular-nums text-white">
            {{ formatCurrency(metrics.fixedCostTotal) }}
          </span>
        </template>
        <div class="rounded-2xl border border-dark-border bg-dark-surface divide-y divide-dark-border">
          <div
            v-for="fc in report.fixedCosts"
            :key="fc.id"
            class="flex items-center justify-between px-4 py-3 text-sm sm:px-5"
          >
            <div>
              <span class="text-white">Tiền thuê nhà</span>
              <span class="ml-2 text-xs text-muted">
                từ {{ fc.effectiveFromPeriodMonth }}/{{ fc.effectiveFromPeriodYear }}
                <template v-if="fc.effectiveToPeriodYear">
                  đến {{ fc.effectiveToPeriodMonth }}/{{ fc.effectiveToPeriodYear }}
                </template>
              </span>
            </div>
            <span class="tabular-nums text-white">{{ formatCurrency(fc.amount) }}</span>
          </div>
          <div v-if="report.fixedCosts.length === 0" class="px-5 py-6">
            <UiEmptyState
              title="Chưa có chi phí cố định"
              description="Thêm tiền thuê nhà để tính lợi nhuận chính xác."
            />
          </div>
        </div>
      </UiSection>

      <UiSection title="Chi phí trả trước (phân bổ)" class="mt-8">
        <template #actions>
          <span class="text-sm font-semibold tabular-nums text-white">
            {{ formatCurrency(metrics.prepaidAllocationTotal) }}
          </span>
        </template>
        <div class="rounded-2xl border border-dark-border bg-dark-surface divide-y divide-dark-border">
          <div
            v-for="item in report.prepaidItems"
            :key="item.id"
            class="flex items-center justify-between px-4 py-3 text-sm sm:px-5"
          >
            <div>
              <span class="text-white">{{ item.name }}</span>
              <span class="ml-2 text-xs text-muted">{{ EXPENSE_CATEGORY_LABELS[item.category] }}</span>
            </div>
            <span class="tabular-nums text-white">{{ formatCurrency(item.monthlyAmount) }}</span>
          </div>
          <div v-if="report.prepaidItems.length === 0" class="px-5 py-6">
            <UiEmptyState
              title="Chưa có chi phí trả trước"
              description="Các khoản trả trước đang hiệu lực sẽ được phân bổ tại đây."
            />
          </div>
        </div>
      </UiSection>

      <!-- Expenses -->
      <UiSection title="Chi phí phát sinh trong tháng" class="mt-8">
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
