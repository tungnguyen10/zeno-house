<script setup lang="ts">
import { addDays, formatDateOnlyVi } from '~/utils/format/date-only'
import { contractRenewSchema } from '~/utils/validators/contract-renewals'
import { formatCurrency } from '~/utils/format/currency'
import type { ContractRenewInput } from '~/utils/validators/contract-renewals'

const props = defineProps<{
  currentEndDate: string
  currentMonthlyRent: number
  occupantCount?: number
  serviceCount?: number
  depositHeld?: number
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

const operationId = crypto.randomUUID()
const successorStartDate = computed(() => addDays(props.currentEndDate, 1))

const fieldErrors = ref<Record<string, string>>({})

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.new_end_date) {
    fieldErrors.value.new_end_date = 'Bắt buộc'
  } else if (form.mode === 'new_contract' && form.new_end_date <= successorStartDate.value) {
    fieldErrors.value.new_end_date = 'Phải sau ngày bắt đầu hợp đồng mới'
  } else if (form.new_end_date <= props.currentEndDate) {
    fieldErrors.value.new_end_date = 'Phải sau ngày kết thúc hiện tại'
  }
  const rent = Number(form.new_monthly_rent)
  if (form.mode === 'new_contract' && (!form.new_monthly_rent.trim() || !Number.isFinite(rent) || rent < 0)) {
    fieldErrors.value.new_monthly_rent = 'Giá thuê không hợp lệ'
  }
  return Object.keys(fieldErrors.value).length === 0
}

function handleSubmit() {
  if (props.loading || !validate()) return
  const rent = Number(form.new_monthly_rent)
  const input: ContractRenewInput = form.mode === 'extend'
    ? {
        mode: 'extend',
        operation_id: operationId,
        new_end_date: form.new_end_date,
        new_monthly_rent: form.new_monthly_rent.trim() ? rent : undefined,
        reason: form.reason || null,
      }
    : {
        mode: 'new_contract',
        operation_id: operationId,
        new_end_date: form.new_end_date,
        new_monthly_rent: rent,
        reason: form.reason || null,
      }
  const result = contractRenewSchema.safeParse(input)
  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors.value[String(issue.path[0])] = issue.message
    return
  }
  emit('submit', result.data)
}
</script>

<template>
  <form class="space-y-4" novalidate :aria-busy="props.loading" @submit.prevent="handleSubmit">
    <UiAlert v-if="props.apiError" severity="danger">
      {{ props.apiError }}
    </UiAlert>

    <!-- Current term info -->
    <div class="rounded-md bg-ui-surface border border-ui-border px-4 py-3 text-sm text-ui-muted">
      Ngày kết thúc hiện tại:
      <span class="text-ui-primary font-medium">{{ formatDateOnlyVi(props.currentEndDate) }}</span>
      · Giá thuê:
      <span class="text-ui-primary font-medium">{{ formatCurrency(props.currentMonthlyRent) }}</span>
    </div>

    <!-- Mode -->
    <div class="flex flex-col gap-1.5">
      <span class="text-sm font-medium text-ui-muted">Hình thức gia hạn</span>
      <div class="grid gap-2 sm:grid-cols-2">
        <UiButton
          type="button"
          :disabled="props.loading"
          :aria-pressed="form.mode === 'extend'"
          :variant="form.mode === 'extend' ? 'primary' : 'secondary'"
          @click="form.mode = 'extend'"
        >
          Gia hạn đơn giản
        </UiButton>
        <UiButton
          type="button"
          :disabled="props.loading"
          :aria-pressed="form.mode === 'new_contract'"
          :variant="form.mode === 'new_contract' ? 'primary' : 'secondary'"
          @click="form.mode = 'new_contract'"
        >
          Hợp đồng mới
        </UiButton>
      </div>
      <p class="text-xs text-ui-muted">
        <template v-if="form.mode === 'extend'">Gia hạn tại chỗ — cùng hợp đồng, cập nhật ngày kết thúc.</template>
        <template v-else>Tạo hợp đồng kế tiếp — hợp đồng hiện tại chuyển sang trạng thái "đã gia hạn".</template>
      </p>
    </div>

    <div v-if="form.mode === 'new_contract'" class="space-y-1 border-l-2 border-ui-accent pl-3 text-sm">
      <p class="font-medium text-ui-primary">Hợp đồng mới bắt đầu: {{ formatDateOnlyVi(successorStartDate) }}</p>
      <p class="text-ui-muted">
        Chuyển sang hợp đồng mới: {{ props.occupantCount ?? '—' }} người ở · {{ props.serviceCount ?? '—' }} dịch vụ · Tiền cọc đang giữ: {{ props.depositHeld == null ? '—' : formatCurrency(props.depositHeld) }}.
      </p>
    </div>

    <UiDatePicker
      v-model="form.new_end_date"
      label="Ngày kết thúc mới"
      date-mode="period-end"
      :min-date="addDays(form.mode === 'new_contract' ? successorStartDate : props.currentEndDate, 1)"
      :disabled="props.loading"
      :error="fieldErrors.new_end_date"
      required
    />

    <UiInput
      v-model="form.new_monthly_rent"
      label="Giá thuê mới (VND)"
      type="number"
      number-mode="currency"
      :disabled="props.loading"
      :placeholder="`Mặc định: ${formatCurrency(props.currentMonthlyRent)}`"
      :error="fieldErrors.new_monthly_rent"
      :hint="form.mode === 'new_contract' ? undefined : 'Tuỳ chọn — bỏ trống để giữ giá hiện tại'"
      :required="form.mode === 'new_contract'"
    />

    <UiTextarea
      v-model="form.reason"
      label="Lý do gia hạn (tuỳ chọn)"
      :error="fieldErrors.reason"
      :rows="2"
      :disabled="props.loading"
      placeholder="Ghi chú lý do gia hạn..."
    />

    <div class="flex items-center justify-end gap-3 pt-2">
      <UiButton variant="ghost" type="button" :disabled="props.loading" @click="emit('cancel')">Huỷ</UiButton>
      <UiButton type="submit" :disabled="props.loading" :loading="props.loading">
        {{ form.mode === 'extend' ? 'Gia hạn' : 'Tạo hợp đồng mới' }}
      </UiButton>
    </div>
  </form>
</template>
