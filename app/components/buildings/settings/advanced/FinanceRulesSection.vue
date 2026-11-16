<script setup lang="ts">
import { getApiErrorMessage } from '~/utils/api-error'
import type {
  BuildingFixedCost,
  BuildingReserveFundRate,
  PrepaidExpense,
  RecurringExpense,
} from '~/types/operations-report'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  FIXED_COST_CATEGORY_LABELS,
  PREPAID_EXPENSE_STATUS_LABELS,
  PREPAID_EXPENSE_STATUSES,
  RECURRING_EXPENSE_FREQUENCIES,
  RECURRING_EXPENSE_FREQUENCY_LABELS,
  type ExpenseCategory,
  type PrepaidExpenseStatus,
  type RecurringExpenseFrequency,
} from '~/utils/constants/operations-report'
import { formatCurrency } from '~/utils/format/currency'
import { currentVietnamPeriod, formatPeriodString, parsePeriodString } from '~/utils/format/period'

const source = useBuildingSettingsSource()
const settings = source.settings
const building = source.building
const settingsStatus = source.status
const refreshSettings = source.refresh
const authStore = useAuthStore()

const canManageFixedCosts = computed(() => authStore.can('building-fixed-costs.write'))
const canManageRecurringExpenses = computed(() => authStore.can('recurring-expenses.write'))
const canManagePrepaidExpenses = computed(() => authStore.can('prepaid-expenses.write'))
const canManageReserveFund = computed(() => authStore.can('reserve-fund.manage'))
const apiBuildingId = computed(() => building.value?.id ?? '')
const now = new Date()
const prepaidCancellationPeriod = currentVietnamPeriod(now)
const prepaidCancellationPeriodParts = parsePeriodString(prepaidCancellationPeriod)!
const prepaidCancellationPeriodLabel = `${String(prepaidCancellationPeriodParts.month).padStart(2, '0')}/${prepaidCancellationPeriodParts.year}`
const fixedCostPeriodYear = ref(now.getFullYear())
const fixedCostPeriodMonth = ref(now.getMonth() + 1)
const fixedCostModalOpen = ref(false)
const savingFixedCost = ref(false)
const endFixedCostModalOpen = ref(false)
const endingFixedCost = ref(false)
const endFixedCostTarget = ref<BuildingFixedCost | null>(null)
const endFixedCostPeriod = ref(formatPeriodString(now.getFullYear(), now.getMonth() + 1))
const fixedCostError = ref<string | null>(null)
const { createFixedCost } = useOperationsMutations()
const refreshReserveRates = refreshSettings
const reserveRates = computed(() => settings.value?.reserveRates ?? [])
const isLoadingReserveRates = computed(() => settingsStatus.value === 'pending')
const reserveRateModalOpen = ref(false)
const savingReserveRate = ref(false)
const reserveRateError = ref<string | null>(null)
const reserveRateForm = reactive({
  reserve_rate_percent: '',
  effective_from_period: formatPeriodString(now.getFullYear(), now.getMonth() + 1),
})
const endReserveRateModalOpen = ref(false)
const endingReserveRate = ref(false)
const endReserveRateTarget = ref<BuildingReserveFundRate | null>(null)
const endReserveRatePeriod = ref(formatPeriodString(now.getFullYear(), now.getMonth() + 1))
const refreshFixedCosts = refreshSettings
const fixedCosts = computed(() => settings.value?.fixedCosts ?? [])
const isLoadingFixedCosts = computed(() => settingsStatus.value === 'pending')
const expenseCategoryOptions = EXPENSE_CATEGORIES.map(value => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}))
const frequencyOptions = RECURRING_EXPENSE_FREQUENCIES.map(value => ({
  value,
  label: RECURRING_EXPENSE_FREQUENCY_LABELS[value],
}))
const prepaidStatusOptions = PREPAID_EXPENSE_STATUSES.map(value => ({
  value,
  label: PREPAID_EXPENSE_STATUS_LABELS[value],
}))
const {
  recurringExpenses,
  isLoadingRecurringExpenses,
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
} = useRecurringExpenses(apiBuildingId, {
  status: settingsStatus,
  refresh: refreshSettings,
  data: computed(() => settings.value?.recurringExpenses ?? []),
})
const {
  prepaidExpenses,
  isLoadingPrepaidExpenses,
  createPrepaidExpense,
  updatePrepaidExpense,
  deletePrepaidExpense,
} = usePrepaidExpenses(apiBuildingId, {
  status: settingsStatus,
  refresh: refreshSettings,
  data: computed(() => settings.value?.prepaidExpenses ?? []),
})
const recurringFormOpen = ref(false)
const editingRecurring = ref<RecurringExpense | null>(null)
const savingRecurring = ref(false)
const recurringError = ref<string | null>(null)
const recurringForm = reactive({
  name: '',
  category: 'staff' as ExpenseCategory,
  frequency: 'monthly' as RecurringExpenseFrequency,
  anchor_day: now.getDate() > 28 ? 28 : now.getDate(),
  estimated_amount: '',
  is_active: true,
})
const recurringNameSuggestions = computed(() => {
  const existingNames = recurringExpenses.value.map(item => item.name)
  const categoryNames = EXPENSE_CATEGORIES.map(category => EXPENSE_CATEGORY_LABELS[category])
  return [...new Set([...existingNames, ...categoryNames])].filter(Boolean)
})
const recurringNameModel = computed<string | null>({
  get: () => recurringForm.name || null,
  set: value => { recurringForm.name = value ?? '' },
})
const prepaidFormOpen = ref(false)
const editingPrepaid = ref<PrepaidExpense | null>(null)
const savingPrepaid = ref(false)
const prepaidError = ref<string | null>(null)
const prepaidDeleteTarget = ref<PrepaidExpense | null>(null)
const deletingPrepaid = ref(false)
const prepaidForm = reactive({
  name: '',
  category: 'internet' as ExpenseCategory,
  total_amount: '',
  total_months: 12,
  start_date: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10),
  status: 'active' as PrepaidExpenseStatus,
  receipt_url: '',
  note: '',
})
const prepaidNameSuggestions = computed(() => {
  const existingNames = prepaidExpenses.value.map(item => item.name)
  const recurringNames = recurringExpenses.value.map(item => item.name)
  const categoryNames = EXPENSE_CATEGORIES.map(category => EXPENSE_CATEGORY_LABELS[category])
  return [...new Set([...existingNames, ...recurringNames, ...categoryNames])].filter(Boolean)
})
const prepaidNameModel = computed<string | null>({
  get: () => prepaidForm.name || null,
  set: value => { prepaidForm.name = value ?? '' },
})

function openCreateReserveRate() {
  reserveRateError.value = null
  reserveRateForm.reserve_rate_percent = ''
  reserveRateForm.effective_from_period = formatPeriodString(
    fixedCostPeriodYear.value,
    fixedCostPeriodMonth.value,
  )
  reserveRateModalOpen.value = true
}

async function submitReserveRate() {
  if (!apiBuildingId.value) return
  const rate = Number(reserveRateForm.reserve_rate_percent)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    reserveRateError.value = 'Tỷ lệ phải nằm trong khoảng 0 đến 100.'
    return
  }
  const period = parsePeriodString(reserveRateForm.effective_from_period)
  if (!period) {
    reserveRateError.value = 'Chọn tháng bắt đầu áp dụng.'
    return
  }
  savingReserveRate.value = true
  reserveRateError.value = null
  try {
    await apiFetch('/api/reserve-fund-rates', {
      method: 'POST',
      body: {
        building_id: apiBuildingId.value,
        reserve_rate_percent: rate,
        effective_from_period_year: period.year,
        effective_from_period_month: period.month,
      },
    })
    reserveRateModalOpen.value = false
    await refreshReserveRates()
  }
  catch (err) {
    reserveRateError.value = resolveApiError(err, 'Không lưu được tỷ lệ quỹ dự phòng.')
  }
  finally {
    savingReserveRate.value = false
  }
}

function openEndReserveRate(rate: BuildingReserveFundRate) {
  endReserveRateTarget.value = rate
  endReserveRatePeriod.value = formatPeriodString(
    fixedCostPeriodYear.value,
    fixedCostPeriodMonth.value,
  )
  reserveRateError.value = null
  endReserveRateModalOpen.value = true
}

async function submitEndReserveRate() {
  if (!endReserveRateTarget.value) return
  const period = parsePeriodString(endReserveRatePeriod.value)
  if (!period) {
    reserveRateError.value = 'Chọn tháng kết thúc.'
    return
  }
  endingReserveRate.value = true
  reserveRateError.value = null
  try {
    await apiFetch(`/api/reserve-fund-rates/${endReserveRateTarget.value.id}`, {
      method: 'PATCH',
      body: {
        effective_to_period_year: period.year,
        effective_to_period_month: period.month,
      },
    })
    endReserveRateModalOpen.value = false
    await refreshReserveRates()
  }
  catch (err) {
    reserveRateError.value = resolveApiError(err, 'Không kết thúc được tỷ lệ quỹ dự phòng.')
  }
  finally {
    endingReserveRate.value = false
  }
}

async function submitFixedCost(payload: Record<string, unknown>) {
  if (!apiBuildingId.value) return
  savingFixedCost.value = true
  fixedCostError.value = null
  try {
    await createFixedCost(payload)
    fixedCostModalOpen.value = false
    await refreshFixedCosts()
  }
  catch (err) {
    fixedCostError.value = resolveApiError(err, 'Không lưu được chi phí vận hành.')
  }
  finally {
    savingFixedCost.value = false
  }
}

function openCreateRecurring() {
  editingRecurring.value = null
  recurringError.value = null
  recurringForm.name = ''
  recurringForm.category = 'staff'
  recurringForm.frequency = 'monthly'
  recurringForm.anchor_day = now.getDate() > 28 ? 28 : now.getDate()
  recurringForm.estimated_amount = ''
  recurringForm.is_active = true
  recurringFormOpen.value = true
}

function openEditRecurring(item: RecurringExpense) {
  editingRecurring.value = item
  recurringError.value = null
  recurringForm.name = item.name
  recurringForm.category = item.category
  recurringForm.frequency = item.frequency
  recurringForm.anchor_day = item.anchorDay
  recurringForm.estimated_amount = String(item.estimatedAmount)
  recurringForm.is_active = item.isActive
  recurringFormOpen.value = true
}

async function submitRecurring() {
  if (!apiBuildingId.value) return
  const amount = Number(recurringForm.estimated_amount)
  if (!recurringForm.name.trim() || !Number.isFinite(amount) || amount < 0) {
    recurringError.value = 'Kiểm tra tên và số tiền dự kiến.'
    return
  }
  savingRecurring.value = true
  recurringError.value = null
  try {
    const payload = {
      building_id: apiBuildingId.value,
      name: recurringForm.name.trim(),
      category: recurringForm.category,
      frequency: recurringForm.frequency,
      anchor_day: Number(recurringForm.anchor_day),
      estimated_amount: amount,
      is_active: recurringForm.is_active,
    }
    if (editingRecurring.value) await updateRecurringExpense(editingRecurring.value.id, payload)
    else await createRecurringExpense(payload)
    recurringFormOpen.value = false
  }
  catch (err) {
    recurringError.value = resolveApiError(err, 'Không lưu được nhắc chi phí.')
  }
  finally {
    savingRecurring.value = false
  }
}

async function removeRecurring(item: RecurringExpense) {
  try {
    await deleteRecurringExpense(item.id)
  }
  catch (err) {
    recurringError.value = resolveApiError(err, 'Không xóa được nhắc chi phí.')
  }
}

function openCreatePrepaid() {
  editingPrepaid.value = null
  prepaidError.value = null
  prepaidForm.name = ''
  prepaidForm.category = 'internet'
  prepaidForm.total_amount = ''
  prepaidForm.total_months = 12
  prepaidForm.start_date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10)
  prepaidForm.status = 'active'
  prepaidForm.receipt_url = ''
  prepaidForm.note = ''
  prepaidFormOpen.value = true
}

function openEditPrepaid(item: PrepaidExpense) {
  editingPrepaid.value = item
  prepaidError.value = null
  prepaidForm.name = item.name
  prepaidForm.category = item.category
  prepaidForm.total_amount = String(item.totalAmount)
  prepaidForm.total_months = item.totalMonths
  prepaidForm.start_date = item.startDate
  prepaidForm.status = item.status
  prepaidForm.receipt_url = item.receiptUrl ?? ''
  prepaidForm.note = item.note ?? ''
  prepaidFormOpen.value = true
}

const prepaidPreview = computed(() => {
  const total = Number(prepaidForm.total_amount)
  const months = Number(prepaidForm.total_months)
  if (!Number.isFinite(total) || !Number.isFinite(months) || months < 1) return null
  const start = new Date(`${prepaidForm.start_date}T00:00:00Z`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate()))
  return {
    monthly: Math.round(total / months),
    endDate: end.toISOString().slice(0, 10),
  }
})

async function submitPrepaid() {
  if (!apiBuildingId.value) return
  const total = Number(prepaidForm.total_amount)
  const months = Number(prepaidForm.total_months)
  if (!prepaidForm.name.trim() || !Number.isFinite(total) || total < 0 || !Number.isInteger(months) || months < 1) {
    prepaidError.value = 'Kiểm tra tên, tổng tiền và số tháng.'
    return
  }
  savingPrepaid.value = true
  prepaidError.value = null
  try {
    const payload = {
      name: prepaidForm.name.trim(),
      category: prepaidForm.category,
      total_amount: total,
      total_months: months,
      start_date: prepaidForm.start_date,
      status: prepaidForm.status,
      receipt_url: prepaidForm.receipt_url.trim() || null,
      note: prepaidForm.note.trim() || null,
    }
    if (editingPrepaid.value) {
      await updatePrepaidExpense(editingPrepaid.value.id, payload)
    }
    else {
      await createPrepaidExpense({ building_id: apiBuildingId.value, ...payload })
    }
    prepaidFormOpen.value = false
    editingPrepaid.value = null
  }
  catch (err) {
    prepaidError.value = resolveApiError(err, 'Không lưu được chi phí trả trước.')
  }
  finally {
    savingPrepaid.value = false
  }
}

function openPrepaidDelete(item: PrepaidExpense) {
  prepaidError.value = null
  prepaidDeleteTarget.value = item
}

function closePrepaidDelete() {
  if (deletingPrepaid.value) return
  prepaidDeleteTarget.value = null
}

async function confirmPrepaidDelete() {
  const target = prepaidDeleteTarget.value
  if (!target || deletingPrepaid.value) return
  deletingPrepaid.value = true
  prepaidError.value = null
  try {
    await deletePrepaidExpense(target.id)
    prepaidDeleteTarget.value = null
  }
  catch (err) {
    prepaidError.value = resolveApiError(err, 'Không xóa được chi phí trả trước.')
  }
  finally {
    deletingPrepaid.value = false
  }
}

function openEndFixedCost(cost: BuildingFixedCost) {
  endFixedCostTarget.value = cost
  endFixedCostPeriod.value = formatPeriodString(
    fixedCostPeriodYear.value,
    fixedCostPeriodMonth.value,
  )
  fixedCostError.value = null
  endFixedCostModalOpen.value = true
}

async function submitEndFixedCost() {
  if (!endFixedCostTarget.value) return
  const period = parsePeriodString(endFixedCostPeriod.value)
  if (!period) {
    fixedCostError.value = 'Chọn tháng kết thúc.'
    return
  }
  endingFixedCost.value = true
  fixedCostError.value = null
  try {
    await apiFetch(`/api/building-fixed-costs/${endFixedCostTarget.value.id}`, {
      method: 'PATCH',
      body: {
        effective_to_period_year: period.year,
        effective_to_period_month: period.month,
      },
    })
    endFixedCostModalOpen.value = false
    await refreshFixedCosts()
  }
  catch (err) {
    fixedCostError.value = resolveApiError(err, 'Không kết thúc được chi phí vận hành.')
  }
  finally {
    endingFixedCost.value = false
  }
}

function resolveApiError(err: unknown, fallback: string): string {
  return getApiErrorMessage(err, fallback)
}
</script>

<template>
  <UiSection
    v-if="canManageFixedCosts"
    title="Chi phí vận hành"
    description="Quản lý chi phí cố định theo tháng cho báo cáo vận hành."
  >
    <template #actions>
      <UiButton size="sm" :disabled="!apiBuildingId" @click="fixedCostModalOpen = true">
        <IconPlus class="h-4 w-4" aria-hidden="true" />
        Thêm chi phí
      </UiButton>
    </template>
    <UiSurfacePanel density="compact">
      <UiAlert v-if="fixedCostError" severity="danger" class="mb-4">
        {{ fixedCostError }}
      </UiAlert>
      <div v-if="isLoadingFixedCosts" class="space-y-2">
        <UiSkeleton v-for="i in 3" :key="i" class="h-14 rounded-lg" />
      </div>
      <div v-else-if="fixedCosts.length === 0" class="text-sm text-ui-muted">
        Chưa có chi phí vận hành cố định.
      </div>
      <div v-else class="divide-y divide-ui-border">
        <div
          v-for="cost in fixedCosts"
          :key="cost.id"
          class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div class="font-medium text-ui-primary">
              {{ FIXED_COST_CATEGORY_LABELS[cost.category] ?? cost.category }}
            </div>
            <div class="mt-1 text-xs text-ui-muted">
              Từ {{ cost.effectiveFromPeriodMonth }}/{{ cost.effectiveFromPeriodYear }}
              <template v-if="cost.effectiveToPeriodYear">
                đến {{ cost.effectiveToPeriodMonth }}/{{ cost.effectiveToPeriodYear }}
              </template>
              <template v-else>
                · đang áp dụng
              </template>
            </div>
            <p v-if="cost.note" class="mt-1 text-xs text-ui-muted">{{ cost.note }}</p>
          </div>
          <div class="flex items-center justify-between gap-3 sm:justify-end">
            <span class="tabular-nums text-ui-primary">{{ formatCurrency(cost.amount) }}</span>
            <UiButton
              v-if="!cost.effectiveToPeriodYear"
              size="sm"
              variant="secondary"
              @click="openEndFixedCost(cost)"
            >
              Kết thúc
            </UiButton>
          </div>
        </div>
      </div>
    </UiSurfacePanel>
  </UiSection>

  <UiSection
    v-if="canManageReserveFund"
    title="Tỷ lệ quỹ dự phòng"
    description="Tỷ lệ trích lập từ doanh thu phát hành khi chốt kỳ vận hành."
  >
    <template #actions>
      <UiButton size="sm" :disabled="!apiBuildingId" @click="openCreateReserveRate">
        <IconPlus class="h-4 w-4" aria-hidden="true" />
        Thêm tỷ lệ
      </UiButton>
    </template>
    <UiSurfacePanel density="compact">
      <UiAlert v-if="reserveRateError" severity="danger" class="mb-4">
        {{ reserveRateError }}
      </UiAlert>
      <div v-if="isLoadingReserveRates" class="space-y-2">
        <UiSkeleton v-for="i in 3" :key="i" class="h-14 rounded-lg" />
      </div>
      <div v-else-if="reserveRates.length === 0" class="text-sm text-ui-muted">
        Chưa có tỷ lệ quỹ dự phòng.
      </div>
      <div v-else class="divide-y divide-ui-border">
        <div
          v-for="rate in reserveRates"
          :key="rate.id"
          class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div class="font-medium text-ui-primary">
              {{ rate.reserveRatePercent }}%
              <UiBadge v-if="!rate.effectiveToPeriodYear" variant="accent" class="ml-2">Đang áp dụng</UiBadge>
            </div>
            <div class="mt-1 text-xs text-ui-muted">
              Từ {{ rate.effectiveFromPeriodMonth }}/{{ rate.effectiveFromPeriodYear }}
              <template v-if="rate.effectiveToPeriodYear">
                đến {{ rate.effectiveToPeriodMonth }}/{{ rate.effectiveToPeriodYear }}
              </template>
            </div>
          </div>
          <UiButton
            v-if="!rate.effectiveToPeriodYear"
            size="sm"
            variant="secondary"
            @click="openEndReserveRate(rate)"
          >
            Kết thúc
          </UiButton>
        </div>
      </div>
    </UiSurfacePanel>
  </UiSection>

  <UiSection
    v-if="canManageRecurringExpenses"
    title="Nhắc chi phí định kỳ"
    description="Các khoản chi cần được nhắc lại và ghi nhận thủ công vào báo cáo tháng."
  >
    <template #actions>
      <UiButton size="sm" :disabled="!apiBuildingId" @click="openCreateRecurring">
        <IconPlus class="h-4 w-4" aria-hidden="true" />
        Thêm nhắc
      </UiButton>
    </template>
    <UiSurfacePanel density="compact">
      <UiAlert v-if="recurringError" severity="danger" class="mb-4">
        {{ recurringError }}
      </UiAlert>
      <div v-if="isLoadingRecurringExpenses" class="space-y-2">
        <UiSkeleton v-for="i in 3" :key="i" class="h-14 rounded-lg" />
      </div>
      <div v-else-if="recurringExpenses.length === 0" class="text-sm text-ui-muted">
        Chưa có nhắc chi phí định kỳ.
      </div>
      <div v-else class="divide-y divide-ui-border">
        <div
          v-for="item in recurringExpenses"
          :key="item.id"
          class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div class="font-medium text-ui-primary">
              {{ item.name }}
              <UiBadge v-if="!item.isActive" variant="warning" class="ml-2">Tắt</UiBadge>
            </div>
            <div class="mt-1 text-xs text-ui-muted">
              {{ EXPENSE_CATEGORY_LABELS[item.category] }} ·
              {{ RECURRING_EXPENSE_FREQUENCY_LABELS[item.frequency] }} ·
              ngày {{ item.anchorDay }} · nhắc tiếp {{ item.nextReminderAt }}
            </div>
          </div>
          <div class="flex items-center justify-between gap-2 sm:justify-end">
            <span class="tabular-nums text-ui-primary">{{ formatCurrency(item.estimatedAmount) }}</span>
            <UiButton size="sm" variant="secondary" @click="openEditRecurring(item)">Sửa</UiButton>
            <UiButton size="sm" variant="ghost" icon-only aria-label="Xóa" @click="removeRecurring(item)">
              <IconTrash class="h-4 w-4" aria-hidden="true" />
            </UiButton>
          </div>
        </div>
      </div>
    </UiSurfacePanel>
  </UiSection>

  <UiSection
    v-if="canManagePrepaidExpenses"
    title="Chi phí trả trước"
    description="Khoản trả một lần được phân bổ đều vào các tháng trong kỳ hiệu lực."
  >
    <template #actions>
      <UiButton size="sm" :disabled="!apiBuildingId" @click="openCreatePrepaid">
        <IconPlus class="h-4 w-4" aria-hidden="true" />
        Thêm trả trước
      </UiButton>
    </template>
    <UiSurfacePanel density="compact">
      <UiAlert v-if="prepaidError" severity="danger" class="mb-4">
        {{ prepaidError }}
      </UiAlert>
      <div v-if="isLoadingPrepaidExpenses" class="space-y-2">
        <UiSkeleton v-for="i in 3" :key="i" class="h-14 rounded-lg" />
      </div>
      <div v-else-if="prepaidExpenses.length === 0" class="text-sm text-ui-muted">
        Chưa có chi phí trả trước.
      </div>
      <div v-else class="divide-y divide-ui-border">
        <div
          v-for="item in prepaidExpenses"
          :key="item.id"
          class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div class="font-medium text-ui-primary">
              {{ item.name }}
              <UiBadge class="ml-2">{{ PREPAID_EXPENSE_STATUS_LABELS[item.status] }}</UiBadge>
            </div>
            <div class="mt-1 text-xs text-ui-muted">
              {{ EXPENSE_CATEGORY_LABELS[item.category] }} · {{ item.startDate }} đến {{ item.endDate }} ·
              {{ item.totalMonths }} tháng
            </div>
            <p v-if="item.note" class="mt-1 text-xs text-ui-muted">{{ item.note }}</p>
          </div>
          <div class="flex items-center justify-between gap-2 sm:justify-end">
            <span class="tabular-nums text-ui-primary">{{ formatCurrency(item.monthlyAmount) }}/tháng</span>
            <UiButton
              v-if="item.status === 'active'"
              size="sm"
              variant="secondary"
              @click="openEditPrepaid(item)"
            >
              Sửa
            </UiButton>
            <UiButton
              v-if="item.status === 'active'"
              size="sm"
              variant="ghost"
              icon-only
              aria-label="Xóa chi phí trả trước"
              @click="openPrepaidDelete(item)"
            >
              <IconTrash class="h-4 w-4" aria-hidden="true" />
            </UiButton>
          </div>
        </div>
      </div>
    </UiSurfacePanel>
  </UiSection>

    <OperationsFixedCostModal
      :open="fixedCostModalOpen"
      :building-id="apiBuildingId"
      :period-year="fixedCostPeriodYear"
      :period-month="fixedCostPeriodMonth"
      :submitting="savingFixedCost"
      @close="fixedCostModalOpen = false"
      @submit="submitFixedCost"
    />
    <UiModal
      :open="endFixedCostModalOpen"
      title="Kết thúc chi phí vận hành"
      size="sm"
      @close="endFixedCostModalOpen = false"
    >
      <div class="space-y-4">
        <p class="text-sm text-ui-muted">
          Chọn kỳ cuối cùng còn áp dụng chi phí này.
        </p>
        <UiDatePicker
          v-model="endFixedCostPeriod"
          label="Tháng kết thúc"
          picker-mode="month"
          required
        />
        <UiAlert v-if="fixedCostError" severity="danger">
          {{ fixedCostError }}
        </UiAlert>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" :disabled="endingFixedCost" @click="endFixedCostModalOpen = false">
            Đóng
          </UiButton>
          <UiButton :loading="endingFixedCost" @click="submitEndFixedCost">
            Lưu
          </UiButton>
        </div>
      </template>
    </UiModal>
    <UiModal
      :open="reserveRateModalOpen"
      title="Thêm tỷ lệ quỹ dự phòng"
      size="sm"
      @close="reserveRateModalOpen = false"
    >
      <div class="space-y-4">
        <UiInput
          v-model="reserveRateForm.reserve_rate_percent"
          label="Tỷ lệ (%)"
          type="number"
          number-mode="percent"
          min="0"
          max="100"
          step="0.01"
          required
        />
        <UiDatePicker
          v-model="reserveRateForm.effective_from_period"
          label="Tháng bắt đầu áp dụng"
          picker-mode="month"
          required
        />
        <UiAlert v-if="reserveRateError" severity="danger">
          {{ reserveRateError }}
        </UiAlert>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" :disabled="savingReserveRate" @click="reserveRateModalOpen = false">
            Đóng
          </UiButton>
          <UiButton :loading="savingReserveRate" @click="submitReserveRate">Lưu</UiButton>
        </div>
      </template>
    </UiModal>
    <UiModal
      :open="endReserveRateModalOpen"
      title="Kết thúc tỷ lệ quỹ dự phòng"
      size="sm"
      @close="endReserveRateModalOpen = false"
    >
      <div class="space-y-4">
        <p class="text-sm text-ui-muted">
          Chọn kỳ cuối cùng còn áp dụng tỷ lệ này.
        </p>
        <UiDatePicker
          v-model="endReserveRatePeriod"
          label="Tháng kết thúc"
          picker-mode="month"
          required
        />
        <UiAlert v-if="reserveRateError" severity="danger">
          {{ reserveRateError }}
        </UiAlert>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" :disabled="endingReserveRate" @click="endReserveRateModalOpen = false">
            Đóng
          </UiButton>
          <UiButton :loading="endingReserveRate" @click="submitEndReserveRate">
            Lưu
          </UiButton>
        </div>
      </template>
    </UiModal>
    <UiModal
      :open="recurringFormOpen"
      :title="editingRecurring ? 'Sửa nhắc chi phí' : 'Thêm nhắc chi phí'"
      size="md"
      @close="recurringFormOpen = false"
    >
      <div class="space-y-4">
        <UiCombobox
          v-model="recurringNameModel"
          label="Tên chi phí"
          :options="recurringNameSuggestions"
          :option-key="name => name"
          :option-label="name => name"
          :create-option="name => name"
          allow-custom
          custom-option-label="Dùng"
          placeholder="Chọn mẫu hoặc nhập tên riêng"
          search-placeholder="Nhập tên chi phí"
          empty-message="Nhập tên mới để dùng"
          required
        />
        <UiSelect v-model="recurringForm.category" label="Loại chi phí" :options="expenseCategoryOptions" />
        <div class="grid grid-cols-2 gap-3">
          <UiSelect v-model="recurringForm.frequency" label="Tần suất" :options="frequencyOptions" />
          <UiInput v-model.number="recurringForm.anchor_day" label="Ngày nhắc" type="number" number-mode="day" min="1" max="28" />
        </div>
        <UiInput
          v-model="recurringForm.estimated_amount"
          label="Số tiền dự kiến"
          type="number"
          number-mode="currency"
          min="0"
          required
        />
        <UiCheckbox v-model="recurringForm.is_active" label="Đang bật" />
        <UiAlert v-if="recurringError" severity="danger">{{ recurringError }}</UiAlert>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" :disabled="savingRecurring" @click="recurringFormOpen = false">
            Đóng
          </UiButton>
          <UiButton :loading="savingRecurring" @click="submitRecurring">Lưu</UiButton>
        </div>
      </template>
    </UiModal>
    <UiModal
      :open="prepaidFormOpen"
      :title="editingPrepaid ? 'Sửa chi phí trả trước' : 'Thêm chi phí trả trước'"
      size="md"
      @close="prepaidFormOpen = false"
    >
      <div class="space-y-4">
        <UiCombobox
          v-model="prepaidNameModel"
          label="Tên chi phí"
          :options="prepaidNameSuggestions"
          :option-key="name => name"
          :option-label="name => name"
          :create-option="name => name"
          allow-custom
          custom-option-label="Dùng"
          placeholder="Chọn mẫu hoặc nhập tên riêng"
          search-placeholder="Nhập tên chi phí"
          empty-message="Nhập tên mới để dùng"
          required
        />
        <UiSelect v-model="prepaidForm.category" label="Loại chi phí" :options="expenseCategoryOptions" />
        <div class="grid grid-cols-2 gap-3">
          <UiInput v-model="prepaidForm.total_amount" label="Tổng tiền" type="number" number-mode="currency" min="0" required />
          <UiInput v-model.number="prepaidForm.total_months" label="Số tháng" type="number" number-mode="integer" min="1" required />
        </div>
        <UiDatePicker v-model="prepaidForm.start_date" label="Ngày bắt đầu" date-mode="period-start" required />
        <UiSelect
          v-if="editingPrepaid"
          v-model="prepaidForm.status"
          label="Trạng thái"
          :options="prepaidStatusOptions"
        />
        <UiTextarea v-model="prepaidForm.note" label="Ghi chú" :rows="2" />
        <div v-if="prepaidPreview" class="rounded-md border border-ui-border bg-ui-deep px-3 py-2 text-sm text-ui-muted">
          ~{{ formatCurrency(prepaidPreview.monthly) }}/tháng · kết thúc {{ prepaidPreview.endDate }}
        </div>
        <UiAlert v-if="prepaidError" severity="danger">{{ prepaidError }}</UiAlert>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" :disabled="savingPrepaid" @click="prepaidFormOpen = false">
            Đóng
          </UiButton>
          <UiButton :loading="savingPrepaid" @click="submitPrepaid">Lưu</UiButton>
        </div>
      </template>
    </UiModal>
    <UiConfirmModal
      :open="Boolean(prepaidDeleteTarget)"
      title="Xóa chi phí trả trước?"
      message=""
      confirm-label="Xóa và ngừng phân bổ"
      :loading="deletingPrepaid"
      @confirm="confirmPrepaidDelete"
      @cancel="closePrepaidDelete"
    >
      <div class="space-y-3">
        <p class="break-words text-sm text-ui-muted">
          Bạn sắp ngừng phân bổ “{{ prepaidDeleteTarget?.name }}”.
          Số liệu các kỳ đã chốt được giữ nguyên. Khoản này sẽ không còn được tính từ
          {{ prepaidCancellationPeriodLabel }}.
        </p>
        <UiAlert v-if="prepaidError" severity="danger">
          {{ prepaidError }}
        </UiAlert>
      </div>
    </UiConfirmModal>
</template>
