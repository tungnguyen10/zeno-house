<script setup lang="ts">
import { computed } from 'vue'
import type { BillingDraftGridRow, BillingDraftGridUtilityCell, BillingDraftLine, BillingPeriod } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  row: BillingDraftGridRow
  period: BillingPeriod | null
  buildingName?: string | null
}>()

type GroupKey = 'rent' | 'utility' | 'service' | 'adjustment'

interface LineGroup {
  key: GroupKey
  title: string
  lines: BillingDraftLine[]
  subtotal: number
}

const sortedLines = computed<BillingDraftLine[]>(() =>
  [...props.row.lines].sort((a, b) => a.sortOrder - b.sortOrder),
)

const groups = computed<LineGroup[]>(() => {
  const buckets: Record<GroupKey, BillingDraftLine[]> = {
    rent: [],
    utility: [],
    service: [],
    adjustment: [],
  }

  for (const line of sortedLines.value) {
    switch (line.chargeType) {
      case 'rent':
        buckets.rent.push(line)
        break
      case 'electricity':
      case 'water':
        buckets.utility.push(line)
        break
      case 'service':
        buckets.service.push(line)
        break
      case 'discount':
      case 'surcharge':
      case 'adjustment':
        buckets.adjustment.push(line)
        break
      default:
        buckets.service.push(line)
    }
  }

  const titles: Record<GroupKey, string> = {
    rent: 'Tiền phòng',
    utility: 'Tiện ích',
    service: 'Dịch vụ',
    adjustment: 'Điều chỉnh',
  }

  const order: GroupKey[] = ['rent', 'utility', 'service', 'adjustment']
  return order
    .filter(key => buckets[key].length > 0)
    .map<LineGroup>(key => ({
      key,
      title: titles[key],
      lines: buckets[key],
      subtotal: buckets[key].reduce((sum, line) => sum + line.amount, 0),
    }))
})

const totalAmount = computed(() =>
  props.row.draftTotal ?? sortedLines.value.reduce((sum, line) => sum + line.amount, 0),
)

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

function lineLabel(line: BillingDraftLine): string {
  if (line.chargeType === 'rent') return 'Tiền thuê tháng'
  if (line.chargeType === 'electricity') return 'Điện'
  if (line.chargeType === 'water') return 'Nước'
  if (line.chargeType === 'discount') return line.label || 'Giảm giá'
  if (line.chargeType === 'surcharge') return line.label || 'Phụ thu'
  if (line.chargeType === 'adjustment') return line.label || 'Điều chỉnh'
  return line.label
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
                {{ lineLabel(line) }}
                <span
                  v-if="line.chargeType === 'service' && line.quantity > 1"
                  class="bill-line-mult"
                >
                  × {{ formatNumber(line.quantity) }}
                </span>
              </span>
              <span
                v-if="meterCell(line)"
                class="bill-line-detail"
              >
                <template v-if="meterCell(line)!.previousValue !== null || meterCell(line)!.currentValue !== null">
                  {{ formatReading(meterCell(line)!.previousValue) }}
                  → {{ formatReading(meterCell(line)!.currentValue) }} ·
                </template>
                {{ formatNumber(line.quantity) }} {{ unitFor(line) }}
                × {{ formatRate(line.unitPrice, unitFor(line)) }}
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
