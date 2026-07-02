<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import {
  FIXED_COST_CATEGORIES,
  FIXED_COST_CATEGORY_LABELS,
} from '~/utils/constants/operations-report'
import type { FixedCostCategory } from '~/utils/constants/operations-report'

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

const form = reactive({
  category: 'rent' as FixedCostCategory,
  amount: '',
  effective_from_period_year: props.periodYear,
  effective_from_period_month: props.periodMonth,
  note: '',
})

const error = ref<string | null>(null)

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
        v-model="form.amount"
        label="Số tiền / tháng (VND)"
        type="number"
        placeholder="0"
        required
      />

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

      <UiTextarea v-model="form.note" label="Ghi chú (tuỳ chọn)" :rows="2" />

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
