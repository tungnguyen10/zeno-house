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
  <article
    class="invoice-card box-border flex h-auto min-h-[132mm] flex-col overflow-hidden rounded-[2mm] border border-slate-300 bg-white px-[5mm] pb-[3mm] pt-[5mm] font-sans text-[8pt] leading-[1.25] text-slate-900 sm:h-[132mm] sm:min-h-0 sm:px-[7mm] sm:pb-[3mm] sm:pt-[5.5mm]"
  >
    <header
      class="invoice-header grid grid-cols-[18mm_minmax(0,1fr)] items-start gap-[4mm] border-b border-slate-300 pb-[2mm] sm:grid-cols-[24mm_minmax(0,1fr)_auto]"
    >
      <div class="invoice-brand flex h-[11mm] items-center justify-start sm:h-[14mm]">
        <img
          v-if="item.invoiceProfile?.logoImageUrl"
          data-test="building-logo"
          class="block max-h-[11mm] max-w-[18mm] object-contain sm:max-h-[14mm] sm:max-w-[22mm]"
          :src="item.invoiceProfile.logoImageUrl"
          :alt="`Logo ${item.building.name}`"
        >
        <IconLogo
          v-else
          class="invoice-zeno-logo h-[10mm] w-auto max-w-[18mm] text-slate-900 sm:h-[12mm] sm:max-w-[22mm]"
          aria-label="Zeno House"
        />
      </div>
      <div class="invoice-heading min-w-0 text-center">
        <p class="invoice-building m-0 text-[7pt] font-bold uppercase tracking-[.04em] text-slate-700">
          {{ item.building.name }}
        </p>
        <h2 class="invoice-title mb-0 mt-[.6mm] text-[11.5pt] font-extrabold uppercase">
          Phiếu tính tiền nhà tháng {{ formatPeriodLabel(item.period) }}
        </h2>
        <p class="invoice-address mb-0 mt-[.5mm] truncate text-[6.7pt] text-slate-500">
          {{ item.building.address }}
        </p>
      </div>
      <div
        class="invoice-identity col-span-full flex min-w-0 flex-row items-center justify-between gap-[1mm] sm:col-auto sm:min-w-[28mm] sm:flex-col sm:items-end"
      >
        <p class="invoice-code m-0 whitespace-nowrap text-[8pt] font-extrabold">
          {{ item.invoice.invoiceCode }}
        </p>
        <UiStatusBadge :status="item.invoice.status" context="invoice" />
      </div>
    </header>

    <dl class="invoice-meta my-[2mm] grid grid-cols-1 gap-[1.5mm] sm:grid-cols-2 sm:gap-[5mm]">
      <div>
        <dt class="text-[6.5pt] uppercase tracking-[.03em] text-slate-500">Phòng / khách thuê</dt>
        <dd class="mb-0 mt-[.4mm] break-words text-[7.5pt] font-semibold">
          Phòng {{ item.invoice.roomNumber ?? '—' }} · {{ item.invoice.tenantName ?? 'Khách thuê' }}
        </dd>
      </div>
      <div>
        <dt class="text-[6.5pt] uppercase tracking-[.03em] text-slate-500">Phát hành / hạn thanh toán</dt>
        <dd class="mb-0 mt-[.4mm] break-words text-[7.5pt] font-semibold">
          {{ dateLabel(item.invoice.issuedAt) }} · {{ dateLabel(item.invoice.dueDate) }}
        </dd>
      </div>
    </dl>

    <div class="invoice-table-wrap min-h-0 flex-1">
      <table
        class="invoice-table w-full table-fixed border-collapse [&_td]:border [&_td]:border-slate-400 [&_td]:px-[1.2mm] [&_td]:py-[1mm] [&_td]:align-middle [&_td]:text-[7pt] [&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:px-[1.2mm] [&_th]:py-[1mm] [&_th]:align-middle [&_th]:text-[6.5pt] [&_th]:font-extrabold [&_th]:leading-[1.15]"
      >
        <thead>
          <tr>
            <th class="w-[30%] text-left">Nội dung</th>
            <th class="numeric w-[11%] text-right tabular-nums">Chỉ số cũ</th>
            <th class="numeric w-[11%] text-right tabular-nums">Chỉ số mới</th>
            <th class="numeric w-[10%] text-right tabular-nums">Số lượng</th>
            <th class="numeric w-[19%] text-right tabular-nums">Đơn giá</th>
            <th class="numeric w-[19%] text-right tabular-nums">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in item.charges" :key="line.id">
            <td>{{ chargeLineLabel(line.chargeType, line.label) }}</td>
            <td class="numeric meter-reading text-right tabular-nums text-slate-700">
              {{ isMeterLine(line) ? formatMeterReading(metadataNumber(line, 'previous_reading_value')) : '' }}
            </td>
            <td class="numeric meter-reading text-right tabular-nums text-slate-700">
              {{ isMeterLine(line) ? formatMeterReading(metadataNumber(line, 'current_reading_value')) : '' }}
            </td>
            <td class="numeric text-right tabular-nums">{{ formatViNumber(line.quantity) }}</td>
            <td class="numeric text-right tabular-nums">{{ formatCurrency(line.unitPrice) }}</td>
            <td class="numeric amount text-right font-bold tabular-nums">{{ formatCurrency(line.amount) }}</td>
          </tr>
        </tbody>
      </table>
      <div class="invoice-summary mt-[1.5mm] grid grid-cols-3 gap-[3mm] border-t-2 border-slate-900 pt-[1.5mm]">
        <div class="flex flex-col gap-[.35mm]">
          <span class="text-[6.5pt] uppercase tracking-[.03em] text-slate-500">Còn lại</span>
          <strong class="text-[9pt] tabular-nums">{{ formatCurrency(item.invoice.balanceAmount) }}</strong>
        </div>
        <div class="flex flex-col gap-[.35mm]">
          <span class="text-[6.5pt] uppercase tracking-[.03em] text-slate-500">Đã thu</span>
          <strong class="text-[9pt] tabular-nums">{{ formatCurrency(item.invoice.paidAmount) }}</strong>
        </div>
        <div class="invoice-balance flex flex-col gap-[.35mm] text-right">
          <span class="text-[6.5pt] uppercase tracking-[.03em] text-slate-500">Tổng tiền</span>
          <strong class="text-[9pt] tabular-nums">{{ formatCurrency(item.invoice.totalAmount) }}</strong>
        </div>
      </div>
    </div>

    <footer
      class="payment-footer mt-[1mm] grid min-h-[40mm] grid-cols-[minmax(0,1fr)_40mm] items-end gap-[3mm] border-t border-slate-300 pt-[1mm]"
    >
      <div v-if="item.invoiceProfile" class="payment-copy min-w-0">
        <p class="payment-kicker mb-[.8mm] mt-0 text-[6.5pt] font-extrabold uppercase tracking-[.04em]">
          Thông tin chuyển khoản
        </p>
        <dl class="m-0 grid grid-cols-[24mm_minmax(0,1fr)] gap-x-[1.5mm] gap-y-[.35mm]">
          <div class="contents">
            <dt class="text-slate-500">Người thụ hưởng</dt>
            <dd class="m-0 break-words font-semibold">{{ item.invoiceProfile.accountHolder }}</dd>
          </div>
          <div class="contents">
            <dt class="text-slate-500">Số tài khoản</dt>
            <dd class="m-0 break-words font-semibold">{{ item.invoiceProfile.accountNumber }}</dd>
          </div>
          <div class="contents">
            <dt class="text-slate-500">Ngân hàng</dt>
            <dd class="m-0 break-words font-semibold">{{ item.invoiceProfile.bankName }}</dd>
          </div>
          <div class="contents">
            <dt class="text-slate-500">Nội dung</dt>
            <dd class="m-0 break-words font-semibold">{{ item.invoiceProfile.transferContent }}</dd>
          </div>
        </dl>
      </div>
      <p v-else class="payment-empty m-0 self-center text-[7.5pt] text-slate-500">
        Liên hệ quản lý để nhận thông tin thanh toán.
      </p>
      <img
        v-if="item.invoiceProfile"
        data-test="payment-qr"
        class="payment-qr block h-[40mm] w-[40mm] object-contain"
        :src="item.invoiceProfile.qrImageUrl"
        alt="Mã QR chuyển khoản ngân hàng"
      >
    </footer>
  </article>
</template>
