<script setup lang="ts">
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

type PaymentType = ContractPaymentCreateInput['payment_type']

const PAYMENT_TYPE_OPTIONS: { value: PaymentType, label: string }[] = [
  { value: 'deposit', label: 'Đặt cọc' },
  { value: 'prepaid_rent', label: 'Trả trước tiền thuê' },
  { value: 'rent', label: 'Tiền thuê' },
  { value: 'other', label: 'Khác' },
]

const form = reactive({
  payment_type: (props.initialData?.paymentType ?? 'deposit') as PaymentType,
  amount: props.initialData?.amount ? String(props.initialData.amount) : '',
  paid_at: props.initialData?.paidAt ?? new Date().toISOString().slice(0, 10),
  covered_period_start: props.initialData?.coveredPeriodStart ?? '',
  covered_period_end: props.initialData?.coveredPeriodEnd ?? '',
  payment_method: props.initialData?.paymentMethod ?? '',
  note: props.initialData?.note ?? '',
})

const fieldErrors = ref<Record<string, string>>({})

const showPeriod = computed(() => form.payment_type === 'prepaid_rent' || form.payment_type === 'rent')

const amountHint = computed(() => {
  const value = Number(form.amount)
  if (!form.amount || isNaN(value) || value <= 0) return undefined
  return formatCurrency(value)
})

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
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="handleSubmit">
    <UiAlert v-if="props.apiError" severity="danger">
      {{ props.apiError }}
    </UiAlert>

    <UiSelect
      v-model="form.payment_type"
      label="Loại thanh toán"
      :options="PAYMENT_TYPE_OPTIONS"
      :error="fieldErrors.payment_type"
      required
    />

    <UiInput
      v-model="form.amount"
      label="Số tiền (VND)"
      type="number"
      number-mode="currency"
      placeholder="ví dụ: 3000000"
      :error="fieldErrors.amount"
      :hint="amountHint"
      required
    />

    <UiInput
      v-model="form.paid_at"
      label="Ngày thanh toán"
      type="date"
      :error="fieldErrors.paid_at"
      required
    />

    <div v-if="showPeriod" class="grid grid-cols-2 gap-3">
      <UiInput
        v-model="form.covered_period_start"
        label="Kỳ bắt đầu"
        placeholder="2025-01"
        :error="fieldErrors.covered_period_start"
      />
      <UiInput
        v-model="form.covered_period_end"
        label="Kỳ kết thúc"
        placeholder="2025-03"
        :error="fieldErrors.covered_period_end"
      />
    </div>

    <UiInput
      v-model="form.payment_method"
      label="Hình thức thanh toán"
      placeholder="Tiền mặt, chuyển khoản, ..."
    />

    <UiTextarea
      v-model="form.note"
      label="Ghi chú"
      :rows="2"
      placeholder="Ghi chú thêm (tuỳ chọn)"
    />

    <div class="flex items-center justify-end gap-3 pt-2">
      <UiButton variant="ghost" type="button" @click="emit('cancel')">Huỷ</UiButton>
      <UiButton type="submit" :loading="props.loading">
        {{ isEdit ? 'Cập nhật' : 'Lưu thanh toán' }}
      </UiButton>
    </div>
  </form>
</template>
