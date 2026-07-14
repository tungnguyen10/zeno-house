<script setup lang="ts">
import type { AiActionPlanDto } from '~/types/ai'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{ plan: AiActionPlanDto }>()
const emit = defineEmits<{
  confirm: [id: string]
  cancel: [id: string]
}>()

const pending = computed(() => props.plan.status === 'pending')
const invoiceAction = computed(() => [
  'issue_invoices',
  'void_invoice',
  'reissue_invoice',
  'add_invoice_adjustment',
].includes(props.plan.actionType))

function previewNumber(key: string): number | null {
  const value = props.plan.preview[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const financialRows = computed(() => {
  const rows: Array<{ label: string; value: string }> = []
  const fields = props.plan.actionType === 'issue_invoices'
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
      value: key === 'issuableCount' ? String(value) : formatCurrency(value),
    })
  }
  return rows
})
</script>

<template>
  <article class="rounded-xl border border-cyan/30 bg-cyan/5 p-3 text-xs">
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="font-semibold text-white">{{ plan.title }}</p>
        <p class="mt-1 text-muted">{{ plan.summary }}</p>
      </div>
      <span class="rounded-full border border-dark-border px-2 py-0.5 text-[10px] uppercase text-muted">
        {{ plan.status }}
      </span>
    </div>

    <div v-if="invoiceAction && financialRows.length" class="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-dark-border bg-dark-border" data-testid="invoice-financial-preview">
      <div v-for="row in financialRows" :key="row.label" class="bg-dark-deep px-3 py-2">
        <p class="text-[10px] uppercase tracking-wide text-muted">{{ row.label }}</p>
        <p class="mt-0.5 font-semibold tabular-nums text-white">{{ row.value }}</p>
      </div>
    </div>

    <pre v-else-if="Object.keys(plan.preview).length" class="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-dark-surface p-2 text-[11px] text-white/80">{{ JSON.stringify(plan.preview, null, 2) }}</pre>

    <ul v-if="plan.warnings.length" class="mt-2 list-disc space-y-1 pl-4 text-amber-300">
      <li v-for="warning in plan.warnings" :key="warning">{{ warning }}</li>
    </ul>

    <div v-if="pending" class="mt-3 flex justify-end gap-2">
      <button type="button" class="rounded border border-dark-border px-3 py-1.5 text-muted hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40" @click="emit('cancel', plan.id)">
        Hủy
      </button>
      <button type="button" class="rounded bg-cyan px-3 py-1.5 font-semibold text-dark-deep hover:bg-cyan/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40" @click="emit('confirm', plan.id)">
        Xác nhận
      </button>
    </div>
  </article>
</template>
