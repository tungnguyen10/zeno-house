<script setup lang="ts">
import type { BillingDraftGridRow, BillingDraftGridUtilityCell, BillingDraftLine, BillingPeriod } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'
import { meterCellForLine, chargeTypeUnit, formatViNumber, formatMeterReading, formatMeterRate } from '~/utils/billing/meter-display'
import { groupChargeLines, chargeLineLabel, formatPeriodLabel } from '~/utils/billing/charge-groups'

const props = defineProps<{
  row: BillingDraftGridRow
  period: BillingPeriod | null
  buildingName?: string | null
}>()

const groups = computed(() => groupChargeLines(props.row.lines))

const totalAmount = computed(() =>
  props.row.draftTotal ?? props.row.lines.reduce((sum, line) => sum + line.amount, 0),
)

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
  <article class="bill-card">
    <header class="bill-header">
      <div class="bill-meta">
        <p v-if="buildingName" class="bill-building">{{ buildingName }}</p>
        <h2 class="bill-title">Phiếu thu tháng {{ periodLabel ?? '—' }}</h2>
      </div>
      <div class="bill-room">
        <p class="bill-room-number">Phòng {{ row.roomNumber ?? '—' }}</p>
        <p v-if="row.tenantName" class="bill-tenant">{{ row.tenantName }}</p>
      </div>
    </header>

    <section class="bill-body">
      <div
        v-for="group in groups"
        :key="group.key"
        class="bill-group"
      >
        <p class="bill-group-title">{{ group.title }}</p>
        <ul class="bill-lines">
          <li
            v-for="(line, lineIndex) in group.lines"
            :key="`${group.key}-${lineIndex}`"
            class="bill-line"
          >
            <div class="bill-line-main">
              <span class="bill-line-label">
                {{ chargeLineLabel(line.chargeType, line.label) }}
                <span
                  v-if="line.chargeType === 'service' && line.quantity > 1"
                  class="bill-line-mult"
                >
                  × {{ formatViNumber(line.quantity) }}
                </span>
              </span>
              <span
                v-if="meterCell(line)"
                class="bill-line-detail"
              >
                <template v-if="meterCell(line)!.previousValue !== null || meterCell(line)!.currentValue !== null">
                  {{ formatMeterReading(meterCell(line)!.previousValue) }}
                  → {{ formatMeterReading(meterCell(line)!.currentValue) }} ·
                </template>
                {{ formatViNumber(line.quantity) }} {{ unitFor(line) }}
                × {{ formatMeterRate(line.unitPrice, unitFor(line)) }}
              </span>
            </div>
            <span class="bill-line-amount">{{ formatCurrency(line.amount) }}</span>
          </li>
        </ul>
      </div>
    </section>

    <footer class="bill-footer">
      <span class="bill-total-label">Tổng cộng</span>
      <span class="bill-total-amount">{{ formatCurrency(totalAmount) }}</span>
    </footer>
  </article>
</template>

<style scoped>
.bill-card {
  display: flex;
  flex-direction: column;
  height: 132mm;
  padding: 8mm 10mm;
  background: white;
  color: #111;
  border: 1px solid #d1d5db;
  border-radius: 2mm;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 10pt;
  line-height: 1.35;
  box-sizing: border-box;
  overflow: hidden;
}

.bill-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8mm;
  padding-bottom: 3mm;
  border-bottom: 1px solid #e5e7eb;
}

.bill-meta {
  min-width: 0;
}

.bill-building {
  font-size: 9pt;
  color: #6b7280;
  margin: 0 0 1mm 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bill-title {
  font-size: 13pt;
  font-weight: 700;
  margin: 0;
  color: #111;
}

.bill-room {
  text-align: right;
}

.bill-room-number {
  font-size: 13pt;
  font-weight: 700;
  margin: 0;
  color: #111;
}

.bill-tenant {
  font-size: 9.5pt;
  color: #4b5563;
  margin: 1mm 0 0 0;
}

.bill-body {
  flex: 1;
  padding-top: 3mm;
  display: flex;
  flex-direction: column;
  gap: 2.5mm;
  min-height: 0;
}

.bill-group + .bill-group {
  margin-top: 0;
}

.bill-group-title {
  font-size: 8pt;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6b7280;
  margin: 0 0 1mm 0;
}

.bill-lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1mm;
}

.bill-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4mm;
}

.bill-line-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5mm;
}

.bill-line-label {
  font-size: 10pt;
  color: #111;
}

.bill-line-mult {
  font-size: 9pt;
  color: #6b7280;
  margin-left: 2px;
}

.bill-line-detail {
  font-size: 8.5pt;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}

.bill-line-amount {
  font-size: 10pt;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: #111;
}

.bill-footer {
  margin-top: 3mm;
  padding-top: 3mm;
  border-top: 2px solid #111;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.bill-total-label {
  font-size: 10pt;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bill-total-amount {
  font-size: 14pt;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
