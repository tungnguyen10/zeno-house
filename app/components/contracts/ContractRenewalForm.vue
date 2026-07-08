<script setup lang="ts">
import { formatCurrency } from '~/utils/format/currency'
import type { ContractRenewInput } from '~/utils/validators/contract-renewals'

const props = defineProps<{
  currentEndDate: string
  currentMonthlyRent: number
  loading?: boolean
  apiError?: string | null
}>()

const emit = defineEmits<{
  'submit': [value: ContractRenewInput]
  'cancel': []
}>()

const form = reactive({
  mode: 'extend' as 'extend' | 'new_contract',
  new_end_date: '',
  new_monthly_rent: String(props.currentMonthlyRent),
  reason: '',
})

const fieldErrors = ref<Record<string, string>>({})

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.new_end_date) {
    fieldErrors.value.new_end_date = 'Bắt buộc'
  } else if (form.new_end_date <= props.currentEndDate) {
    fieldErrors.value.new_end_date = 'Phải sau ngày kết thúc hiện tại'
  }
  const rent = Number(form.new_monthly_rent)
  if (form.mode === 'new_contract' && (isNaN(rent) || rent < 0)) {
    fieldErrors.value.new_monthly_rent = 'Giá thuê không hợp lệ'
  }
  return Object.keys(fieldErrors.value).length === 0
}

function handleSubmit() {
  if (!validate()) return
  const rent = Number(form.new_monthly_rent)
  const input: ContractRenewInput = form.mode === 'extend'
    ? {
        mode: 'extend',
        new_end_date: form.new_end_date,
        new_monthly_rent: !isNaN(rent) && rent > 0 ? rent : undefined,
        reason: form.reason || null,
      }
    : {
        mode: 'new_contract',
        new_end_date: form.new_end_date,
        new_monthly_rent: rent,
        reason: form.reason || null,
      }
  emit('submit', input)
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="handleSubmit">
    <UiAlert v-if="props.apiError" severity="danger">
      {{ props.apiError }}
    </UiAlert>

    <!-- Current term info -->
    <div class="rounded-md bg-dark-surface border border-dark-border px-4 py-3 text-sm text-muted">
      Ngày kết thúc hiện tại:
      <span class="text-white font-medium">{{ new Date(props.currentEndDate).toLocaleDateString('vi-VN') }}</span>
      · Giá thuê:
      <span class="text-white font-medium">{{ formatCurrency(props.currentMonthlyRent) }}</span>
    </div>

    <!-- Mode -->
    <div class="flex flex-col gap-1.5">
      <span class="text-sm font-medium text-muted">Hình thức gia hạn</span>
      <div class="grid grid-cols-2 gap-2">
        <UiButton
          type="button"
          :variant="form.mode === 'extend' ? 'primary' : 'secondary'"
          @click="form.mode = 'extend'"
        >
          Gia hạn đơn giản
        </UiButton>
        <UiButton
          type="button"
          :variant="form.mode === 'new_contract' ? 'primary' : 'secondary'"
          @click="form.mode = 'new_contract'"
        >
          Hợp đồng mới
        </UiButton>
      </div>
      <p class="text-xs text-muted">
        <template v-if="form.mode === 'extend'">Gia hạn tại chỗ — cùng hợp đồng, cập nhật ngày kết thúc.</template>
        <template v-else>Tạo hợp đồng kế tiếp — hợp đồng hiện tại chuyển sang trạng thái "đã gia hạn".</template>
      </p>
    </div>

    <UiInput
      v-model="form.new_end_date"
      label="Ngày kết thúc mới"
      type="date"
      :error="fieldErrors.new_end_date"
      required
    />

    <UiInput
      v-model="form.new_monthly_rent"
      label="Giá thuê mới (VND)"
      type="number"
      number-mode="currency"
      :placeholder="`Mặc định: ${formatCurrency(props.currentMonthlyRent)}`"
      :error="fieldErrors.new_monthly_rent"
      :hint="form.mode === 'new_contract' ? undefined : 'Tuỳ chọn — bỏ trống để giữ giá hiện tại'"
      :required="form.mode === 'new_contract'"
    />

    <UiTextarea
      v-model="form.reason"
      label="Lý do gia hạn (tuỳ chọn)"
      :rows="2"
      placeholder="Ghi chú lý do gia hạn..."
    />

    <div class="flex items-center justify-end gap-3 pt-2">
      <UiButton variant="ghost" type="button" @click="emit('cancel')">Huỷ</UiButton>
      <UiButton type="submit" :loading="props.loading">
        {{ form.mode === 'extend' ? 'Gia hạn' : 'Tạo hợp đồng mới' }}
      </UiButton>
    </div>
  </form>
</template>
