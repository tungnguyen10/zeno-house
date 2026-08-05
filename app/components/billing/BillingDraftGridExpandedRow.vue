<script setup lang="ts">
import type { BillingDraftGridRow, BillingDraftGridUtilityCell, BillingDraftLine, BillingIncidentalCharge, BillingPeriod } from '~/types/billing'
import { meterCellForLine, chargeTypeUnit, formatViNumber, formatMeterReading, formatMeterRate } from '~/utils/billing/meter-display'
import { formatPeriodLabel } from '~/utils/billing/charge-groups'
import { formatCurrency } from '~/utils/format/currency'

const props = withDefaults(defineProps<{
  row: BillingDraftGridRow
  period: BillingPeriod | null
  incidentalCharges?: BillingIncidentalCharge[]
  canManageIncidental?: boolean
}>(), {
  incidentalCharges: () => [],
  canManageIncidental: true,
})

defineEmits<{
  (e: 'close' | 'add-incidental'): void
  (e: 'intent:void-reissue', payload: { invoiceId: string }): void
  (e: 'edit-incidental', charge: BillingIncidentalCharge): void
}>()

const periodLabel = computed(() => formatPeriodLabel(props.period))
const standardLines = computed(() => props.row.lines.filter(line => line.chargeType !== 'incidental'))

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
      v-if="standardLines.length > 0"
      :lines="standardLines"
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

    <section class="border-t border-dark-border pt-4" aria-labelledby="incidental-charge-heading">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 id="incidental-charge-heading" class="text-sm font-semibold text-white">Khoản phát sinh kỳ này</h3>
          <p class="mt-0.5 text-xs text-muted">Chỉ tính cho phòng này trong kỳ đang xem.</p>
        </div>
        <UiButton v-if="canManageIncidental && row.editable && row.contractId" variant="ghost" size="sm" class="shrink-0 whitespace-nowrap" @click="$emit('add-incidental')">
          <IconPlus class="h-4 w-4" aria-hidden="true" />
          Thêm khoản
        </UiButton>
      </div>

      <div v-if="incidentalCharges?.length" class="mt-3 divide-y divide-dark-border">
        <div v-for="charge in incidentalCharges" :key="charge.id" class="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div class="min-w-0">
            <p class="text-sm font-medium text-white">{{ charge.label }}</p>
            <p v-if="charge.note" class="mt-0.5 break-words text-xs text-muted">{{ charge.note }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span class="text-sm font-semibold tabular-nums text-white">{{ formatCurrency(charge.amount) }}</span>
            <UiButton
              v-if="canManageIncidental && row.editable"
              unstyled
              class="inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-dark-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
              :aria-label="`Sửa ${charge.label}`"
              @click="$emit('edit-incidental', charge)"
            >
              <IconPencilSquare class="h-4 w-4" aria-hidden="true" />
            </UiButton>
          </div>
        </div>
      </div>
      <p v-else class="mt-3 text-sm text-muted">Chưa có khoản phát sinh trong kỳ này.</p>

      <UiAlert v-if="!row.editable && incidentalCharges?.length" class="mt-3" severity="info">
        Hóa đơn đã phát hành hoặc kỳ đã khóa. Dùng luồng điều chỉnh hóa đơn nếu cần thay đổi.
      </UiAlert>
    </section>
  </div>
</template>
