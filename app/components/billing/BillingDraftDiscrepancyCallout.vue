<script setup lang="ts">
import type { BillingDraftGridRow, BillingPeriod } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'
import { isPeriodLocked } from '~/utils/billing/lock'

const props = defineProps<{
  draft: BillingDraftGridRow
  period: BillingPeriod
}>()

const emit = defineEmits<{
  (e: 'intent:void-reissue', payload: { invoiceId: string }): void
}>()

const existingInvoice = computed(() => props.draft.existingInvoice ?? null)
const draftTotal = computed(() => props.draft.draftTotal ?? 0)
const delta = computed(() => {
  if (!existingInvoice.value || props.draft.draftTotal === null) return 0
  return draftTotal.value - existingInvoice.value.totalAmount
})

const visible = computed(() => !!existingInvoice.value && Math.abs(delta.value) >= 1000)
const periodClosed = computed(() => isPeriodLocked(props.period))
const hasPayment = computed(() => (existingInvoice.value?.paidAmount ?? 0) > 0)
const signedDelta = computed(() => `${delta.value > 0 ? '+' : ''}${formatCurrency(delta.value)}`)

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
        Kỳ đã chốt, cần mở lại kỳ trước khi sửa hoá đơn.
      </p>
      <p v-else-if="hasPayment" class="text-xs">
        Hoá đơn đã có thanh toán. Hoàn tác khoản thu trong tab Thu tiền & công nợ trước, sau đó huỷ và phát hành lại.
      </p>

      <div v-else class="flex flex-wrap items-center gap-2">
        <UiButton
          size="sm"
          variant="secondary"
          @click="emitVoidReissue"
        >
          Huỷ + Phát hành lại
        </UiButton>
      </div>
    </div>
  </UiAlert>
</template>
