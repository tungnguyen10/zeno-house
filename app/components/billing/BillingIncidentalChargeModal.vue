<script setup lang="ts">
import type { BillingDraftGridRow, BillingIncidentalCharge } from '~/types/billing'
import type { IncidentalChargeCreateInput, IncidentalChargeUpdateInput } from '~/utils/validators/billing'
import { incidentalChargeCreateSchema, incidentalChargeUpdateSchema } from '~/utils/validators/billing'
import { formatCurrency } from '~/utils/format/currency'
import { getApiErrorMessage } from '~/utils/api-error'

const props = defineProps<{
  open: boolean
  row: BillingDraftGridRow | null
  charge?: BillingIncidentalCharge | null
  onCreate: (input: IncidentalChargeCreateInput) => Promise<BillingIncidentalCharge>
  onUpdate: (chargeId: string, input: IncidentalChargeUpdateInput) => Promise<BillingIncidentalCharge>
  onDelete: (chargeId: string, expectedUpdatedAt: string) => Promise<void>
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const label = ref('')
const amount = ref<number | string>('')
const note = ref('')
const touched = reactive({ label: false, amount: false })
const submitting = ref(false)
const deleting = ref(false)
const deleteOpen = ref(false)
const formError = ref<string | null>(null)
const operationId = ref('')
const toast = useToast()

const isEditing = computed(() => !!props.charge)
const title = computed(() => isEditing.value ? 'Sửa khoản phát sinh' : 'Thêm khoản phát sinh')

function newOperationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16)
    return (token === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

function resetForm() {
  label.value = props.charge?.label ?? ''
  amount.value = props.charge?.amount ?? ''
  note.value = props.charge?.note ?? ''
  touched.label = false
  touched.amount = false
  formError.value = null
  deleteOpen.value = false
  operationId.value = newOperationId()
}

watch(() => [props.open, props.charge?.id] as const, ([open]) => {
  if (open) resetForm()
}, { immediate: true })

const parsedAmount = computed(() => Number(amount.value))
const labelError = computed(() => touched.label && label.value.trim().length === 0
  ? 'Cần nhập tên khoản phát sinh.'
  : undefined)
const amountError = computed(() => {
  if (!touched.amount) return undefined
  if (!Number.isInteger(parsedAmount.value) || parsedAmount.value <= 0) {
    return 'Số tiền phải là số nguyên lớn hơn 0.'
  }
  return undefined
})

function close() {
  if (submitting.value || deleting.value) return
  emit('close')
}

async function submit() {
  if (!props.row?.contractId) return
  touched.label = true
  touched.amount = true
  formError.value = null

  const normalizedNote = note.value.trim() || null
  const createInput = {
    contract_id: props.row.contractId,
    label: label.value,
    amount: parsedAmount.value,
    note: normalizedNote,
    operation_id: operationId.value,
  }
  const validation = isEditing.value
    ? incidentalChargeUpdateSchema.safeParse({
        label: label.value,
        amount: parsedAmount.value,
        note: normalizedNote,
        expected_updated_at: props.charge!.updatedAt,
      })
    : incidentalChargeCreateSchema.safeParse(createInput)
  if (!validation.success) {
    formError.value = validation.error.issues[0]?.message ?? 'Kiểm tra lại thông tin khoản phát sinh.'
    return
  }

  submitting.value = true
  try {
    if (props.charge) {
      await props.onUpdate(props.charge.id, validation.data as IncidentalChargeUpdateInput)
      toast.success('Đã cập nhật khoản phát sinh')
    }
    else {
      await props.onCreate(validation.data as IncidentalChargeCreateInput)
      toast.success('Đã thêm khoản phát sinh')
    }
    emit('saved')
    emit('close')
  }
  catch (error) {
    formError.value = getApiErrorMessage(error, 'Không thể lưu khoản phát sinh.')
  }
  finally {
    submitting.value = false
  }
}

async function confirmDelete() {
  if (!props.charge) return
  deleting.value = true
  formError.value = null
  try {
    await props.onDelete(props.charge.id, props.charge.updatedAt)
    toast.success('Đã xóa khoản phát sinh')
    deleteOpen.value = false
    emit('saved')
    emit('close')
  }
  catch (error) {
    deleteOpen.value = false
    formError.value = getApiErrorMessage(error, 'Không thể xóa khoản phát sinh.')
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <UiModal :open="open" :title="title" size="md" @close="close">
    <form class="space-y-4" @submit.prevent="submit">
      <div class="flex items-center justify-between gap-3 rounded-lg border border-dark-border bg-dark-surface px-3 py-2">
        <div class="min-w-0">
          <p class="text-xs text-muted">Áp dụng một lần trong kỳ này</p>
          <p class="truncate text-sm font-medium text-white">
            Phòng {{ row?.roomNumber ?? '—' }}<span v-if="row?.tenantName" class="font-normal text-muted"> · {{ row.tenantName }}</span>
          </p>
        </div>
        <span v-if="charge" class="shrink-0 text-sm font-semibold tabular-nums text-white">
          {{ formatCurrency(charge.amount) }}
        </span>
      </div>

      <UiAlert v-if="formError" severity="danger">{{ formError }}</UiAlert>

      <UiInput
        v-model="label"
        label="Tên khoản"
        placeholder="Ví dụ: Thay khóa cửa"
        :error="labelError"
        required
        maxlength="200"
        autofocus
        @blur="touched.label = true"
      />
      <UiInput
        v-model="amount"
        type="number"
        number-mode="currency"
        label="Số tiền (VNĐ)"
        placeholder="150000"
        min="1"
        max="999999999999"
        :error="amountError"
        required
        @blur="touched.amount = true"
      />
      <UiTextarea
        v-model="note"
        label="Ghi chú"
        placeholder="Thông tin đối soát hoặc lý do phát sinh"
        hint="Không bắt buộc · tối đa 500 ký tự"
        :rows="3"
        maxlength="500"
      />
    </form>

    <template #footer>
      <UiButton
        v-if="charge"
        variant="danger"
        class="sm:mr-auto"
        :disabled="submitting || deleting"
        @click="deleteOpen = true"
      >
        Xóa khoản
      </UiButton>
      <UiButton variant="secondary" :disabled="submitting || deleting" @click="close">Hủy</UiButton>
      <UiButton variant="primary" :loading="submitting" :disabled="deleting" @click="submit">
        {{ charge ? 'Lưu thay đổi' : 'Thêm khoản' }}
      </UiButton>
    </template>
  </UiModal>

  <UiConfirmModal
    :open="deleteOpen"
    title="Xóa khoản phát sinh?"
    message="Khoản này sẽ được bỏ khỏi tổng tiền kỳ hiện tại. Thao tác vẫn được lưu trong nhật ký."
    confirm-label="Xóa khoản"
    :loading="deleting"
    @cancel="deleteOpen = false"
    @confirm="confirmDelete"
  />
</template>
