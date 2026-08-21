<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { SharedExpense } from '~/types/shared-expenses'
import type { SharedExpenseCreateInput } from '~/utils/validators/shared-expenses'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from '~/utils/constants/operations-report'
import { sharedExpenseCreateSchema } from '~/utils/validators/shared-expenses'

const props = withDefaults(defineProps<{
  open: boolean
  expense?: SharedExpense | null
  buildings: Building[]
  buildingsLoading?: boolean
  buildingsError?: string | null
  saving: boolean
  nameSuggestions: string[]
}>(), {
  expense: null,
  buildingsLoading: false,
  buildingsError: null,
})

const emit = defineEmits<{
  close: []
  retryBuildings: []
  submit: [payload: SharedExpenseCreateInput]
}>()

interface FormErrors {
  name?: string
  amount?: string
  category?: string
  note?: string
  building_ids?: string
}

const form = reactive({
  name: '',
  category: 'other' as ExpenseCategory,
  amount: '',
  note: '',
  buildingIds: [] as string[],
})
const errors = reactive<FormErrors>({})

const categoryOptions = EXPENSE_CATEGORIES.map(value => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}))
const nameModel = computed<string | null>({
  get: () => form.name || null,
  set: value => { form.name = value ?? '' },
})
const title = computed(() => props.expense ? 'Sửa khoản chi' : 'Tạo khoản chi')

function resetErrors() {
  errors.name = undefined
  errors.amount = undefined
  errors.category = undefined
  errors.note = undefined
  errors.building_ids = undefined
}

function resetForm() {
  form.name = props.expense?.name ?? ''
  form.category = props.expense?.category ?? 'other'
  form.amount = props.expense ? String(props.expense.amount) : ''
  form.note = props.expense?.note ?? ''
  form.buildingIds = [...(props.expense?.buildingIds ?? [])]
  resetErrors()
}

watch(
  [() => props.open, () => props.expense],
  ([open]) => { if (open) resetForm() },
  { immediate: true },
)

function isBuildingSelected(id: string) {
  return form.buildingIds.includes(id)
}

function setBuildingSelected(id: string, selected: boolean) {
  form.buildingIds = selected
    ? [...new Set([...form.buildingIds, id])]
    : form.buildingIds.filter(buildingId => buildingId !== id)
  if (form.buildingIds.length > 0) errors.building_ids = undefined
}

function requestClose() {
  if (!props.saving) emit('close')
}

function submit() {
  resetErrors()
  const result = sharedExpenseCreateSchema.safeParse({
    name: form.name,
    category: form.category,
    amount: form.amount,
    note: form.note.trim() || null,
    building_ids: form.buildingIds,
  })
  if (!result.success) {
    const fields = result.error.flatten().fieldErrors
    errors.name = fields.name?.[0]
    errors.amount = fields.amount?.[0]
    errors.category = fields.category?.[0]
    errors.note = fields.note?.[0]
    errors.building_ids = fields.building_ids?.[0]
    return
  }
  emit('submit', result.data)
}
</script>

<template>
  <UiModal
    :open="open"
    :title="title"
    size="lg"
    mobile-fullscreen
    @close="requestClose"
  >
    <form id="shared-expense-form" class="space-y-4" @submit.prevent="submit">
      <div class="grid gap-3 sm:grid-cols-2">
        <UiCombobox
          v-model="nameModel"
          label="Tên chi phí"
          :options="nameSuggestions"
          :option-key="name => name"
          :option-label="name => name"
          :create-option="name => name"
          allow-custom
          required
          :error="errors.name"
          custom-option-label="Dùng"
          placeholder="Chọn mẫu hoặc nhập tên riêng"
          search-placeholder="Nhập tên chi phí"
          empty-message="Nhập tên mới để dùng"
        />
        <UiInput
          v-model="form.amount"
          label="Số tiền"
          type="number"
          number-mode="currency"
          min="1"
          required
          :error="errors.amount"
        />
      </div>

      <UiSelect
        v-model="form.category"
        label="Loại chi phí"
        :options="categoryOptions"
        required
        :error="errors.category"
      />
      <UiTextarea
        v-model="form.note"
        label="Ghi chú"
        :rows="2"
        :error="errors.note"
        hint="Thông tin này sẽ đi cùng khoản chi dùng chung."
      />

      <fieldset
        class="space-y-2"
        :aria-describedby="errors.building_ids ? 'shared-expense-buildings-error' : undefined"
      >
        <div class="flex items-center justify-between gap-3">
          <legend class="text-sm font-medium text-ui-muted">
            Tòa nhà áp dụng <span class="text-status-danger" aria-hidden="true">*</span>
          </legend>
          <UiBadge variant="accent">{{ form.buildingIds.length }}</UiBadge>
        </div>

        <UiAlert v-if="buildingsError" severity="danger" title="Không tải được tòa nhà">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span>{{ buildingsError }}</span>
            <UiButton type="button" size="sm" variant="secondary" @click="emit('retryBuildings')">
              Thử lại
            </UiButton>
          </div>
        </UiAlert>
        <div
          v-else
          class="max-h-60 space-y-2 overflow-y-auto rounded-md border border-ui-border bg-ui-deep p-3"
          :aria-busy="buildingsLoading"
        >
          <template v-if="buildingsLoading">
            <UiSkeleton v-for="index in 4" :key="index" class="h-5 w-full" />
          </template>
          <UiCheckbox
            v-for="building in buildings"
            v-else
            :key="building.id"
            :model-value="isBuildingSelected(building.id)"
            :label="building.name"
            @update:model-value="setBuildingSelected(building.id, $event)"
          />
          <p v-if="!buildingsLoading && buildings.length === 0" class="text-xs text-ui-muted">
            Chưa có tòa nhà trong phạm vi của bạn.
          </p>
        </div>
        <p
          v-if="errors.building_ids"
          id="shared-expense-buildings-error"
          class="text-xs text-status-danger"
          role="alert"
        >
          {{ errors.building_ids }}
        </p>
        <p v-else class="text-xs text-ui-muted">
          Số tiền sẽ được chia đều; phần dư làm tròn nằm ở tòa cuối cùng.
        </p>
      </fieldset>
    </form>

    <template #footer>
      <UiButton type="button" variant="secondary" :disabled="saving" @click="requestClose">
        Hủy
      </UiButton>
      <UiButton type="submit" form="shared-expense-form" :loading="saving">
        {{ expense ? 'Lưu thay đổi' : 'Tạo khoản chi' }}
      </UiButton>
    </template>
  </UiModal>
</template>
