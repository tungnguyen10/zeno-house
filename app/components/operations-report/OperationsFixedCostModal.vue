<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  FIXED_COST_CATEGORIES,
  FIXED_COST_CATEGORY_LABELS,
} from '~/utils/constants/operations-report'
import type { FixedCostCategory } from '~/utils/constants/operations-report'
import { formatCurrency } from '~/utils/format/currency'
import { formatPeriodString, parsePeriodString } from '~/utils/format/period'

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
  effective_from_period: formatPeriodString(props.periodYear, props.periodMonth),
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
    form.effective_from_period = formatPeriodString(props.periodYear, props.periodMonth)
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
  const period = parsePeriodString(form.effective_from_period)
  if (!period) {
    error.value = 'Chọn tháng áp dụng.'
    return
  }

  emit('submit', {
    building_id: props.buildingId,
    category: form.category,
    amount,
    effective_from_period_year: period.year,
    effective_from_period_month: period.month,
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

      <UiDatePicker
        v-model="form.effective_from_period"
        label="Áp dụng từ tháng"
        picker-mode="month"
        required
      />

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
