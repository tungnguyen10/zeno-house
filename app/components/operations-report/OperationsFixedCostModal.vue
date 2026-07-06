<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  FIXED_COST_CATEGORIES,
  FIXED_COST_CATEGORY_LABELS,
} from '~/utils/constants/operations-report'
import type { FixedCostCategory } from '~/utils/constants/operations-report'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  open: boolean
  buildingId: string
  periodYear: number
  periodMonth: number
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: Record<string, unknown>): void
}>()

const categoryOptions = FIXED_COST_CATEGORIES.map(value => ({
  value,
  label: FIXED_COST_CATEGORY_LABELS[value],
}))
const noteSuggestions = computed(() =>
  FIXED_COST_CATEGORIES.map(category => FIXED_COST_CATEGORY_LABELS[category]),
)

const form = reactive({
  category: 'rent' as FixedCostCategory,
  amount: '',
  effective_from_period_year: props.periodYear,
  effective_from_period_month: props.periodMonth,
  note: '',
})
const noteModel = computed<string | null>({
  get: () => form.note || null,
  set: value => { form.note = value ?? '' },
})

const error = ref<string | null>(null)

/** Show grouped digits while storing the raw number string in `form.amount`. */
const amountDisplay = computed<string>({
  get: () => (form.amount ? Number(form.amount).toLocaleString('vi-VN') : ''),
  set: (value) => {
    form.amount = value.replace(/\D/g, '')
  },
})

const amountPreview = computed(() => {
  const value = Number(form.amount)
  if (!form.amount || Number.isNaN(value) || value <= 0) return undefined
  return formatCurrency(value)
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = null
    form.category = 'rent'
    form.amount = ''
    form.effective_from_period_year = props.periodYear
    form.effective_from_period_month = props.periodMonth
    form.note = ''
  },
  { immediate: true },
)

function submit() {
  error.value = null
  const amount = Number(form.amount)
  if (!form.amount || Number.isNaN(amount) || amount < 0) {
    error.value = 'Số tiền không hợp lệ.'
    return
  }

  emit('submit', {
    building_id: props.buildingId,
    category: form.category,
    amount,
    effective_from_period_year: Number(form.effective_from_period_year),
    effective_from_period_month: Number(form.effective_from_period_month),
    note: form.note.trim() || null,
  })
}
</script>

<template>
  <UiModal :open="open" title="Thêm chi phí cố định" size="md" @close="emit('close')">
    <div class="space-y-4">
      <UiSelect
        v-model="form.category"
        label="Loại"
        :options="categoryOptions"
        required
      />

      <UiInput
        v-model="amountDisplay"
        label="Số tiền / tháng"
        type="text"
        inputmode="numeric"
        placeholder="0"
        input-class="text-lg font-semibold"
        :hint="amountPreview"
        required
      >
        <template #suffix>₫</template>
      </UiInput>

      <div class="grid grid-cols-2 gap-3">
        <UiInput
          v-model="form.effective_from_period_year"
          label="Áp dụng từ năm"
          type="number"
          required
        />
        <UiInput
          v-model="form.effective_from_period_month"
          label="Áp dụng từ tháng"
          type="number"
          required
        />
      </div>

      <UiCombobox
        v-model="noteModel"
        label="Tên/Ghi chú chi phí"
        :options="noteSuggestions"
        :option-key="name => name"
        :option-label="name => name"
        :create-option="name => name"
        allow-custom
        custom-option-label="Dùng"
        placeholder="Chọn mẫu hoặc nhập tên riêng"
        search-placeholder="Nhập tên chi phí"
        empty-message="Nhập tên mới để dùng"
      />

      <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UiButton variant="secondary" :disabled="submitting" @click="emit('close')">
          Huỷ
        </UiButton>
        <UiButton :loading="submitting" @click="submit">Thêm</UiButton>
      </div>
    </template>
  </UiModal>
</template>
