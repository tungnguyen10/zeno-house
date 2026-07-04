<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { BuildingExpense } from '~/types/operations-report'
import type { ExpenseCategory } from '~/utils/constants/operations-report'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
} from '~/utils/constants/operations-report'
import { formatCurrency } from '~/utils/format/currency'

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

function today() {
  return new Date().toISOString().slice(0, 10)
}

const form = reactive({
  category: 'other' as ExpenseCategory,
  amount: '',
  expense_date: '',
  payee: '',
  payment_method: '',
  note: '',
})

const error = ref<string | null>(null)
const showDetails = ref(false)

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
    const e = props.expense
    form.category = e?.category ?? 'other'
    form.amount = e ? String(e.amount) : ''
    form.expense_date = e?.expenseDate ?? today()
    form.payee = e?.payee ?? ''
    form.payment_method = e?.paymentMethod ?? ''
    form.note = e?.note ?? ''
    // Expand extra fields only when the edited expense already uses them.
    showDetails.value = !!(e?.payee || e?.paymentMethod || e?.note)
  },
  { immediate: true },
)

function submit() {
  error.value = null
  const amount = Number(form.amount)
  if (!form.amount || Number.isNaN(amount) || amount <= 0) {
    error.value = 'Nhập số tiền lớn hơn 0.'
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
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <!-- Amount leads the form: prominent, grouped, and formatted. -->
      <UiInput
        v-model="amountDisplay"
        label="Số tiền"
        type="text"
        inputmode="numeric"
        placeholder="0"
        input-class="text-lg font-semibold"
        :hint="amountPreview"
        required
      >
        <template #suffix>₫</template>
      </UiInput>

      <UiSelect
        v-model="form.category"
        label="Loại chi phí"
        :options="categoryOptions"
        required
      />

      <UiInput
        v-model="form.expense_date"
        label="Ngày chi"
        type="date"
      />

      <!-- Optional fields stay collapsed so the common path is 3 fields. -->
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-muted transition-colors hover:text-white"
        @click="showDetails = !showDetails"
      >
        <span>Thêm chi tiết (người nhận, thanh toán, ghi chú)</span>
        <IconChevronDown
          class="h-4 w-4 transition-transform"
          :class="{ 'rotate-180': showDetails }"
          aria-hidden="true"
        />
      </button>

      <div v-if="showDetails" class="space-y-4">
        <UiInput
          v-model="form.payee"
          label="Người/đơn vị nhận"
          placeholder="VD: Điện lực, thợ sửa..."
        />

        <UiInput
          v-model="form.payment_method"
          label="Hình thức thanh toán"
          placeholder="Tiền mặt / chuyển khoản"
        />

        <UiTextarea
          v-model="form.note"
          label="Ghi chú"
          :rows="2"
        />
      </div>

      <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
    </form>

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
