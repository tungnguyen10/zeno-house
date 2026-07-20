<script setup lang="ts">
import type { InvoiceCharge, InvoicePrintItem } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'
import { chargeLineLabel, formatPeriodLabel } from '~/utils/billing/charge-groups'
import { formatMeterReading, formatViNumber } from '~/utils/billing/meter-display'

defineProps<{ item: InvoicePrintItem }>()

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
      <div class="invoice-brand">
        <img
          v-if="item.invoiceProfile?.logoImageUrl"
          data-test="building-logo"
          :src="item.invoiceProfile.logoImageUrl"
          :alt="`Logo ${item.building.name}`"
        >
        <IconLogo v-else class="invoice-zeno-logo" aria-label="Zeno House" />
      </div>
      <div class="invoice-heading">
        <p class="invoice-building">{{ item.building.name }}</p>
        <h2 class="invoice-title">Phiếu tính tiền nhà tháng {{ formatPeriodLabel(item.period) }}</h2>
        <p class="invoice-address">{{ item.building.address }}</p>
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

    <div class="invoice-table-wrap">
      <table class="invoice-table">
        <thead>
          <tr>
            <th>Nội dung</th>
            <th class="numeric">Chỉ số cũ</th>
            <th class="numeric">Chỉ số mới</th>
            <th class="numeric">Số lượng</th>
            <th class="numeric">Đơn giá</th>
            <th class="numeric">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in item.charges" :key="line.id">
            <td>{{ chargeLineLabel(line.chargeType, line.label) }}</td>
            <td class="numeric meter-reading">
              {{ isMeterLine(line) ? formatMeterReading(metadataNumber(line, 'previous_reading_value')) : '' }}
            </td>
            <td class="numeric meter-reading">
              {{ isMeterLine(line) ? formatMeterReading(metadataNumber(line, 'current_reading_value')) : '' }}
            </td>
            <td class="numeric">{{ formatViNumber(line.quantity) }}</td>
            <td class="numeric">{{ formatCurrency(line.unitPrice) }}</td>
            <td class="numeric amount">{{ formatCurrency(line.amount) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="invoice-summary">
      <div><span>Tổng tiền</span><strong>{{ formatCurrency(item.invoice.totalAmount) }}</strong></div>
      <div><span>Đã thu</span><strong>{{ formatCurrency(item.invoice.paidAmount) }}</strong></div>
      <div class="invoice-balance"><span>Còn lại</span><strong>{{ formatCurrency(item.invoice.balanceAmount) }}</strong></div>
    </div>

    <footer class="payment-footer">
      <div v-if="item.invoiceProfile" class="payment-copy">
        <p class="payment-kicker">Thông tin chuyển khoản</p>
        <dl>
          <div><dt>Người thụ hưởng</dt><dd>{{ item.invoiceProfile.accountHolder }}</dd></div>
          <div><dt>Số tài khoản</dt><dd>{{ item.invoiceProfile.accountNumber }}</dd></div>
          <div><dt>Ngân hàng</dt><dd>{{ item.invoiceProfile.bankName }}</dd></div>
          <div><dt>Nội dung</dt><dd>{{ item.invoiceProfile.transferContent }}</dd></div>
        </dl>
      </div>
      <p v-else class="payment-empty">Liên hệ quản lý để nhận thông tin thanh toán.</p>
      <img
        v-if="item.invoiceProfile"
        data-test="payment-qr"
        class="payment-qr"
        :src="item.invoiceProfile.qrImageUrl"
        alt="Mã QR chuyển khoản ngân hàng"
      >
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
  border: 1px solid #cbd5e1;
  border-radius: 2mm;
  background: #fff;
  padding: 5.5mm 7mm;
  color: #111827;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 8pt;
  line-height: 1.25;
}
.invoice-header { display: grid; grid-template-columns: 24mm minmax(0, 1fr) auto; align-items: start; gap: 4mm; border-bottom: 1px solid #cbd5e1; padding-bottom: 2mm; }
.invoice-brand { display: flex; height: 14mm; align-items: center; justify-content: flex-start; }
.invoice-brand img { display: block; max-height: 14mm; max-width: 22mm; object-fit: contain; }
.invoice-zeno-logo { height: 12mm; width: auto; max-width: 22mm; color: #111827; }
.invoice-heading { min-width: 0; text-align: center; }
.invoice-building { margin: 0; color: #374151; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.invoice-title { margin: .6mm 0 0; font-size: 11.5pt; font-weight: 800; text-transform: uppercase; }
.invoice-address { margin: .5mm 0 0; overflow: hidden; color: #6b7280; font-size: 6.7pt; text-overflow: ellipsis; white-space: nowrap; }
.invoice-identity { display: flex; min-width: 28mm; flex-direction: column; align-items: flex-end; gap: 1mm; }
.invoice-code { margin: 0; font-size: 8pt; font-weight: 800; white-space: nowrap; }
.invoice-meta { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 5mm; margin: 2mm 0; }
.invoice-meta dt { color: #6b7280; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .03em; }
.invoice-meta dd { margin: .4mm 0 0; overflow-wrap: anywhere; font-size: 7.5pt; font-weight: 650; }
.invoice-table-wrap { min-height: 0; flex: 1; }
.invoice-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
.invoice-table th, .invoice-table td { border: 1px solid #9ca3af; padding: 1mm 1.2mm; vertical-align: middle; }
.invoice-table th { background: #f3f4f6; font-size: 6.5pt; font-weight: 800; line-height: 1.15; }
.invoice-table th:first-child { width: 30%; text-align: left; }
.invoice-table th:nth-child(2), .invoice-table th:nth-child(3) { width: 11%; }
.invoice-table th:nth-child(4) { width: 10%; }
.invoice-table th:nth-child(5), .invoice-table th:nth-child(6) { width: 19%; }
.invoice-table td { font-size: 7pt; }
.numeric { text-align: right; font-variant-numeric: tabular-nums; }
.meter-reading { color: #374151; }
.amount { font-weight: 700; }
.invoice-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3mm; border-top: 2px solid #111827; margin-top: 1.5mm; padding-top: 1.5mm; }
.invoice-summary div { display: flex; flex-direction: column; gap: .35mm; }
.invoice-summary span { color: #6b7280; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .03em; }
.invoice-summary strong { font-size: 9pt; font-variant-numeric: tabular-nums; }
.invoice-balance { text-align: right; }
.payment-footer { display: grid; min-height: 29mm; grid-template-columns: minmax(0, 1fr) 28mm; align-items: end; gap: 5mm; border-top: 1px solid #cbd5e1; margin-top: 1.5mm; padding-top: 1.5mm; }
.payment-kicker { margin: 0 0 .8mm; font-size: 6.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.payment-copy dl { display: grid; grid-template-columns: 24mm minmax(0, 1fr); gap: .35mm 1.5mm; margin: 0; }
.payment-copy dl div { display: contents; }
.payment-copy dt { color: #6b7280; }
.payment-copy dd { margin: 0; overflow-wrap: anywhere; font-weight: 650; }
.payment-empty { align-self: center; margin: 0; color: #6b7280; font-size: 7.5pt; }
.payment-qr { display: block; width: 28mm; height: 28mm; object-fit: contain; }
@media screen and (max-width: 640px) {
  .invoice-card { height: auto; min-height: 132mm; padding: 5mm; }
  .invoice-header { grid-template-columns: 18mm minmax(0, 1fr); }
  .invoice-brand { height: 11mm; }
  .invoice-identity { grid-column: 1 / -1; min-width: 0; flex-direction: row; align-items: center; justify-content: space-between; }
  .invoice-meta { grid-template-columns: 1fr; gap: 1.5mm; }
}
</style>
