<script setup lang="ts">
import type { BillingDraftGridRow, BillingDraftGridUtilityCell, BillingDraftLine, BillingPeriod } from '~/types/billing'
import { meterCellForLine, chargeTypeUnit, formatViNumber, formatMeterReading, formatMeterRate } from '~/utils/billing/meter-display'
import { formatPeriodLabel } from '~/utils/billing/charge-groups'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  row: BillingDraftGridRow
  period: BillingPeriod | null
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'intent:void-reissue', payload: { invoiceId: string }): void
}>()

const periodLabel = computed(() => formatPeriodLabel(props.period))

// Thin wrappers that close over props.row / simplify chargeType cast in template.
function meterCell(line: BillingDraftLine): BillingDraftGridUtilityCell | null {
  return meterCellForLine(props.row, line.chargeType)
}

function unitFor(line: BillingDraftLine): string {
  return chargeTypeUnit(line.chargeType)
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
      @intent:void-reissue="$emit('intent:void-reissue', $event)"
    />

    <BillingChargeBreakdown
      v-if="row.lines.length > 0"
      :lines="row.lines"
      :total-amount="row.draftTotal ?? undefined"
      :show-adjustments="true"
    >
      <template #line-extra="{ line }">
        <p
          v-if="meterCell(line as BillingDraftLine)"
          class="mt-0.5 text-xs text-muted tabular-nums"
        >
          <template v-if="meterCell(line as BillingDraftLine)!.previousValue !== null || meterCell(line as BillingDraftLine)!.currentValue !== null">
            {{ formatMeterReading(meterCell(line as BillingDraftLine)!.previousValue) }}
            <span class="opacity-60">→</span>
            {{ formatMeterReading(meterCell(line as BillingDraftLine)!.currentValue) }}
            <span class="opacity-60">·</span>
          </template>
          {{ formatViNumber(line.quantity) }} {{ unitFor(line as BillingDraftLine) }}
          <span class="opacity-60">×</span>
          {{ formatMeterRate(line.unitPrice, unitFor(line as BillingDraftLine)) }}
        </p>
        <p
          v-else-if="line.chargeType === 'rent' && line.quantity !== 1"
          class="mt-0.5 text-xs text-muted tabular-nums"
        >
          {{ formatViNumber(line.quantity) }} × {{ formatCurrency(line.unitPrice) }}
        </p>
        <p
          v-else-if="line.chargeType === 'service' && line.quantity > 1"
          class="mt-0.5 text-xs text-muted tabular-nums"
        >
          {{ formatViNumber(line.quantity) }} × {{ formatCurrency(line.unitPrice) }}
        </p>
      </template>
    </BillingChargeBreakdown>
  </div>
</template>
