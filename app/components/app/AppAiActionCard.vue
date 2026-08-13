<script setup lang="ts">
import type { AiActionPlanDto } from '~/types/ai'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{ plan: AiActionPlanDto; busy?: boolean; error?: string | null }>()
const emit = defineEmits<{
  confirm: [id: string]
  cancel: [id: string]
}>()

const pending = computed(() => props.plan.status === 'pending')
const isExpired = computed(() => {
  const expiry = Date.parse(props.plan.expiresAt)
  return Number.isFinite(expiry) && expiry <= Date.now()
})
const invoiceAction = computed(() => [
  'issue_invoices',
  'record_invoice_payments',
  'void_invoice',
  'reissue_invoice',
  'add_invoice_adjustment',
].includes(props.plan.actionType))
const paymentAction = computed(() => props.plan.actionType === 'record_invoice_payments')
const paymentCompleted = computed(() => paymentAction.value && props.plan.status === 'succeeded')

function previewNumber(key: string): number | null {
  const value = props.plan.preview[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const financialRows = computed(() => {
  const rows: Array<{ label: string; value: string }> = []
  const fields = props.plan.actionType === 'record_invoice_payments'
    ? [['Tổng phòng', 'eligibleCount'], ['Tổng ghi thu', 'totalAmount']]
    : props.plan.actionType === 'issue_invoices'
    ? [['Tổng phát hành', 'totalAmount'], ['Số hoá đơn', 'issuableCount']]
    : props.plan.actionType === 'void_invoice'
      ? [['Giá trị huỷ', 'total_amount']]
      : props.plan.actionType === 'reissue_invoice'
        ? [['Trước đính chính', 'old_total_amount'], ['Sau đính chính', 'new_total_amount']]
        : [['Tổng trước', 'total_before'], ['Tổng sau', 'total_after'], ['Còn phải thu', 'balance_after']]
  for (const [label, key] of fields) {
    const value = previewNumber(key!)
    if (value === null) continue
    rows.push({
      label: label!,
      value: ['issuableCount', 'eligibleCount'].includes(key!) ? String(value) : formatCurrency(value),
    })
  }
  return rows
})

function previewString(key: string): string | null {
  const value = props.plan.preview[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function displayDate(value: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function displayPaymentMethod(value: string | null): string {
  if (!value) return '—'
  if (value === 'cash') return 'Tiền mặt'
  if (value === 'bank_transfer') return 'Chuyển khoản'
  return value
}

const paymentRows = computed(() => {
  const value = props.plan.preview.eligible
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    return [{
      roomNumber: typeof row.roomNumber === 'string' ? row.roomNumber : '—',
      invoiceCode: typeof row.invoiceCode === 'string' ? row.invoiceCode : '—',
      amount: typeof row.amountToCollect === 'number' ? row.amountToCollect : 0,
    }]
  })
})
</script>

<template>
  <article class="rounded-xl border border-ui-accent/30 bg-ui-accent/5 p-3 text-xs">
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="font-semibold text-ui-primary">{{ plan.title }}</p>
        <p class="mt-1 text-ui-muted">{{ plan.summary }}</p>
      </div>
      <span class="rounded-full border border-ui-border px-2 py-0.5 text-[10px] uppercase text-ui-muted">
        {{ plan.status }}
      </span>
    </div>

    <div v-if="invoiceAction && financialRows.length && !paymentCompleted" class="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ui-border bg-ui-border" data-testid="invoice-financial-preview">
      <div v-for="row in financialRows" :key="row.label" class="bg-ui-deep px-3 py-2">
        <p class="text-[10px] uppercase tracking-wide text-ui-muted">{{ row.label }}</p>
        <p class="mt-0.5 font-semibold tabular-nums text-ui-primary">{{ row.value }}</p>
      </div>
      <div v-if="paymentAction" class="bg-ui-deep px-3 py-2">
        <p class="text-[10px] uppercase tracking-wide text-ui-muted">Ngày thu</p>
        <p class="mt-0.5 font-semibold tabular-nums text-ui-primary">{{ displayDate(previewString('paymentDate')) }}</p>
      </div>
      <div v-if="paymentAction" class="bg-ui-deep px-3 py-2">
        <p class="text-[10px] uppercase tracking-wide text-ui-muted">Phương thức</p>
        <p class="mt-0.5 font-semibold text-ui-primary">{{ displayPaymentMethod(previewString('paymentMethod')) }}</p>
      </div>
    </div>

    <ul v-if="paymentAction && paymentRows.length && !paymentCompleted" class="mt-3 divide-y divide-ui-border border-y border-ui-border" data-testid="invoice-payment-list">
      <li v-for="row in paymentRows" :key="`${row.roomNumber}:${row.invoiceCode}`" class="flex items-center justify-between gap-3 py-2">
        <span class="min-w-0">
          <span class="font-medium text-ui-primary">Phòng {{ row.roomNumber }}</span>
          <span class="ml-2 text-ui-muted">{{ row.invoiceCode }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums text-ui-primary">{{ formatCurrency(row.amount) }}</span>
      </li>
    </ul>

    <pre v-if="!invoiceAction && Object.keys(plan.preview).length" class="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-ui-surface p-2 text-[11px] text-ui-primary/80">{{ JSON.stringify(plan.preview, null, 2) }}</pre>

    <p v-if="paymentCompleted" class="mt-3 border-t border-ui-border pt-2 font-medium text-status-success" data-testid="invoice-payment-completed">
      Đã ghi thu thành công.
    </p>

    <ul v-if="plan.warnings.length && !paymentCompleted" class="mt-2 list-disc space-y-1 pl-4 text-status-warning">
      <li v-for="warning in plan.warnings" :key="warning">{{ warning }}</li>
    </ul>

    <p v-if="pending && isExpired" class="mt-2 rounded bg-status-warning/10 px-2 py-1.5 text-status-warning">
      Kế hoạch đã hết hạn, hãy yêu cầu trợ lý tạo preview mới.
    </p>

    <p v-if="error" class="mt-2 rounded bg-status-danger/10 px-2 py-1.5 text-status-danger" data-testid="action-error">
      {{ error }}
    </p>

    <div v-if="pending" class="mt-3 flex justify-end gap-2">
      <button
        type="button"
        :disabled="busy"
        class="rounded border border-ui-border px-3 py-1.5 text-ui-muted hover:text-ui-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
        @click="emit('cancel', plan.id)"
      >
        Hủy
      </button>
      <button
        type="button"
        :disabled="busy || isExpired"
        class="rounded bg-ui-accent px-3 py-1.5 font-semibold text-ui-on-accent hover:bg-ui-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
        @click="emit('confirm', plan.id)"
      >
        {{ busy ? 'Đang xử lý…' : 'Xác nhận' }}
      </button>
    </div>
  </article>
</template>
