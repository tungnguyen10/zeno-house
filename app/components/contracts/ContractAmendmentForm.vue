<script setup lang="ts">
import type { ContractAmendment, ContractAmendmentChangeSet } from '~/types/contract-amendments'
import type { ContractWithDetails } from '~/types/contracts'
import type { ContractAmendmentCreateInput, ContractAmendmentUpdateInput } from '~/utils/validators/contract-amendments'

const props = defineProps<{
  contract: ContractWithDetails
  amendment?: ContractAmendment | null
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [input: ContractAmendmentCreateInput | ContractAmendmentUpdateInput]
  cancel: []
}>()

type ToggleKey = keyof ContractAmendmentChangeSet

const selected = reactive<Record<ToggleKey, boolean>>({
  monthlyRent: false,
  deposit: false,
  paymentDueDay: false,
  occupantCount: false,
  discountAmount: false,
  surchargeAmount: false,
})

const values = reactive({
  monthlyRent: '',
  deposit: '',
  paymentDueDay: '',
  occupantCount: '',
  discountAmount: '',
  surchargeAmount: '',
  inheritPaymentDueDay: false,
})

const form = reactive({ title: '', publicContent: '', effectiveDate: '' })
const errors = ref<Record<string, string>>({})
const isEditing = computed(() => Boolean(props.amendment))

function todayInVietnam(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function resetFromProps() {
  const changes = props.amendment?.changes ?? {}
  form.title = props.amendment?.title ?? ''
  form.publicContent = props.amendment?.publicContent ?? ''
  form.effectiveDate = props.amendment?.effectiveDate ?? ''
  for (const key of Object.keys(selected) as ToggleKey[]) selected[key] = Object.hasOwn(changes, key)
  values.monthlyRent = String(changes.monthlyRent ?? props.contract.monthlyRent)
  values.deposit = String(changes.deposit ?? props.contract.deposit)
  values.paymentDueDay = String(changes.paymentDueDay ?? props.contract.paymentDueDay ?? '')
  values.occupantCount = String(changes.occupantCount ?? props.contract.occupantCount)
  values.discountAmount = String(changes.discountAmount ?? props.contract.discountAmount)
  values.surchargeAmount = String(changes.surchargeAmount ?? props.contract.surchargeAmount)
  values.inheritPaymentDueDay = Object.hasOwn(changes, 'paymentDueDay') && changes.paymentDueDay === null
  errors.value = {}
}

watch(() => props.amendment, resetFromProps, { immediate: true })

function numericValue(key: Exclude<ToggleKey, 'paymentDueDay'>, minimum: number): number | null {
  const value = Number(values[key])
  if (!Number.isFinite(value) || value < minimum) {
    errors.value[key] = 'Giá trị không hợp lệ'
    return null
  }
  return value
}

function handleSubmit() {
  errors.value = {}
  if (!form.title.trim()) errors.value.title = 'Bắt buộc'
  if (!form.publicContent.trim()) errors.value.publicContent = 'Bắt buộc'
  if (!form.effectiveDate) errors.value.effectiveDate = 'Bắt buộc'
  if (!Object.values(selected).some(Boolean)) errors.value.changes = 'Chọn ít nhất một điều khoản thay đổi'

  const changes: ContractAmendmentCreateInput['changes'] = {}
  if (selected.monthlyRent) {
    const value = numericValue('monthlyRent', 0)
    if (value !== null) changes.monthly_rent = value
  }
  if (selected.deposit) {
    const value = numericValue('deposit', 0)
    if (value !== null) changes.deposit = value
  }
  if (selected.paymentDueDay) {
    if (values.inheritPaymentDueDay) changes.payment_due_day = null
    else {
      const value = Number(values.paymentDueDay)
      if (!Number.isInteger(value) || value < 1 || value > 31) errors.value.paymentDueDay = 'Nhập ngày từ 1 đến 31'
      else changes.payment_due_day = value
    }
  }
  if (selected.occupantCount) {
    const value = numericValue('occupantCount', 1)
    if (value !== null && Number.isInteger(value)) changes.occupant_count = value
    else if (value !== null) errors.value.occupantCount = 'Số người phải là số nguyên'
  }
  if (selected.discountAmount) {
    const value = numericValue('discountAmount', 0)
    if (value !== null) changes.discount_amount = value
  }
  if (selected.surchargeAmount) {
    const value = numericValue('surchargeAmount', 0)
    if (value !== null) changes.surcharge_amount = value
  }

  const hasRecurringChange = selected.monthlyRent || selected.paymentDueDay || selected.occupantCount
    || selected.discountAmount || selected.surchargeAmount
  if (hasRecurringChange && form.effectiveDate && !form.effectiveDate.endsWith('-01')) {
    errors.value.effectiveDate = 'Điều khoản ảnh hưởng hóa đơn phải hiệu lực vào ngày đầu tháng'
  }
  if (Object.keys(errors.value).length > 0) return

  const base: ContractAmendmentCreateInput = {
    title: form.title.trim(),
    public_content: form.publicContent.trim(),
    effective_date: form.effectiveDate,
    changes,
  }
  emit('submit', props.amendment
    ? { ...base, expected_updated_at: props.amendment.updatedAt }
    : base)
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="handleSubmit">
    <div>
      <h3 class="text-sm font-semibold text-ui-primary">
        {{ isEditing ? `Sửa phụ lục số ${amendment?.sequenceNo}` : 'Tạo phụ lục nháp' }}
      </h3>
      <p class="mt-1 text-xs text-ui-muted">Nội dung công khai sẽ hiển thị cho người đứng hợp đồng sau khi ban hành.</p>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <UiInput v-model="form.title" label="Tiêu đề" :error="errors.title" required />
      <UiDatePicker
        v-model="form.effectiveDate"
        label="Ngày hiệu lực"
        date-mode="future"
        :min-date="todayInVietnam()"
        :max-date="contract.endDate"
        :error="errors.effectiveDate"
        required
      />
    </div>
    <UiTextarea
      v-model="form.publicContent"
      label="Nội dung công khai"
      :rows="4"
      :error="errors.publicContent"
      placeholder="Mô tả ngắn gọn thỏa thuận mà khách thuê sẽ nhìn thấy..."
      required
    />

    <fieldset class="space-y-3 border-t border-ui-border pt-4">
      <legend class="px-1 text-sm font-medium text-ui-primary">Điều khoản thay đổi</legend>
      <UiAlert v-if="errors.changes" severity="danger">{{ errors.changes }}</UiAlert>
      <div class="grid gap-3 lg:grid-cols-2">
        <div class="space-y-2 rounded-lg border border-ui-border p-3">
          <UiCheckbox v-model="selected.monthlyRent" label="Tiền thuê hàng tháng" />
          <UiInput v-if="selected.monthlyRent" v-model="values.monthlyRent" type="number" number-mode="currency" :error="errors.monthlyRent" />
        </div>
        <div class="space-y-2 rounded-lg border border-ui-border p-3">
          <UiCheckbox v-model="selected.deposit" label="Tiền cọc" />
          <UiInput v-if="selected.deposit" v-model="values.deposit" type="number" number-mode="currency" :error="errors.deposit" />
        </div>
        <div class="space-y-2 rounded-lg border border-ui-border p-3">
          <UiCheckbox v-model="selected.paymentDueDay" label="Ngày thanh toán" />
          <template v-if="selected.paymentDueDay">
            <UiCheckbox v-model="values.inheritPaymentDueDay" label="Kế thừa cấu hình tòa nhà" />
            <UiInput v-if="!values.inheritPaymentDueDay" v-model="values.paymentDueDay" type="number" number-mode="day" min="1" max="31" :error="errors.paymentDueDay" />
          </template>
        </div>
        <div class="space-y-2 rounded-lg border border-ui-border p-3">
          <UiCheckbox v-model="selected.occupantCount" label="Số người tối đa" />
          <UiInput v-if="selected.occupantCount" v-model="values.occupantCount" type="number" number-mode="integer" min="1" :error="errors.occupantCount" />
        </div>
        <div class="space-y-2 rounded-lg border border-ui-border p-3">
          <UiCheckbox v-model="selected.discountAmount" label="Giảm giá" />
          <UiInput v-if="selected.discountAmount" v-model="values.discountAmount" type="number" number-mode="currency" :error="errors.discountAmount" />
        </div>
        <div class="space-y-2 rounded-lg border border-ui-border p-3">
          <UiCheckbox v-model="selected.surchargeAmount" label="Phụ thu" />
          <UiInput v-if="selected.surchargeAmount" v-model="values.surchargeAmount" type="number" number-mode="currency" :error="errors.surchargeAmount" />
        </div>
      </div>
    </fieldset>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <UiButton type="button" variant="secondary" @click="emit('cancel')">Hủy</UiButton>
      <UiButton type="submit" :loading="loading">{{ isEditing ? 'Lưu bản nháp' : 'Tạo bản nháp' }}</UiButton>
    </div>
  </form>
</template>
