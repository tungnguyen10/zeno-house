<script setup lang="ts">
import type { BillingDraftGridRow, BillingPeriod } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  draft: BillingDraftGridRow
  period: BillingPeriod
}>()

const emit = defineEmits<{
  (e: 'intent:adjustment', payload: { invoiceId: string; amount: number; label: string }): void
  (e: 'intent:void-reissue', payload: { invoiceId: string }): void
}>()

const correctionLabel = 'Điều chỉnh do override tiêu thụ'

const existingInvoice = computed(() => props.draft.existingInvoice ?? null)
const draftTotal = computed(() => props.draft.draftTotal ?? 0)
const delta = computed(() => {
  if (!existingInvoice.value || props.draft.draftTotal === null) return 0
  return draftTotal.value - existingInvoice.value.totalAmount
})

const visible = computed(() => !!existingInvoice.value && Math.abs(delta.value) >= 1000)
const periodClosed = computed(() => props.period.status === 'closed')
const hasPayment = computed(() => (existingInvoice.value?.paidAmount ?? 0) > 0)
const signedDelta = computed(() => `${delta.value > 0 ? '+' : ''}${formatCurrency(delta.value)}`)

function emitAdjustment() {
  const invoice = existingInvoice.value
  if (!invoice || periodClosed.value) return
  emit('intent:adjustment', {
    invoiceId: invoice.id,
    amount: -delta.value,
    label: correctionLabel,
  })
}

function emitVoidReissue() {
  const invoice = existingInvoice.value
  if (!invoice || periodClosed.value || hasPayment.value) return
  emit('intent:void-reissue', { invoiceId: invoice.id })
}
</script>

<template>
  <UiAlert
    v-if="visible && existingInvoice"
    severity="warning"
    title="Draft mới khác hoá đơn đã phát hành"
  >
    <div class="space-y-3">
      <p>
        Hoá đơn hiện tại
        <span class="font-semibold tabular-nums">{{ formatCurrency(existingInvoice.totalAmount) }}</span>
        · Draft sau override
        <span class="font-semibold tabular-nums">{{ formatCurrency(draftTotal) }}</span>
        · Chênh
        <span class="font-semibold tabular-nums">{{ signedDelta }}</span>
      </p>

      <p v-if="periodClosed" class="text-xs">
        Kỳ đã chốt, không thể tạo điều chỉnh hoặc huỷ hoá đơn từ màn hình này.
      </p>

      <div v-else class="flex flex-wrap items-center gap-2">
        <UiButton size="sm" variant="primary" @click="emitAdjustment">
          Tạo điều chỉnh
        </UiButton>
        <UiButton
          size="sm"
          variant="secondary"
          :disabled="hasPayment"
          :title="hasPayment ? 'Hoá đơn đã có thanh toán, dùng Điều chỉnh' : undefined"
          @click="emitVoidReissue"
        >
          Huỷ + Phát hành lại
        </UiButton>
        <span v-if="hasPayment" class="text-xs">
          Hoá đơn đã có thanh toán, dùng Điều chỉnh.
        </span>
      </div>
    </div>
  </UiAlert>
</template>
