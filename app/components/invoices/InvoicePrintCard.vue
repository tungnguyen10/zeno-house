<script setup lang="ts">
import type { InvoiceCharge, InvoicePrintItem } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'
import { chargeLineLabel, formatPeriodLabel, groupChargeLines } from '~/utils/billing/charge-groups'
import { chargeTypeUnit, formatMeterRate, formatMeterReading, formatViNumber } from '~/utils/billing/meter-display'

const props = defineProps<{ item: InvoicePrintItem }>()

const groups = computed(() => groupChargeLines(props.item.charges))

function dateLabel(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function metadataNumber(line: InvoiceCharge, key: string): number | null {
  const value = line.metadata[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function isMeterLine(line: InvoiceCharge): boolean {
  return line.chargeType === 'electricity' || line.chargeType === 'water'
}
</script>

<template>
  <article class="invoice-card">
    <header class="invoice-header">
      <div class="min-w-0">
        <p class="invoice-building">{{ item.building.name }}</p>
        <p class="invoice-address">{{ item.building.address }}</p>
        <h2 class="invoice-title">Hóa đơn tháng {{ formatPeriodLabel(item.period) }}</h2>
      </div>
      <div class="invoice-identity">
        <p class="invoice-code">{{ item.invoice.invoiceCode }}</p>
        <UiStatusBadge :status="item.invoice.status" context="invoice" />
      </div>
    </header>

    <dl class="invoice-meta">
      <div>
        <dt>Phòng / khách thuê</dt>
        <dd>Phòng {{ item.invoice.roomNumber ?? '—' }} · {{ item.invoice.tenantName ?? 'Khách thuê' }}</dd>
      </div>
      <div>
        <dt>Phát hành / hạn thanh toán</dt>
        <dd>{{ dateLabel(item.invoice.issuedAt) }} · {{ dateLabel(item.invoice.dueDate) }}</dd>
      </div>
    </dl>

    <section class="invoice-body">
      <div v-for="group in groups" :key="group.key" class="invoice-group">
        <p class="invoice-group-title">{{ group.title }}</p>
        <ul class="invoice-lines">
          <li v-for="line in group.lines" :key="line.id" class="invoice-line">
            <div class="invoice-line-main">
              <span>{{ chargeLineLabel(line.chargeType, line.label) }}</span>
              <span v-if="isMeterLine(line)" class="invoice-line-detail">
                <template v-if="metadataNumber(line, 'previous_reading_value') !== null || metadataNumber(line, 'current_reading_value') !== null">
                  {{ formatMeterReading(metadataNumber(line, 'previous_reading_value')) }}
                  → {{ formatMeterReading(metadataNumber(line, 'current_reading_value')) }} ·
                </template>
                {{ formatViNumber(line.quantity) }} {{ chargeTypeUnit(line.chargeType) }}
                × {{ formatMeterRate(line.unitPrice, chargeTypeUnit(line.chargeType)) }}
              </span>
              <span v-else-if="line.quantity > 1" class="invoice-line-detail">
                {{ formatViNumber(line.quantity) }} × {{ formatCurrency(line.unitPrice) }}
              </span>
            </div>
            <span class="invoice-line-amount">{{ formatCurrency(line.amount) }}</span>
          </li>
        </ul>
      </div>
    </section>

    <footer class="invoice-summary">
      <div><span>Tổng tiền</span><strong>{{ formatCurrency(item.invoice.totalAmount) }}</strong></div>
      <div><span>Đã thu</span><strong>{{ formatCurrency(item.invoice.paidAmount) }}</strong></div>
      <div class="invoice-balance"><span>Còn lại</span><strong>{{ formatCurrency(item.invoice.balanceAmount) }}</strong></div>
    </footer>
  </article>
</template>

<style scoped>
.invoice-card {
  display: flex;
  height: 132mm;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid #d1d5db;
  border-radius: 2mm;
  background: #fff;
  padding: 7mm 9mm;
  color: #111;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 9.5pt;
  line-height: 1.3;
}
.invoice-header { display: flex; justify-content: space-between; gap: 8mm; border-bottom: 1px solid #e5e7eb; padding-bottom: 2.5mm; }
.invoice-building { margin: 0; color: #374151; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.invoice-address { margin: .5mm 0 0; color: #6b7280; font-size: 7.5pt; }
.invoice-title { margin: 1.5mm 0 0; font-size: 13pt; font-weight: 700; }
.invoice-identity { display: flex; flex-shrink: 0; flex-direction: column; align-items: flex-end; gap: 1.5mm; }
.invoice-code { margin: 0; font-size: 9pt; font-weight: 700; }
.invoice-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin: 2.5mm 0 0; }
.invoice-meta dt { color: #6b7280; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .04em; }
.invoice-meta dd { margin: .5mm 0 0; font-size: 8.5pt; font-weight: 600; }
.invoice-body { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 2mm; padding-top: 2.5mm; }
.invoice-group-title { margin: 0 0 .75mm; color: #6b7280; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.invoice-lines { display: flex; list-style: none; margin: 0; padding: 0; flex-direction: column; gap: .75mm; }
.invoice-line { display: flex; align-items: baseline; justify-content: space-between; gap: 4mm; }
.invoice-line-main { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.invoice-line-detail { color: #6b7280; font-size: 7.5pt; font-variant-numeric: tabular-nums; }
.invoice-line-amount { flex-shrink: 0; white-space: nowrap; font-variant-numeric: tabular-nums; }
.invoice-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; border-top: 2px solid #111; padding-top: 2.5mm; }
.invoice-summary div { display: flex; flex-direction: column; gap: .5mm; }
.invoice-summary span { color: #6b7280; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .04em; }
.invoice-summary strong { font-size: 10.5pt; font-variant-numeric: tabular-nums; }
.invoice-balance { text-align: right; }
@media screen and (max-width: 640px) {
  .invoice-card { height: auto; min-height: 132mm; padding: 6mm; }
  .invoice-header { flex-direction: column; gap: 2mm; }
  .invoice-identity { align-items: flex-start; }
  .invoice-meta { grid-template-columns: 1fr; gap: 2mm; }
}
</style>
