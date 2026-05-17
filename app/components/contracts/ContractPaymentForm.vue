<script setup lang="ts">
import clsx from 'clsx'
import { formatCurrency } from '~/utils/format/currency'
import type { ContractPayment } from '~/types/contract-payments'
import type { ContractPaymentCreateInput } from '~/utils/validators/contract-payments'

const props = defineProps<{
  loading?: boolean
  apiError?: string | null
  initialData?: ContractPayment | null
}>()

const emit = defineEmits<{
  'submit': [value: ContractPaymentCreateInput]
  'cancel': []
}>()

const isEdit = computed(() => !!props.initialData)

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: 'Đặt cọc',
  prepaid_rent: 'Trả trước tiền thuê',
  rent: 'Tiền thuê',
  other: 'Khác',
}

const form = reactive({
  payment_type: (props.initialData?.paymentType ?? 'deposit') as ContractPaymentCreateInput['payment_type'],
  amount: props.initialData?.amount ? String(props.initialData.amount) : '',
  paid_at: props.initialData?.paidAt ?? new Date().toISOString().slice(0, 10),
  covered_period_start: props.initialData?.coveredPeriodStart ?? '',
  covered_period_end: props.initialData?.coveredPeriodEnd ?? '',
  payment_method: props.initialData?.paymentMethod ?? '',
  note: props.initialData?.note ?? '',
})

const fieldErrors = ref<Record<string, string>>({})

const showPeriod = computed(() => form.payment_type === 'prepaid_rent' || form.payment_type === 'rent')

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.payment_type) fieldErrors.value.payment_type = 'Bắt buộc'
  const amt = Number(form.amount)
  if (!form.amount || isNaN(amt) || amt <= 0) fieldErrors.value.amount = 'Số tiền phải lớn hơn 0'
  if (!form.paid_at) fieldErrors.value.paid_at = 'Bắt buộc'
  if (showPeriod.value) {
    const periodRe = /^\d{4}-(0[1-9]|1[0-2])$/
    if (form.covered_period_start && !periodRe.test(form.covered_period_start)) {
      fieldErrors.value.covered_period_start = 'Định dạng YYYY-MM'
    }
    if (form.covered_period_end && !periodRe.test(form.covered_period_end)) {
      fieldErrors.value.covered_period_end = 'Định dạng YYYY-MM'
    }
  }
  return Object.keys(fieldErrors.value).length === 0
}

function handleSubmit() {
  if (!validate()) return
  const input: ContractPaymentCreateInput = {
    payment_type: form.payment_type,
    amount: Number(form.amount),
    paid_at: form.paid_at,
    covered_period_start: showPeriod.value && form.covered_period_start ? form.covered_period_start : null,
    covered_period_end: showPeriod.value && form.covered_period_end ? form.covered_period_end : null,
    payment_method: form.payment_method || null,
    note: form.note || null,
  }
  emit('submit', input)
}

const inputClass = 'block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500'
const labelClass = 'block text-sm font-medium text-zinc-300 mb-1'
const errorClass = 'mt-1 text-xs text-red-400'
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="handleSubmit">
    <!-- API error -->
    <div v-if="props.apiError" class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
      {{ props.apiError }}
    </div>

    <!-- Payment type -->
    <div>
      <label :class="labelClass">Loại thanh toán <span class="text-red-400">*</span></label>
      <select v-model="form.payment_type" :class="inputClass">
        <option v-for="(label, val) in PAYMENT_TYPE_LABELS" :key="val" :value="val">{{ label }}</option>
      </select>
      <p v-if="fieldErrors.payment_type" :class="errorClass">{{ fieldErrors.payment_type }}</p>
    </div>

    <!-- Amount -->
    <div>
      <label :class="labelClass">Số tiền (VND) <span class="text-red-400">*</span></label>
      <input
        v-model="form.amount"
        type="number"
        min="1"
        placeholder="ví dụ: 3000000"
        :class="clsx(inputClass, fieldErrors.amount && 'border-red-500')"
      >
      <p v-if="fieldErrors.amount" :class="errorClass">{{ fieldErrors.amount }}</p>
      <p v-else-if="form.amount && !isNaN(Number(form.amount)) && Number(form.amount) > 0" class="mt-1 text-xs text-zinc-400">
        {{ formatCurrency(Number(form.amount)) }}
      </p>
    </div>

    <!-- Paid at -->
    <div>
      <label :class="labelClass">Ngày thanh toán <span class="text-red-400">*</span></label>
      <input v-model="form.paid_at" type="date" :class="clsx(inputClass, fieldErrors.paid_at && 'border-red-500')" >
      <p v-if="fieldErrors.paid_at" :class="errorClass">{{ fieldErrors.paid_at }}</p>
    </div>

    <!-- Period (for prepaid_rent and rent) -->
    <template v-if="showPeriod">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label :class="labelClass">Kỳ bắt đầu</label>
          <input
            v-model="form.covered_period_start"
            type="text"
            placeholder="2025-01"
            :class="clsx(inputClass, fieldErrors.covered_period_start && 'border-red-500')"
          >
          <p v-if="fieldErrors.covered_period_start" :class="errorClass">{{ fieldErrors.covered_period_start }}</p>
        </div>
        <div>
          <label :class="labelClass">Kỳ kết thúc</label>
          <input
            v-model="form.covered_period_end"
            type="text"
            placeholder="2025-03"
            :class="clsx(inputClass, fieldErrors.covered_period_end && 'border-red-500')"
          >
          <p v-if="fieldErrors.covered_period_end" :class="errorClass">{{ fieldErrors.covered_period_end }}</p>
        </div>
      </div>
    </template>

    <!-- Payment method -->
    <div>
      <label :class="labelClass">Hình thức thanh toán</label>
      <input
        v-model="form.payment_method"
        type="text"
        placeholder="Tiền mặt, chuyển khoản, ..."
        :class="inputClass"
      >
    </div>

    <!-- Note -->
    <div>
      <label :class="labelClass">Ghi chú</label>
      <textarea v-model="form.note" rows="2" :class="inputClass" placeholder="Ghi chú thêm (tuỳ chọn)" />
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 pt-2">
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
        @click="emit('cancel')"
      >
        Huỷ
      </button>
      <button
        type="submit"
        :disabled="props.loading"
        class="px-4 py-2 text-sm font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
      {{ props.loading ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Lưu thanh toán') }}
      </button>
    </div>
  </form>
</template>
