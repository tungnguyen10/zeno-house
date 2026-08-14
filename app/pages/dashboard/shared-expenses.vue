<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'
import type {
  SharedExpense,
  SharedExpenseAllocationResult,
  SharedExpenseListItem,
} from '~/types/shared-expenses'
import type { SharedExpenseCreateInput } from '~/utils/validators/shared-expenses'
import { getApiErrorMessage } from '~/utils/api-error'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
} from '~/utils/constants/operations-report'
import { formatPeriodString, parsePeriodString } from '~/utils/format/period'

definePageMeta({ title: 'Chi phí dùng chung' })

const auth = useAuthStore()
const toast = useToast()
const periodYear = ref(new Date().getFullYear())
const periodMonth = ref(new Date().getMonth() + 1)
const {
  sharedExpenses,
  sharedExpensesLoading,
  sharedExpensesError,
  refreshSharedExpenses,
  createSharedExpense,
  updateSharedExpense,
  removeSharedExpense,
  allocateSharedExpense,
} = useSharedExpenses(periodYear, periodMonth)

const {
  data: buildingsData,
  status: buildingsStatus,
  error: buildingsFetchError,
  refresh: refreshBuildings,
} = useFetch<ApiSuccess<Building[]>>('/api/buildings', {
  query: { page: 1, limit: 100, sort: 'name', order: 'asc' },
})

const buildings = computed(() => buildingsData.value?.data ?? [])
const buildingsLoading = computed(() => buildingsStatus.value === 'pending')
const buildingsError = computed(() => buildingsFetchError.value
  ? getApiErrorMessage(buildingsFetchError.value, 'Không tải được danh sách tòa nhà.')
  : null)
const listError = computed(() => sharedExpensesError.value
  ? getApiErrorMessage(sharedExpensesError.value, 'Không tải được chi phí dùng chung.')
  : null)

const canWrite = computed(() => auth.can('shared-expenses.write'))
const canAllocate = computed(() => auth.can('shared-expenses.allocate'))
const canRead = computed(() => auth.can('shared-expenses.read'))

const formOpen = ref(false)
const editing = ref<SharedExpense | null>(null)
const allocationTarget = ref<SharedExpenseListItem | null>(null)
const allocationError = ref<string | null>(null)
const allocationResult = ref<SharedExpenseAllocationResult | null>(null)
const deactivationTarget = ref<SharedExpenseListItem | null>(null)

const saving = ref(false)
const allocatingId = ref<string | null>(null)
const deactivatingId = ref<string | null>(null)
const reactivatingId = ref<string | null>(null)

const periodModel = computed<string>({
  get: () => formatPeriodString(periodYear.value, periodMonth.value),
  set: (value) => {
    const parsed = parsePeriodString(value)
    if (!parsed) return
    periodYear.value = parsed.year
    periodMonth.value = parsed.month
  },
})

const nameSuggestions = computed(() => {
  const existingNames = sharedExpenses.value.map(item => item.name)
  const categoryNames = EXPENSE_CATEGORIES.map(category => EXPENSE_CATEGORY_LABELS[category])
  return [...new Set([...existingNames, ...categoryNames])].filter(Boolean)
})

function openCreate() {
  editing.value = null
  formOpen.value = true
}

function openEdit(item: SharedExpenseListItem) {
  editing.value = item
  formOpen.value = true
}

function closeForm() {
  if (saving.value) return
  formOpen.value = false
  editing.value = null
}

async function save(payload: SharedExpenseCreateInput) {
  saving.value = true
  try {
    if (editing.value) {
      await updateSharedExpense(editing.value.id, payload)
      toast.success('Đã lưu thay đổi khoản chi.')
    }
    else {
      await createSharedExpense(payload)
      toast.success('Đã tạo khoản chi dùng chung.')
    }
    formOpen.value = false
    editing.value = null
  }
  catch (error) {
    toast.error(getApiErrorMessage(error, 'Không lưu được chi phí dùng chung.'))
  }
  finally {
    saving.value = false
  }
}

function openAllocation(item: SharedExpenseListItem) {
  if (!item.isActive || item.isAllocatedForPeriod) return
  allocationTarget.value = item
  allocationError.value = null
  allocationResult.value = null
}

function closeAllocation() {
  if (allocatingId.value) return
  allocationTarget.value = null
  allocationError.value = null
  allocationResult.value = null
}

async function confirmAllocation() {
  const item = allocationTarget.value
  if (!item) return
  allocatingId.value = item.id
  allocationError.value = null
  try {
    allocationResult.value = await allocateSharedExpense(item.id, {
      period_year: periodYear.value,
      period_month: periodMonth.value,
    })
    await refreshSharedExpenses()
  }
  catch (error) {
    allocationError.value = getApiErrorMessage(error, 'Không phân bổ được khoản chi cho kỳ đã chọn.')
    await refreshSharedExpenses()
  }
  finally {
    allocatingId.value = null
  }
}

function requestDeactivate(item: SharedExpenseListItem) {
  deactivationTarget.value = item
}

async function confirmDeactivate() {
  const item = deactivationTarget.value
  if (!item) return
  deactivatingId.value = item.id
  try {
    await removeSharedExpense(item.id)
    toast.success(`Đã ngừng sử dụng “${item.name}”.`)
    deactivationTarget.value = null
  }
  catch (error) {
    toast.error(getApiErrorMessage(error, 'Không ngừng được chi phí dùng chung.'))
  }
  finally {
    deactivatingId.value = null
  }
}

async function reactivate(item: SharedExpenseListItem) {
  reactivatingId.value = item.id
  try {
    await updateSharedExpense(item.id, { is_active: true })
    toast.success(`Đã kích hoạt lại “${item.name}”.`)
  }
  catch (error) {
    toast.error(getApiErrorMessage(error, 'Không kích hoạt lại được chi phí dùng chung.'))
  }
  finally {
    reactivatingId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <UiPageHeader
      title="Chi phí dùng chung"
      description="Theo dõi khoản chi của nhiều tòa nhà và phân bổ theo từng kỳ."
    >
      <template v-if="canRead && canWrite" #actions>
        <UiButton class="whitespace-nowrap" @click="openCreate">
          <IconPlus class="size-4" aria-hidden="true" />
          Tạo khoản chi
        </UiButton>
      </template>
    </UiPageHeader>

    <UiAlert v-if="!canRead" severity="danger">
      Bạn không có quyền xem chi phí dùng chung.
    </UiAlert>

    <UiSection
      v-else
      title="Danh sách khoản chi"
      description="Kỳ được chọn quyết định trạng thái và thao tác phân bổ của từng khoản."
    >
      <UiToolbar>
        <UiDatePicker
          v-model="periodModel"
          label="Kỳ phân bổ"
          picker-mode="month"
          class="w-full sm:w-48"
        />
      </UiToolbar>

      <UiAlert v-if="listError" severity="danger" title="Không tải được danh sách">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>{{ listError }}</span>
          <UiButton size="sm" variant="secondary" @click="refreshSharedExpenses()">
            <IconRefresh class="size-4" aria-hidden="true" />
            Thử lại
          </UiButton>
        </div>
      </UiAlert>

      <SharedExpenseList
        v-if="!listError || sharedExpenses.length > 0"
        :items="sharedExpenses"
        :buildings="buildings"
        :loading="sharedExpensesLoading"
        :can-write="canWrite"
        :can-allocate="canAllocate"
        :allocating-id="allocatingId"
        :deactivating-id="deactivatingId"
        :reactivating-id="reactivatingId"
        @create="openCreate"
        @edit="openEdit"
        @allocate="openAllocation"
        @deactivate="requestDeactivate"
        @reactivate="reactivate"
      />
    </UiSection>

    <SharedExpenseFormModal
      :open="formOpen"
      :expense="editing"
      :buildings="buildings"
      :buildings-loading="buildingsLoading"
      :buildings-error="buildingsError"
      :saving="saving"
      :name-suggestions="nameSuggestions"
      @close="closeForm"
      @retry-buildings="refreshBuildings()"
      @submit="save"
    />

    <SharedExpenseAllocationModal
      :open="!!allocationTarget"
      :expense="allocationTarget"
      :buildings="buildings"
      :period-year="periodYear"
      :period-month="periodMonth"
      :loading="!!allocatingId"
      :error="allocationError"
      :result="allocationResult"
      @close="closeAllocation"
      @confirm="confirmAllocation"
    />

    <UiConfirmModal
      :open="!!deactivationTarget"
      title="Ngừng sử dụng khoản chi?"
      :message="deactivationTarget ? `“${deactivationTarget.name}” sẽ không thể phân bổ cho kỳ mới. Bạn có thể kích hoạt lại sau.` : ''"
      confirm-label="Ngừng sử dụng"
      :loading="!!deactivatingId"
      @cancel="deactivationTarget = null"
      @confirm="confirmDeactivate"
    />
  </div>
</template>
