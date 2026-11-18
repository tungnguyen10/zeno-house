<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import type { BuildingOtherIncome } from '~/types/operations-report'
import { buildingOtherIncomeCreateSchema, buildingOtherIncomeUpdateSchema } from '~/utils/validators/operations-report'
import { formatPeriodString } from '~/utils/format/period'
import { otherIncomeConflictReason, otherIncomeErrorMessage, useOtherIncomes } from '~/composables/operations-report/useOtherIncomes'

const props = defineProps<{
  income?: BuildingOtherIncome | null
  buildingId: string
  periodYear: number
  periodMonth: number
  canUseReserve: boolean
}>()
const emit = defineEmits<{ close: [], saved: [] }>()
const { createIncome, updateIncome } = useOtherIncomes()
const period = formatPeriodString(props.periodYear, props.periodMonth)
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())
const lastDay = new Date(Date.UTC(props.periodYear, props.periodMonth, 0)).getUTCDate()
const initial = props.income
const operationId = initial ? undefined : crypto.randomUUID()
const form = reactive({
  name: initial?.name ?? '',
  amount: initial ? String(initial.amount) : '',
  received_date: initial?.receivedDate ?? (today.startsWith(period) ? today : ''),
  allocation_target: initial?.allocationTarget ?? 'reserve_fund',
  payer: initial?.payer ?? '',
  payment_method: initial?.paymentMethod ?? '',
  transaction_reference: initial?.transactionReference ?? '',
  note: initial?.note ?? '',
})
const radioName = useId()
const showDetails = ref(!!(form.payer || form.payment_method || form.transaction_reference || form.note))
const saving = ref(false)
const error = ref('')
const duplicateWarning = ref(false)
const confirmed = ref(false)
const reserveRestricted = computed(() => !props.canUseReserve && form.allocation_target === 'reserve_fund')
const paymentOptions = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_transfer', label: 'Chuyển khoản' },
]
const allocations = [
  { value: 'reserve_fund', label: 'Quỹ dự phòng' },
  { value: 'profit', label: 'Lợi nhuận' },
] as const

watch(form, () => {
  duplicateWarning.value = false
  confirmed.value = false
  error.value = ''
})

async function submit() {
  if (saving.value || reserveRestricted.value || (duplicateWarning.value && !confirmed.value)) return
  error.value = ''
  if (!form.received_date.startsWith(`${period}-`)) {
    error.value = `Chọn ngày thu trong tháng ${props.periodMonth}/${props.periodYear}.`
    return
  }
  const fields = {
    name: form.name, amount: Number(form.amount), received_date: form.received_date,
    allocation_target: form.allocation_target, payer: form.payer.trim() || null,
    payment_method: form.payment_method || null, transaction_reference: form.transaction_reference.trim() || null,
    note: form.note.trim() || null, confirm_duplicate: confirmed.value,
  }
  saving.value = true
  try {
    if (initial) {
      const result = buildingOtherIncomeUpdateSchema.safeParse({ ...fields, expected_updated_at: initial.updatedAt })
      if (!result.success) { error.value = result.error.issues[0]!.message; return }
      await updateIncome(initial.id, result.data)
    }
    else {
      const result = buildingOtherIncomeCreateSchema.safeParse({
        ...fields, building_id: props.buildingId, period_year: props.periodYear,
        period_month: props.periodMonth, operation_id: operationId,
      })
      if (!result.success) { error.value = result.error.issues[0]!.message; return }
      await createIncome(result.data)
    }
    emit('saved')
  }
  catch (err) {
    if (otherIncomeConflictReason(err) === 'OTHER_INCOME_DUPLICATE') {
      duplicateWarning.value = true
      confirmed.value = false
    }
    else error.value = otherIncomeErrorMessage(err)
  }
  finally { saving.value = false }
}
</script>

<template>
  <UiModal open :title="income ? 'Sửa khoản thu' : 'Thêm khoản thu'" size="md" @close="!saving && emit('close')">
    <form novalidate @submit.prevent="submit">
      <fieldset class="min-w-0 space-y-4" :disabled="saving">
        <p class="text-sm text-ui-muted">
          Chỉ ghi tiền tòa nhà đã nhận ngoài hóa đơn phòng, ví dụ tiền thanh lý thiết bị.
          Phí thu thêm của phòng được ghi trong Billing.
        </p>
        <UiInput v-model="form.amount" type="number" number-mode="currency" label="Số tiền" placeholder="0" input-class="text-lg font-semibold" required />
        <UiInput v-model="form.name" label="Tên khoản thu" maxlength="200" placeholder="Ví dụ: Thanh lý máy bơm" required />
        <UiDatePicker
          v-model="form.received_date" label="Ngày thu" date-mode="operational"
          :min-date="`${period}-01`" :max-date="`${period}-${lastDay}`" typeable required
        />
        <fieldset>
          <legend class="mb-1.5 text-sm font-medium text-ui-primary">Phân bổ vào</legend>
          <div class="grid grid-cols-2 gap-2">
            <label
              v-for="allocation in allocations" :key="allocation.value"
              class="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm"
              :class="[
                form.allocation_target === allocation.value ? 'border-ui-accent bg-ui-surface text-ui-primary' : 'border-ui-border text-ui-muted',
                allocation.value === 'reserve_fund' && !canUseReserve ? 'cursor-not-allowed' : 'cursor-pointer',
              ]"
            >
              <input
                v-model="form.allocation_target" type="radio" :name="radioName" :value="allocation.value"
                :disabled="allocation.value === 'reserve_fund' && !canUseReserve"
                class="accent-ui-accent focus-visible:ring-2 focus-visible:ring-ui-accent"
              >
              {{ allocation.label }}
            </label>
          </div>
          <p aria-live="polite" class="mt-1.5 text-xs text-ui-muted">
            <template v-if="reserveRestricted">Bạn cần quyền quản lý quỹ để chọn quỹ dự phòng. Chọn Lợi nhuận để tiếp tục.</template>
            <template v-else-if="form.allocation_target === 'reserve_fund'">Toàn bộ số tiền được cộng vào quỹ ngay khi lưu và được loại khỏi lợi nhuận.</template>
            <template v-else>Toàn bộ số tiền được tính vào lợi nhuận vận hành.</template>
          </p>
        </fieldset>
        <button
          type="button" :aria-expanded="showDetails"
          class="flex min-h-10 w-full items-center justify-between rounded-md border border-ui-border px-3 py-2 text-sm text-ui-muted hover:text-ui-primary focus-visible:ring-2 focus-visible:ring-ui-accent"
          @click="showDetails = !showDetails"
        >
          Chi tiết thanh toán và ghi chú
          <IconChevronDown class="h-4 w-4" :class="{ 'rotate-180': showDetails }" aria-hidden="true" />
        </button>
        <div v-if="showDetails" class="space-y-4">
          <UiInput v-model="form.payer" label="Người nộp" maxlength="200" />
          <UiSelect v-model="form.payment_method" label="Phương thức thanh toán" placeholder="Chọn phương thức" :options="paymentOptions" />
          <UiInput v-model="form.transaction_reference" label="Mã giao dịch" maxlength="100" />
          <UiTextarea v-model="form.note" label="Ghi chú" maxlength="500" :rows="2" />
        </div>
        <UiAlert v-if="duplicateWarning" severity="warning">
          <p class="mb-2">Khoản thu có dấu hiệu trùng với một giao dịch đã ghi nhận.</p>
          <UiCheckbox v-model="confirmed" label="Tôi xác nhận đây là khoản thu độc lập." />
        </UiAlert>
        <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
      </fieldset>
    </form>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UiButton variant="secondary" :disabled="saving" @click="emit('close')">Hủy</UiButton>
        <UiButton :loading="saving" :disabled="reserveRestricted || (duplicateWarning && !confirmed)" @click="submit">
          {{ income ? 'Lưu' : 'Thêm' }}
        </UiButton>
      </div>
    </template>
  </UiModal>
</template>
