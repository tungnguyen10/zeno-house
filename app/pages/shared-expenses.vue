<script setup lang="ts">
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

const categoryOptions = EXPENSE_CATEGORIES.map(value => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}))

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
  <div>
    <UiPageHeader
      title="Chi phí dùng chung"
      description="Quản lý các khoản chi của nhiều tòa nhà và phân bổ đều theo kỳ."
    />

    <UiAlert v-if="!canRead" severity="danger" class="mb-6">
      Bạn không có quyền xem chi phí dùng chung.
    </UiAlert>

    <template v-else>
      <div class="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form
          v-if="canWrite"
          class="rounded-2xl border border-dark-border bg-dark-surface p-5 space-y-4"
          @submit.prevent="submit"
        >
          <UiInput v-model="form.name" label="Tên chi phí" />
          <UiInput v-model="form.amount" label="Số tiền" type="number" min="1" />
          <UiSelect v-model="form.category" label="Loại chi phí" :options="categoryOptions" />
          <UiTextarea v-model="form.note" label="Ghi chú" :rows="2" />
          <div>
            <div class="mb-2 text-sm font-medium text-muted">Tòa nhà áp dụng</div>
            <div class="space-y-2">
              <label
                v-for="building in buildings"
                :key="building.id"
                class="flex items-center gap-2 text-sm text-white"
              >
                <input v-model="form.buildingIds" type="checkbox" :value="building.id">
                <span>{{ building.name }}</span>
              </label>
            </div>
          </div>
          <div v-if="preview.length > 0" class="rounded-md bg-dark-bg/60 p-3 text-xs text-muted">
            <div
              v-for="row in preview"
              :key="row.buildingId"
              class="flex justify-between gap-3"
            >
              <span>{{ buildingName(row.buildingId) }}</span>
              <span class="tabular-nums text-white">{{ formatCurrency(row.amount) }}</span>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <UiButton type="button" variant="secondary" :disabled="busy" @click="resetForm">
              Hủy
            </UiButton>
            <UiButton type="submit" :loading="busy">
              {{ editing ? 'Lưu' : 'Tạo' }}
            </UiButton>
          </div>
        </form>

        <div class="space-y-4">
          <div class="flex flex-wrap items-end gap-3">
            <UiInput v-model="periodYear" label="Năm" type="number" class="w-32" />
            <UiInput v-model="periodMonth" label="Tháng" type="number" min="1" max="12" class="w-32" />
          </div>
          <div class="rounded-2xl border border-dark-border bg-dark-surface divide-y divide-dark-border">
            <div
              v-for="item in sharedExpenses"
              :key="item.id"
              class="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <div class="font-medium text-white">{{ item.name }}</div>
                <div class="mt-1 text-xs text-muted">
                  {{ EXPENSE_CATEGORY_LABELS[item.category] }} · {{ formatCurrency(item.amount) }}
                </div>
                <div class="mt-1 text-xs text-muted">
                  {{ item.buildingIds.map(buildingName).join(', ') }}
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <UiButton v-if="canWrite" size="sm" variant="secondary" @click="edit(item)">
                  Sửa
                </UiButton>
                <UiButton v-if="canAllocate" size="sm" :disabled="busy" @click="allocate(item)">
                  Phân bổ kỳ này
                </UiButton>
                <UiButton v-if="canWrite" size="sm" variant="danger" :disabled="busy" @click="deactivate(item)">
                  Ngừng
                </UiButton>
              </div>
            </div>
            <div v-if="sharedExpenses.length === 0" class="px-5 py-8">
              <UiEmptyState title="Chưa có chi phí dùng chung" description="Tạo khoản đầu tiên để phân bổ cho nhiều tòa nhà." />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
