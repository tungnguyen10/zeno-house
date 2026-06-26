<script setup lang="ts">
import { computed } from 'vue'
import type { BillingDraftGridRow, BillingDraftGridUtilityCell, BillingDraftLine, BillingPeriod } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  row: BillingDraftGridRow
  period: BillingPeriod | null
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'intent:adjustment', payload: { invoiceId: string; amount: number; label: string }): void
  (e: 'intent:void-reissue', payload: { invoiceId: string }): void
}>()

const periodLabel = computed(() => {
  if (!props.period) return null
  const month = String(props.period.periodMonth).padStart(2, '0')
  return `${month}/${props.period.periodYear}`
})

function meterCell(line: BillingDraftLine): BillingDraftGridUtilityCell | null {
  if (line.chargeType === 'electricity') return props.row.electricity
  if (line.chargeType === 'water') return props.row.water
  return null
}

function unitFor(line: BillingDraftLine): string {
  if (line.chargeType === 'electricity') return 'kWh'
  if (line.chargeType === 'water') return 'm³'
  return ''
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatReading(value: number | null): string {
  return value === null ? '—' : formatNumber(value)
}

function formatRate(value: number | null, unit: string): string {
  if (value === null) return '—'
  return unit ? `${formatCurrency(value)}/${unit}` : formatCurrency(value)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Context strip -->
    <div class="flex items-center justify-between text-xs text-muted">
      <span v-if="row.tenantName" class="truncate">{{ row.tenantName }}</span>
      <span v-if="periodLabel" class="shrink-0">Kỳ {{ periodLabel }}</span>
    </div>

    <UiAlert
      v-for="blocker in row.blockers"
      :key="`b-${blocker.code}`"
      severity="danger"
      :title="blocker.code"
    >
      {{ blocker.message }}
    </UiAlert>
    <UiAlert
      v-for="warning in row.warnings"
      :key="`w-${warning.code}`"
      severity="warning"
      :title="warning.code"
    >
      {{ warning.message }}
    </UiAlert>

    <BillingDraftDiscrepancyCallout
      v-if="period"
      :draft="row"
      :period="period"
      @intent:adjustment="$emit('intent:adjustment', $event)"
      @intent:void-reissue="$emit('intent:void-reissue', $event)"
    />

    <BillingChargeBreakdown
      v-if="row.lines.length > 0"
      :lines="row.lines"
      :total-amount="row.draftTotal ?? undefined"
    >
      <template #line-extra="{ line }">
        <p
          v-if="meterCell(line as BillingDraftLine)"
          class="mt-0.5 text-xs text-muted tabular-nums"
        >
          <template v-if="meterCell(line as BillingDraftLine)!.previousValue !== null || meterCell(line as BillingDraftLine)!.currentValue !== null">
            {{ formatReading(meterCell(line as BillingDraftLine)!.previousValue) }}
            <span class="opacity-60">→</span>
            {{ formatReading(meterCell(line as BillingDraftLine)!.currentValue) }}
            <span class="opacity-60">·</span>
          </template>
          {{ formatNumber(line.quantity) }} {{ unitFor(line as BillingDraftLine) }}
          <span class="opacity-60">×</span>
          {{ formatRate(line.unitPrice, unitFor(line as BillingDraftLine)) }}
        </p>
        <p
          v-else-if="line.chargeType === 'rent' && line.quantity !== 1"
          class="mt-0.5 text-xs text-muted tabular-nums"
        >
          {{ formatNumber(line.quantity) }} × {{ formatCurrency(line.unitPrice) }}
        </p>
        <p
          v-else-if="line.chargeType === 'service' && line.quantity > 1"
          class="mt-0.5 text-xs text-muted tabular-nums"
        >
          {{ formatNumber(line.quantity) }} × {{ formatCurrency(line.unitPrice) }}
        </p>
      </template>
    </BillingChargeBreakdown>
  </div>
</template>
