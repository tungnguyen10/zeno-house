<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { BuildingExpense } from '~/types/operations-report'
import type { ExpenseCategory } from '~/utils/constants/operations-report'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
} from '~/utils/constants/operations-report'

const props = defineProps<{
  open: boolean
  /** When set, the modal edits this expense; otherwise it creates a new one. */
  expense?: BuildingExpense | null
  buildingId: string
  periodYear: number
  periodMonth: number
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: Record<string, unknown>): void
}>()

const isEdit = computed(() => !!props.expense)

const categoryOptions = EXPENSE_CATEGORIES.map(value => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}))

const form = reactive({
  category: 'other' as ExpenseCategory,
  amount: '',
  expense_date: '',
  payee: '',
  payment_method: '',
  note: '',
})

const error = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = null
    const e = props.expense
    form.category = e?.category ?? 'other'
    form.amount = e ? String(e.amount) : ''
    form.expense_date = e?.expenseDate ?? ''
    form.payee = e?.payee ?? ''
    form.payment_method = e?.paymentMethod ?? ''
    form.note = e?.note ?? ''
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

  const base: Record<string, unknown> = {
    category: form.category,
    amount,
    expense_date: form.expense_date.trim() || null,
    payee: form.payee.trim() || null,
    payment_method: form.payment_method.trim() || null,
    note: form.note.trim() || null,
  }

  if (!isEdit.value) {
    base.building_id = props.buildingId
    base.period_year = props.periodYear
    base.period_month = props.periodMonth
  }

  emit('submit', base)
}
</script>

<template>
  <UiModal
    :open="open"
    :title="isEdit ? 'Sửa chi phí' : 'Thêm chi phí'"
    size="md"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <UiSelect
        v-model="form.category"
        label="Loại chi phí"
        :options="categoryOptions"
        required
      />

      <UiInput
        v-model="form.amount"
        label="Số tiền (VND)"
        type="number"
        placeholder="0"
        required
      />

      <UiInput
        v-model="form.expense_date"
        label="Ngày chi (tuỳ chọn)"
        type="date"
      />

      <UiInput
        v-model="form.payee"
        label="Người/đơn vị nhận (tuỳ chọn)"
        placeholder="VD: Điện lực, thợ sửa..."
      />

      <UiInput
        v-model="form.payment_method"
        label="Hình thức thanh toán (tuỳ chọn)"
        placeholder="Tiền mặt / chuyển khoản"
      />

      <UiTextarea
        v-model="form.note"
        label="Ghi chú (tuỳ chọn)"
        :rows="2"
      />

      <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UiButton variant="secondary" :disabled="submitting" @click="emit('close')">
          Huỷ
        </UiButton>
        <UiButton :loading="submitting" @click="submit">
          {{ isEdit ? 'Lưu' : 'Thêm' }}
        </UiButton>
      </div>
    </template>
  </UiModal>
</template>
