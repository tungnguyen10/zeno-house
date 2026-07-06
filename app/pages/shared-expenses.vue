<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'
import type { SharedExpense } from '~/types/shared-expenses'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from '~/utils/constants/operations-report'
import { formatCurrency } from '~/utils/format/currency'

definePageMeta({ title: 'Chi phí dùng chung' })

const auth = useAuthStore()
const toast = useToast()
const {
  sharedExpenses,
  createSharedExpense,
  updateSharedExpense,
  removeSharedExpense,
  allocateSharedExpense,
} = useSharedExpenses()

const { data: buildingsData } = useFetch<ApiSuccess<Building[]>>('/api/buildings', {
  query: { page: 1, limit: 100, sort: 'name', order: 'asc' },
})
const buildings = computed(() => buildingsData.value?.data ?? [])

const canWrite = computed(() => auth.can('shared-expenses.write'))
const canAllocate = computed(() => auth.can('shared-expenses.allocate'))
const canRead = computed(() => auth.can('shared-expenses.read'))

const editing = ref<SharedExpense | null>(null)
const form = reactive({
  name: '',
  category: 'other' as ExpenseCategory,
  amount: '',
  note: '',
  buildingIds: [] as string[],
})
const periodYear = ref(new Date().getFullYear())
const periodMonth = ref(new Date().getMonth() + 1)
const busy = ref(false)

const periodYearModel = computed<string | number>({
  get: () => periodYear.value,
  set: value => { periodYear.value = Number(value) },
})
const periodMonthModel = computed<string | number>({
  get: () => periodMonth.value,
  set: value => { periodMonth.value = Number(value) },
})

const categoryOptions = EXPENSE_CATEGORIES.map(value => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}))
const nameSuggestions = computed(() => {
  const existingNames = sharedExpenses.value.map(item => item.name)
  const categoryNames = EXPENSE_CATEGORIES.map(category => EXPENSE_CATEGORY_LABELS[category])
  return [...new Set([...existingNames, ...categoryNames])].filter(Boolean)
})
const nameModel = computed<string | null>({
  get: () => form.name || null,
  set: value => { form.name = value ?? '' },
})

const sharedExpenseColumns: UiTableColumn<SharedExpense>[] = [
  { key: 'name', label: 'Khoản chi' },
  { key: 'category', label: 'Loại', hideOnMobile: true },
  { key: 'buildings', label: 'Tòa nhà' },
  { key: 'amount', label: 'Số tiền', numeric: true },
  { key: 'status', label: 'Trạng thái', hideOnMobile: true },
  { key: 'actions', action: true, width: 'w-44' },
]

const preview = computed(() => {
  const amount = Number(form.amount)
  const count = form.buildingIds.length
  if (!amount || count === 0) return []
  const base = Math.floor(amount / count)
  return form.buildingIds.map((buildingId, index) => ({
    buildingId,
    amount: index === count - 1 ? base + amount - base * count : base,
  }))
})

function buildingName(id: string) {
  return buildings.value.find(building => building.id === id)?.name ?? id
}

function isBuildingSelected(id: string) {
  return form.buildingIds.includes(id)
}

function setBuildingSelected(id: string, selected: boolean) {
  form.buildingIds = selected
    ? [...new Set([...form.buildingIds, id])]
    : form.buildingIds.filter(buildingId => buildingId !== id)
}

function resetForm() {
  editing.value = null
  form.name = ''
  form.category = 'other'
  form.amount = ''
  form.note = ''
  form.buildingIds = []
}

function edit(item: SharedExpense) {
  editing.value = item
  form.name = item.name
  form.category = item.category
  form.amount = String(item.amount)
  form.note = item.note ?? ''
  form.buildingIds = [...item.buildingIds]
}

async function submit() {
  const amount = Number(form.amount)
  if (!form.name.trim() || !amount || form.buildingIds.length === 0) {
    toast.error('Nhập tên, số tiền và chọn ít nhất một tòa nhà.')
    return
  }
  busy.value = true
  try {
    const payload = {
      name: form.name.trim(),
      category: form.category,
      amount,
      note: form.note.trim() || null,
      building_ids: form.buildingIds,
    }
    if (editing.value) await updateSharedExpense(editing.value.id, payload)
    else await createSharedExpense(payload)
    toast.success('Đã lưu chi phí dùng chung.')
    resetForm()
  }
  catch (err) {
    toast.error(resolveError(err, 'Không lưu được chi phí dùng chung.'))
  }
  finally {
    busy.value = false
  }
}

async function allocate(item: SharedExpense) {
  busy.value = true
  try {
    await allocateSharedExpense(item.id, {
      period_year: periodYear.value,
      period_month: periodMonth.value,
    })
    toast.success('Đã phân bổ kỳ này.')
  }
  catch (err) {
    toast.error(resolveError(err, 'Không phân bổ được kỳ này.'))
  }
  finally {
    busy.value = false
  }
}

async function deactivate(item: SharedExpense) {
  busy.value = true
  try {
    await removeSharedExpense(item.id)
    toast.success('Đã ngừng chi phí dùng chung.')
  }
  catch (err) {
    toast.error(resolveError(err, 'Không xóa được chi phí dùng chung.'))
  }
  finally {
    busy.value = false
  }
}

function resolveError(err: unknown, fallback: string): string {
  const body = (err as { data?: { error?: { message?: string } } })?.data
  return body?.error?.message ?? fallback
}
</script>

<template>
  <div class="space-y-6">
    <UiPageHeader
      title="Chi phí dùng chung"
      description="Quản lý các khoản chi của nhiều tòa nhà và phân bổ đều theo kỳ."
    />

    <UiAlert v-if="!canRead" severity="danger" class="mb-6">
      Bạn không có quyền xem chi phí dùng chung.
    </UiAlert>

    <template v-else>
      <div class="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <UiSection
          v-if="canWrite"
          title="Thiết lập khoản chi"
          description="Chọn các tòa nhà cùng chia khoản này. Phần dư làm tròn nằm ở tòa cuối cùng."
        >
          <form
            class="rounded-xl border border-dark-border bg-dark-surface p-4 space-y-4"
            @submit.prevent="submit"
          >
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <UiCombobox
                v-model="nameModel"
                label="Tên chi phí"
                :options="nameSuggestions"
                :option-key="name => name"
                :option-label="name => name"
                :create-option="name => name"
                allow-custom
                custom-option-label="Dùng"
                placeholder="Chọn mẫu hoặc nhập tên riêng"
                search-placeholder="Nhập tên chi phí"
                empty-message="Nhập tên mới để dùng"
              />
              <UiInput v-model="form.amount" label="Số tiền" type="number" min="1">
                <template #suffix>₫</template>
              </UiInput>
            </div>
            <UiSelect v-model="form.category" label="Loại chi phí" :options="categoryOptions" />
            <UiTextarea v-model="form.note" label="Ghi chú" :rows="2" />

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm font-medium text-muted">Tòa nhà áp dụng</span>
                <UiBadge variant="accent">{{ form.buildingIds.length }}</UiBadge>
              </div>
              <div class="max-h-56 space-y-2 overflow-y-auto rounded-md border border-dark-border bg-dark-deep p-3">
                <UiCheckbox
                  v-for="building in buildings"
                  :key="building.id"
                  :model-value="isBuildingSelected(building.id)"
                  :label="building.name"
                  @update:model-value="setBuildingSelected(building.id, $event)"
                />
                <p v-if="buildings.length === 0" class="text-xs text-muted">
                  Chưa có tòa nhà trong phạm vi của bạn.
                </p>
              </div>
            </div>

            <div v-if="preview.length > 0" class="space-y-2">
              <div class="text-sm font-medium text-muted">Xem trước phân bổ</div>
              <div class="divide-y divide-dark-border text-xs">
                <div
                  v-for="row in preview"
                  :key="row.buildingId"
                  class="flex items-center justify-between gap-3 py-2"
                >
                  <span class="truncate text-muted">{{ buildingName(row.buildingId) }}</span>
                  <span class="shrink-0 tabular-nums text-white">{{ formatCurrency(row.amount) }}</span>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 border-t border-dark-border pt-4">
              <UiButton type="button" variant="secondary" :disabled="busy" @click="resetForm">
                Hủy
              </UiButton>
              <UiButton type="submit" :loading="busy">
                {{ editing ? 'Lưu thay đổi' : 'Tạo khoản chi' }}
              </UiButton>
            </div>
          </form>
        </UiSection>

        <UiSection
          title="Danh sách khoản chi"
          description="Chọn kỳ, sau đó phân bổ từng khoản đang hoạt động."
        >
          <UiToolbar>
            <UiInput v-model="periodYearModel" label="Năm" type="number" class="w-32" />
            <UiInput v-model="periodMonthModel" label="Tháng" type="number" min="1" max="12" class="w-32" />
          </UiToolbar>

          <UiTable
            :rows="sharedExpenses"
            :columns="sharedExpenseColumns"
            empty-title="Chưa có chi phí dùng chung"
            empty-description="Tạo khoản đầu tiên để phân bổ cho nhiều tòa nhà."
            caption="Danh sách chi phí dùng chung"
          >
            <template #cell-name="{ row }">
              <div class="min-w-0">
                <div class="font-medium text-white">{{ row.name }}</div>
                <p v-if="row.note" class="mt-0.5 max-w-md truncate text-xs text-muted">{{ row.note }}</p>
              </div>
            </template>

            <template #cell-category="{ row }">
              <span class="text-muted">{{ EXPENSE_CATEGORY_LABELS[row.category] }}</span>
            </template>

            <template #cell-buildings="{ row }">
              <div class="flex max-w-md flex-wrap gap-1">
                <UiBadge
                  v-for="buildingId in row.buildingIds"
                  :key="buildingId"
                  variant="neutral"
                >
                  {{ buildingName(buildingId) }}
                </UiBadge>
              </div>
            </template>

            <template #cell-amount="{ row }">
              <span class="tabular-nums text-white">{{ formatCurrency(row.amount) }}</span>
            </template>

            <template #cell-status="{ row }">
              <UiBadge :variant="row.isActive ? 'success' : 'neutral'" pill>
                {{ row.isActive ? 'Đang dùng' : 'Đã ngừng' }}
              </UiBadge>
            </template>

            <template #cell-actions="{ row }">
              <div class="flex justify-end gap-1">
                <UiButton
                  v-if="canWrite"
                  size="sm"
                  variant="ghost"
                  icon-only
                  aria-label="Sửa"
                  :disabled="busy"
                  @click="edit(row)"
                >
                  <IconPencilSquare class="h-4 w-4" aria-hidden="true" />
                </UiButton>
                <UiButton
                  v-if="canAllocate"
                  size="sm"
                  variant="secondary"
                  :disabled="busy || !row.isActive"
                  @click="allocate(row)"
                >
                  <IconLayers class="h-4 w-4" aria-hidden="true" />
                  Phân bổ
                </UiButton>
                <UiButton
                  v-if="canWrite"
                  size="sm"
                  variant="ghost"
                  icon-only
                  aria-label="Ngừng"
                  :disabled="busy || !row.isActive"
                  @click="deactivate(row)"
                >
                  <IconTrash class="h-4 w-4" aria-hidden="true" />
                </UiButton>
              </div>
            </template>

            <template v-if="canWrite" #emptyAction>
              <UiButton size="sm" @click="resetForm">
                <IconPlus class="h-4 w-4" aria-hidden="true" />
                Tạo khoản chi
              </UiButton>
            </template>
          </UiTable>
        </UiSection>
      </div>
    </template>
  </div>
</template>
