<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { PricingType, ServiceCatalogItem } from '~/types/service-catalog'
import type { ContractWithDetails } from '~/types/contracts'
import type { AssignmentManager } from '~/types/assignments'
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
import { buildingPath } from '~/utils/routes/operational'

const route = useRoute()
const id = route.params.id as string
const authStore = useAuthStore()
const toast = useToast()

const { building, refresh: refreshBuilding } = useBuildingDetail(id)
const {
  services,
  isLoading: loadingServices,
  upsertService,
  updateService,
  syncToContracts,
} = useBuildingServices(id)
const {
  allServices: contractServices,
  isLoading: loadingContractServices,
  updateService: updateContractService,
  refresh: refreshContractServices,
} = useBuildingContractServices(id)

const { data: catalogData, refresh: refreshCatalog } = await useFetch<ApiSuccess<ServiceCatalogItem[]>>(
  '/api/service-catalog',
  { query: { building_id: id } },
)
const catalog = computed(() => catalogData.value?.data ?? [])

const { data: contractsData, refresh: refreshContracts } = await useFetch<ApiSuccess<ContractWithDetails[]>>(
  '/api/contracts',
  { query: { building_id: id, status: 'active', limit: 200 } },
)
const contractRows = computed(() =>
  (contractsData.value?.data ?? []).map(c => ({
    contractId: c.id,
    roomNumber: c.room.roomNumber,
    tenantName: c.tenant.fullName,
  })),
)

const { data: managersData } = await useFetch<ApiSuccess<AssignmentManager[]>>(
  `/api/assignments/by-building/${id}`,
  { immediate: authStore.canManageUsers },
)
const assignedManagers = computed(() => managersData.value?.data ?? [])

const activeServiceCount = computed(() => services.value.filter(s => s.isActive).length)
const canManageBuildingServices = computed(() => authStore.can('building-services.write'))
const canManageFixedCosts = computed(() => authStore.can('building-fixed-costs.write'))
const canManageRecurringExpenses = computed(() => authStore.can('recurring-expenses.write'))
const canManagePrepaidExpenses = computed(() => authStore.can('prepaid-expenses.write'))
const canManageReserveFund = computed(() => authStore.can('reserve-fund.manage'))
const apiBuildingId = computed(() => building.value?.id ?? '')
const now = new Date()
const fixedCostPeriodYear = ref(now.getFullYear())
const fixedCostPeriodMonth = ref(now.getMonth() + 1)
const fixedCostModalOpen = ref(false)
const savingFixedCost = ref(false)
const endFixedCostModalOpen = ref(false)
const endingFixedCost = ref(false)
const endFixedCostTarget = ref<BuildingFixedCost | null>(null)
const endPeriodYear = ref(now.getFullYear())
const endPeriodMonth = ref(now.getMonth() + 1)
const fixedCostError = ref<string | null>(null)
const { createFixedCost } = useOperationsMutations()
const { data: reserveRatesData, refresh: refreshReserveRates } = await useFetch<ApiSuccess<BuildingReserveFundRate[]>>(
  '/api/reserve-fund-rates',
  {
    query: computed(() => ({ building_id: apiBuildingId.value })),
    immediate: false,
    watch: false,
  },
)
const reserveRates = computed(() => reserveRatesData.value?.data ?? [])
const reserveRateModalOpen = ref(false)
const savingReserveRate = ref(false)
const reserveRateError = ref<string | null>(null)
const reserveRateForm = reactive({
  reserve_rate_percent: '',
  effective_from_period_year: now.getFullYear(),
  effective_from_period_month: now.getMonth() + 1,
})
const endReserveRateModalOpen = ref(false)
const endingReserveRate = ref(false)
const endReserveRateTarget = ref<BuildingReserveFundRate | null>(null)
const endReserveRateYear = ref(now.getFullYear())
const endReserveRateMonth = ref(now.getMonth() + 1)
const { data: fixedCostsData, refresh: refreshFixedCosts } = await useFetch<ApiSuccess<BuildingFixedCost[]>>(
  '/api/building-fixed-costs',
  {
    query: computed(() => ({ building_id: apiBuildingId.value })),
    immediate: false,
    watch: false,
  },
)
const fixedCosts = computed(() => fixedCostsData.value?.data ?? [])
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
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
} = useRecurringExpenses(apiBuildingId)
const {
  prepaidExpenses,
  createPrepaidExpense,
  updatePrepaidExpense,
  deletePrepaidExpense,
} = usePrepaidExpenses(apiBuildingId)
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
const servicePricingOptions: { value: PricingType, label: string }[] = [
  { value: 'fixed_per_room', label: 'Cố định / phòng' },
  { value: 'per_person', label: 'Theo người' },
  { value: 'per_vehicle', label: 'Theo xe' },
]
const customServiceModalOpen = ref(false)
const savingCustomService = ref(false)
const customServiceError = ref<string | null>(null)
const customServiceForm = reactive({
  name: '',
  pricing_type: 'fixed_per_room' as PricingType,
  unit: '',
  default_amount: '',
  is_active: true,
  description: '',
})

function openCustomServiceModal() {
  customServiceError.value = null
  customServiceForm.name = ''
  customServiceForm.pricing_type = 'fixed_per_room'
  customServiceForm.unit = ''
  customServiceForm.default_amount = ''
  customServiceForm.is_active = true
  customServiceForm.description = ''
  customServiceModalOpen.value = true
}

watch(
  [apiBuildingId, canManageFixedCosts],
  ([buildingId, canManage]) => {
    if (buildingId && canManage) refreshFixedCosts()
  },
  { immediate: true },
)

watch(
  [apiBuildingId, canManageReserveFund],
  ([buildingId, canManage]) => {
    if (buildingId && canManage) refreshReserveRates()
  },
  { immediate: true },
)

function openCreateReserveRate() {
  reserveRateError.value = null
  reserveRateForm.reserve_rate_percent = ''
  reserveRateForm.effective_from_period_year = fixedCostPeriodYear.value
  reserveRateForm.effective_from_period_month = fixedCostPeriodMonth.value
  reserveRateModalOpen.value = true
}

async function submitReserveRate() {
  if (!apiBuildingId.value) return
  const rate = Number(reserveRateForm.reserve_rate_percent)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    reserveRateError.value = 'Tỷ lệ phải nằm trong khoảng 0 đến 100.'
    return
  }
  savingReserveRate.value = true
  reserveRateError.value = null
  try {
    await $fetch('/api/reserve-fund-rates', {
      method: 'POST',
      body: {
        building_id: apiBuildingId.value,
        reserve_rate_percent: rate,
        effective_from_period_year: Number(reserveRateForm.effective_from_period_year),
        effective_from_period_month: Number(reserveRateForm.effective_from_period_month),
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
  endReserveRateYear.value = fixedCostPeriodYear.value
  endReserveRateMonth.value = fixedCostPeriodMonth.value
  reserveRateError.value = null
  endReserveRateModalOpen.value = true
}

async function submitEndReserveRate() {
  if (!endReserveRateTarget.value) return
  endingReserveRate.value = true
  reserveRateError.value = null
  try {
    await $fetch(`/api/reserve-fund-rates/${endReserveRateTarget.value.id}`, {
      method: 'PATCH',
      body: {
        effective_to_period_year: Number(endReserveRateYear.value),
        effective_to_period_month: Number(endReserveRateMonth.value),
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

async function submitCustomService() {
  const amount = customServiceForm.default_amount === '' ? 0 : Number(customServiceForm.default_amount)
  if (!customServiceForm.name.trim() || !Number.isFinite(amount) || amount < 0) {
    customServiceError.value = 'Kiểm tra tên dịch vụ và đơn giá mặc định.'
    return
  }

  savingCustomService.value = true
  customServiceError.value = null
  try {
    const created = await $fetch<ApiSuccess<ServiceCatalogItem>>('/api/service-catalog', {
      method: 'POST',
      body: {
        building_id: id,
        name: customServiceForm.name.trim(),
        pricing_type: customServiceForm.pricing_type,
        unit: customServiceForm.unit.trim() || null,
        description: customServiceForm.description.trim() || null,
      },
    })
    await upsertService({
      building_id: id,
      catalog_id: created.data.id,
      default_amount: amount,
      pricing_type: customServiceForm.pricing_type,
      is_active: customServiceForm.is_active,
    })
    await refreshCatalog()
    customServiceModalOpen.value = false
    toast.success('Đã thêm dịch vụ riêng.')
  }
  catch (err) {
    customServiceError.value = resolveApiError(err, 'Không tạo được dịch vụ.')
  }
  finally {
    savingCustomService.value = false
  }
}

async function removePrepaid(item: PrepaidExpense) {
  try {
    await deletePrepaidExpense(item.id)
  }
  catch (err) {
    prepaidError.value = resolveApiError(err, 'Không xóa được chi phí trả trước.')
  }
}

function openEndFixedCost(cost: BuildingFixedCost) {
  endFixedCostTarget.value = cost
  endPeriodYear.value = fixedCostPeriodYear.value
  endPeriodMonth.value = fixedCostPeriodMonth.value
  fixedCostError.value = null
  endFixedCostModalOpen.value = true
}

async function submitEndFixedCost() {
  if (!endFixedCostTarget.value) return
  endingFixedCost.value = true
  fixedCostError.value = null
  try {
    await $fetch(`/api/building-fixed-costs/${endFixedCostTarget.value.id}`, {
      method: 'PATCH',
      body: {
        effective_to_period_year: Number(endPeriodYear.value),
        effective_to_period_month: Number(endPeriodMonth.value),
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
  const msg = (err as { data?: { error?: { message?: string } } })?.data?.error?.message
  return msg ?? fallback
}

// Building code
const codeInput = ref('')
const isCodeLocked = computed(() => (building.value?.totalRooms ?? 0) > 0)
const isSavingCode = ref(false)
const codeSaveError = ref<string | null>(null)
const codeSaveSuccess = ref(false)
const codeDirty = computed(() => Boolean(codeInput.value) && codeInput.value !== building.value?.code)

watch(() => building.value?.code, (code) => {
  if (code) codeInput.value = code
}, { immediate: true })

async function handleSaveCode() {
  if (!codeDirty.value) return
  isSavingCode.value = true
  codeSaveError.value = null
  codeSaveSuccess.value = false
  try {
    await $fetch(`/api/buildings/${id}`, { method: 'PATCH', body: { code: codeInput.value } })
    await refreshBuilding()
    codeSaveSuccess.value = true
    setTimeout(() => { codeSaveSuccess.value = false }, 3000)
  }
  catch (err: unknown) {
    const msg = (err as { data?: { error?: { message?: string } } })?.data?.error?.message
    codeSaveError.value = msg ?? 'Không thể lưu code. Vui lòng thử lại.'
  }
  finally {
    isSavingCode.value = false
  }
}

// Sync defaults to active contracts
const isSyncing = ref(false)
const syncResult = ref<string | null>(null)

async function handleSync() {
  isSyncing.value = true
  syncResult.value = null
  try {
    const changes = await syncToContracts(id)
    syncResult.value = changes > 0
      ? `Đã cập nhật ${changes} dịch vụ trên hợp đồng.`
      : 'Hợp đồng đã khớp với cấu hình mặc định.'
    await Promise.all([refreshContracts(), refreshContractServices()])
  }
  catch {
    syncResult.value = 'Đồng bộ thất bại.'
  }
  finally {
    isSyncing.value = false
    setTimeout(() => { syncResult.value = null }, 4000)
  }
}

async function handleToggle(catalogId: string, isActive: boolean) {
  const existing = services.value.find(s => s.catalogId === catalogId)
  if (existing) await updateService(existing.id, { is_active: isActive })
  else await upsertService({ building_id: id, catalog_id: catalogId, is_active: isActive })
}

async function handleUpdateAmount(catalogId: string, amount: number) {
  const existing = services.value.find(s => s.catalogId === catalogId)
  if (existing) await updateService(existing.id, { default_amount: amount })
  else await upsertService({ building_id: id, catalog_id: catalogId, default_amount: amount })
}

async function handleUpdatePricingType(catalogId: string, pricingType: PricingType) {
  const existing = services.value.find(s => s.catalogId === catalogId)
  if (existing) await updateService(existing.id, { pricing_type: pricingType })
  else await upsertService({ building_id: id, catalog_id: catalogId, pricing_type: pricingType })
}
</script>

<template>
  <div class="space-y-8">
    <UiPageHeader title="Cài đặt dịch vụ" :description="building?.name">
      <NuxtLink
        :to="building ? buildingPath(building) : `/buildings/${id}`"
        class="text-sm text-muted hover:text-white transition-colors"
      >
        ← Quay lại tòa nhà
      </NuxtLink>
    </UiPageHeader>

    <!-- Building code -->
    <UiSection
      title="Mã tòa nhà"
      description="Dùng trong URL và tên hợp đồng. Khóa sau khi tòa nhà đã có phòng."
    >
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <UiInput
            v-model="codeInput"
            label="Code"
            :disabled="isCodeLocked"
            :title="isCodeLocked ? 'Không thể đổi vì tòa nhà đã có phòng' : undefined"
            placeholder="vd: zhpn"
            input-class="font-mono"
            class="flex-1 min-w-0"
          />
          <div class="flex items-center gap-2 sm:pb-0.5">
            <UiButton
              v-if="!isCodeLocked"
              size="sm"
              :loading="isSavingCode"
              :disabled="!codeDirty"
              @click="handleSaveCode"
            >
              Lưu
            </UiButton>
            <span
              v-else
              class="inline-flex items-center gap-1.5 rounded-md border border-dark-border bg-dark-deep/40 px-2 py-1 text-xs text-muted"
            >
              <IconLock class="h-3.5 w-3.5" aria-hidden="true" />
              Đã khóa · {{ building?.totalRooms }} phòng
            </span>
          </div>
        </div>
        <UiAlert v-if="codeSaveError" severity="danger" class="mt-3">
          {{ codeSaveError }}
        </UiAlert>
        <p v-if="codeSaveSuccess" class="mt-2 text-xs text-green-400">
          Code đã được lưu.
        </p>
      </div>
    </UiSection>

    <UiSection
      v-if="authStore.canManageUsers"
      title="Managers"
      description="Những manager đang được phân quyền vào tòa nhà này."
    >
      <template #actions>
        <NuxtLink to="/settings/managers" class="text-sm text-cyan hover:text-cyan/80 transition-colors">
          Quản lý phân quyền
        </NuxtLink>
      </template>
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <div v-if="assignedManagers.length === 0" class="text-sm text-muted">
          Chưa có manager nào được gán.
        </div>
        <div v-else class="flex flex-wrap gap-2">
          <span
            v-for="manager in assignedManagers"
            :key="manager.id"
            class="rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white"
          >
            {{ manager.name ?? manager.email ?? manager.id }}
          </span>
        </div>
      </div>
    </UiSection>

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
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <UiAlert v-if="fixedCostError" severity="danger" class="mb-4">
          {{ fixedCostError }}
        </UiAlert>
        <div v-if="fixedCosts.length === 0" class="text-sm text-muted">
          Chưa có chi phí vận hành cố định.
        </div>
        <div v-else class="divide-y divide-dark-border">
          <div
            v-for="cost in fixedCosts"
            :key="cost.id"
            class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div class="font-medium text-white">
                {{ FIXED_COST_CATEGORY_LABELS[cost.category] ?? cost.category }}
              </div>
              <div class="mt-1 text-xs text-muted">
                Từ {{ cost.effectiveFromPeriodMonth }}/{{ cost.effectiveFromPeriodYear }}
                <template v-if="cost.effectiveToPeriodYear">
                  đến {{ cost.effectiveToPeriodMonth }}/{{ cost.effectiveToPeriodYear }}
                </template>
                <template v-else>
                  · đang áp dụng
                </template>
              </div>
              <p v-if="cost.note" class="mt-1 text-xs text-muted">{{ cost.note }}</p>
            </div>
            <div class="flex items-center justify-between gap-3 sm:justify-end">
              <span class="tabular-nums text-white">{{ formatCurrency(cost.amount) }}</span>
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
      </div>
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
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <UiAlert v-if="reserveRateError" severity="danger" class="mb-4">
          {{ reserveRateError }}
        </UiAlert>
        <div v-if="reserveRates.length === 0" class="text-sm text-muted">
          Chưa có tỷ lệ quỹ dự phòng.
        </div>
        <div v-else class="divide-y divide-dark-border">
          <div
            v-for="rate in reserveRates"
            :key="rate.id"
            class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div class="font-medium text-white">
                {{ rate.reserveRatePercent }}%
                <UiBadge v-if="!rate.effectiveToPeriodYear" variant="accent" class="ml-2">Đang áp dụng</UiBadge>
              </div>
              <div class="mt-1 text-xs text-muted">
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
      </div>
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
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <UiAlert v-if="recurringError" severity="danger" class="mb-4">
          {{ recurringError }}
        </UiAlert>
        <div v-if="recurringExpenses.length === 0" class="text-sm text-muted">
          Chưa có nhắc chi phí định kỳ.
        </div>
        <div v-else class="divide-y divide-dark-border">
          <div
            v-for="item in recurringExpenses"
            :key="item.id"
            class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div class="font-medium text-white">
                {{ item.name }}
                <UiBadge v-if="!item.isActive" variant="warning" class="ml-2">Tắt</UiBadge>
              </div>
              <div class="mt-1 text-xs text-muted">
                {{ EXPENSE_CATEGORY_LABELS[item.category] }} ·
                {{ RECURRING_EXPENSE_FREQUENCY_LABELS[item.frequency] }} ·
                ngày {{ item.anchorDay }} · nhắc tiếp {{ item.nextReminderAt }}
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 sm:justify-end">
              <span class="tabular-nums text-white">{{ formatCurrency(item.estimatedAmount) }}</span>
              <UiButton size="sm" variant="secondary" @click="openEditRecurring(item)">Sửa</UiButton>
              <UiButton size="sm" variant="ghost" icon-only aria-label="Xóa" @click="removeRecurring(item)">
                <IconTrash class="h-4 w-4" aria-hidden="true" />
              </UiButton>
            </div>
          </div>
        </div>
      </div>
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
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <UiAlert v-if="prepaidError" severity="danger" class="mb-4">
          {{ prepaidError }}
        </UiAlert>
        <div v-if="prepaidExpenses.length === 0" class="text-sm text-muted">
          Chưa có chi phí trả trước.
        </div>
        <div v-else class="divide-y divide-dark-border">
          <div
            v-for="item in prepaidExpenses"
            :key="item.id"
            class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div class="font-medium text-white">
                {{ item.name }}
                <UiBadge class="ml-2">{{ PREPAID_EXPENSE_STATUS_LABELS[item.status] }}</UiBadge>
              </div>
              <div class="mt-1 text-xs text-muted">
                {{ EXPENSE_CATEGORY_LABELS[item.category] }} · {{ item.startDate }} đến {{ item.endDate }} ·
                {{ item.totalMonths }} tháng
              </div>
              <p v-if="item.note" class="mt-1 text-xs text-muted">{{ item.note }}</p>
            </div>
            <div class="flex items-center justify-between gap-2 sm:justify-end">
              <span class="tabular-nums text-white">{{ formatCurrency(item.monthlyAmount) }}/tháng</span>
              <UiButton size="sm" variant="secondary" @click="openEditPrepaid(item)">Sửa</UiButton>
              <UiButton size="sm" variant="ghost" icon-only aria-label="Xóa" @click="removePrepaid(item)">
                <IconTrash class="h-4 w-4" aria-hidden="true" />
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </UiSection>

    <!-- Building-level defaults -->
    <UiSection
      title="Dịch vụ mặc định"
      description="Dịch vụ bật ở đây sẽ tự động thêm vào hợp đồng mới. Đơn giá là gợi ý — có thể chỉnh riêng từng phòng bên dưới."
    >
      <template #actions>
        <div class="flex items-center gap-3">
          <span
            v-if="syncResult"
            class="rounded-md bg-green-500/10 px-2 py-1 text-xs text-green-400"
          >
            {{ syncResult }}
          </span>
          <span
            v-else-if="activeServiceCount > 0"
            class="rounded-md bg-cyan/10 px-2 py-1 text-xs text-cyan"
          >
            {{ activeServiceCount }} dịch vụ đang bật
          </span>
          <UiButton
            v-if="canManageBuildingServices"
            size="sm"
            variant="secondary"
            @click="openCustomServiceModal"
          >
            <IconPlus class="h-4 w-4" aria-hidden="true" />
            Thêm dịch vụ
          </UiButton>
          <UiButton
            size="sm"
            variant="secondary"
            :loading="isSyncing"
            :disabled="contractRows.length === 0"
            title="Cập nhật trạng thái bật/tắt dịch vụ trên tất cả hợp đồng active theo cấu hình mặc định. Không ghi đè giá và số lượng đã chỉnh riêng."
            @click="handleSync"
          >
            Đồng bộ xuống {{ contractRows.length }} hợp đồng
          </UiButton>
        </div>
      </template>
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <BuildingServiceSettings
          :building-id="id"
          :catalog="catalog"
          :services="services"
          :loading="loadingServices"
          @toggle="handleToggle"
          @update-amount="handleUpdateAmount"
          @update-pricing-type="handleUpdatePricingType"
        />
      </div>
    </UiSection>

    <UiModal
      :open="customServiceModalOpen"
      title="Thêm dịch vụ riêng"
      size="md"
      @close="customServiceModalOpen = false"
    >
      <div class="space-y-4">
        <UiInput
          v-model="customServiceForm.name"
          label="Tên dịch vụ"
          placeholder="Ví dụ: Giặt sấy"
          required
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <UiSelect
            v-model="customServiceForm.pricing_type"
            label="Loại tính phí"
            :options="servicePricingOptions"
          />
          <UiInput
            v-model="customServiceForm.unit"
            label="Đơn vị"
            placeholder="lần, người, xe..."
          />
        </div>
        <div class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <UiInput
            v-model="customServiceForm.default_amount"
            label="Đơn giá mặc định"
            type="number"
            inputmode="decimal"
            placeholder="0"
          />
          <UiToggle
            v-model="customServiceForm.is_active"
            label="Kích hoạt ngay"
            size="sm"
            class="pb-2"
          />
        </div>
        <UiTextarea
          v-model="customServiceForm.description"
          label="Ghi chú"
          :rows="2"
          resize="none"
        />
        <UiAlert v-if="customServiceError" severity="danger">
          {{ customServiceError }}
        </UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="savingCustomService" @click="customServiceModalOpen = false">
          Hủy
        </UiButton>
        <UiButton :loading="savingCustomService" @click="submitCustomService">
          Lưu dịch vụ
        </UiButton>
      </template>
    </UiModal>

    <!-- Per-contract overrides -->
    <UiSection
      title="Dịch vụ theo phòng"
      description="Bật/tắt, chỉnh đơn giá và số lượng riêng cho từng phòng. Thay đổi ở đây chỉ ảnh hưởng phòng đó."
    >
      <div class="rounded-xl border border-dark-border bg-dark-surface p-5">
        <BuildingContractServicesList
          :contracts="contractRows"
          :services="contractServices"
          :loading="loadingContractServices"
          @update="updateContractService"
        />
      </div>
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
        <p class="text-sm text-muted">
          Chọn kỳ cuối cùng còn áp dụng chi phí này.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <UiInput v-model="endPeriodYear" label="Năm kết thúc" type="number" />
          <UiInput v-model="endPeriodMonth" label="Tháng kết thúc" type="number" />
        </div>
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
          min="0"
          max="100"
          step="0.01"
          required
        />
        <div class="grid grid-cols-2 gap-3">
          <UiInput
            v-model.number="reserveRateForm.effective_from_period_year"
            label="Năm bắt đầu"
            type="number"
          />
          <UiInput
            v-model.number="reserveRateForm.effective_from_period_month"
            label="Tháng bắt đầu"
            type="number"
            min="1"
            max="12"
          />
        </div>
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
        <p class="text-sm text-muted">
          Chọn kỳ cuối cùng còn áp dụng tỷ lệ này.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <UiInput v-model="endReserveRateYear" label="Năm kết thúc" type="number" />
          <UiInput v-model="endReserveRateMonth" label="Tháng kết thúc" type="number" min="1" max="12" />
        </div>
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
          <UiInput v-model.number="recurringForm.anchor_day" label="Ngày nhắc" type="number" min="1" max="28" />
        </div>
        <UiInput
          v-model="recurringForm.estimated_amount"
          label="Số tiền dự kiến"
          type="number"
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
          <UiInput v-model="prepaidForm.total_amount" label="Tổng tiền" type="number" min="0" required />
          <UiInput v-model.number="prepaidForm.total_months" label="Số tháng" type="number" min="1" required />
        </div>
        <UiInput v-model="prepaidForm.start_date" label="Ngày bắt đầu" type="date" required />
        <UiSelect
          v-if="editingPrepaid"
          v-model="prepaidForm.status"
          label="Trạng thái"
          :options="prepaidStatusOptions"
        />
        <UiTextarea v-model="prepaidForm.note" label="Ghi chú" :rows="2" />
        <div v-if="prepaidPreview" class="rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-muted">
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
  </div>
</template>
