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
    class="invoice-card group/card relative box-border flex h-auto min-h-[132mm] flex-col overflow-hidden rounded-[2.5mm] border border-slate-200 bg-white pb-[3mm] font-sans text-[8pt] leading-[1.35] text-slate-900 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_0_0_rgba(15,23,42,0.02)] [print-color-adjust:exact] [-webkit-print-color-adjust:exact] sm:h-[132mm] sm:min-h-0"
  >
    <!-- Card header (shadcn Card + CardHeader vibe) -->
    <header
      class="invoice-header grid grid-cols-[16mm_minmax(0,1fr)] items-center gap-x-[3mm] gap-y-[1.5mm] px-[6mm] pt-[5mm] pb-[3.5mm] sm:grid-cols-[22mm_minmax(0,1fr)_auto] sm:gap-x-[4mm] sm:px-[7mm] sm:pt-[5.5mm]"
    >
      <div class="invoice-brand flex h-[10mm] items-center justify-start sm:h-[12mm]">
        <img
          v-if="item.invoiceProfile?.logoImageUrl"
          data-test="building-logo"
          class="block max-h-[10mm] max-w-[16mm] object-contain sm:max-h-[12mm] sm:max-w-[22mm]"
          :src="item.invoiceProfile.logoImageUrl"
          :alt="`Logo ${item.building.name}`"
        >
        <IconLogo
          v-else
          class="invoice-zeno-logo h-[9mm] w-auto max-w-[16mm] text-slate-900 sm:h-[11mm] sm:max-w-[22mm]"
          aria-label="Zeno House"
        />
      </div>
      <div class="invoice-heading min-w-0 space-y-[.6mm] text-center">
        <p class="invoice-building m-0 text-[7.2pt] font-medium text-slate-600">
          {{ item.building.name }}
        </p>
        <h2 class="invoice-title m-0 text-[12.5pt] font-bold uppercase leading-[1.05] tracking-[-0.01em] text-slate-900">
          Phiếu tính tiền nhà tháng {{ formatPeriodLabel(item.period) }}
        </h2>
        <p class="invoice-address m-0 truncate text-[6.6pt] italic leading-tight text-slate-500">
          {{ item.building.address }}
        </p>
      </div>
      <div
        class="invoice-identity col-span-full flex min-w-0 flex-row items-center justify-between gap-[1.5mm] sm:col-auto sm:min-w-[30mm] sm:flex-col sm:items-end sm:gap-[1.2mm]"
      >
        <!-- Invoice code: shadcn Badge (variant=default, primary chip) -->
        <span
          class="invoice-code inline-flex items-center whitespace-nowrap rounded-[1mm] border border-transparent bg-slate-900 px-[2mm] py-[.6mm] text-[7.6pt] font-semibold tracking-[.02em] text-white"
        >
          {{ item.invoice.invoiceCode }}
        </span>
        <UiStatusBadge :status="item.invoice.status" context="invoice" />
      </div>
    </header>

    <!-- Separator -->
    <div role="separator" aria-hidden="true" class="h-px w-full shrink-0 bg-slate-200" />

    <!-- Meta strip — sentence-case labels, no eyebrows -->
    <dl class="invoice-meta grid grid-cols-1 gap-x-[6mm] gap-y-[.7mm] px-[6mm] py-[2mm] sm:grid-cols-2 sm:px-[7mm]">
      <div class="flex min-w-0 items-baseline gap-[1.8mm]">
        <dt class="shrink-0 text-[6.8pt] text-slate-500">Phòng &amp; khách thuê</dt>
        <dd class="m-0 min-w-0 flex-1 truncate text-[7.7pt] font-medium text-slate-900">
          Phòng {{ item.invoice.roomNumber ?? '—' }} · {{ item.invoice.tenantName ?? 'Khách thuê' }}
        </dd>
      </div>
      <div class="flex min-w-0 items-baseline gap-[1.8mm]">
        <dt class="shrink-0 text-[6.8pt] text-slate-500">Phát hành &amp; hạn</dt>
        <dd class="m-0 min-w-0 flex-1 truncate text-[7.7pt] font-medium tabular-nums text-slate-900">
          {{ dateLabel(item.invoice.issuedAt) }} — {{ dateLabel(item.invoice.dueDate) }}
        </dd>
      </div>
    </dl>

    <!-- Separator -->
    <div role="separator" aria-hidden="true" class="h-px w-full shrink-0 bg-slate-200" />

    <!-- Table + summary (shadcn Table styling: bordered rows, muted-foreground heads) -->
    <div class="invoice-table-wrap flex min-h-0 flex-1 flex-col px-[6mm] pt-[2mm] sm:px-[7mm]">
      <table
        class="invoice-table w-full table-fixed caption-bottom border-collapse [&_tbody_tr:last-child_td]:border-b-0 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-[1.4mm] [&_td]:py-[1.1mm] [&_td]:align-middle [&_td]:text-[7.3pt] [&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-transparent [&_th]:px-[1.4mm] [&_th]:pb-[1.2mm] [&_th]:pt-[.4mm] [&_th]:align-bottom [&_th]:text-[6.3pt] [&_th]:font-medium [&_th]:uppercase [&_th]:leading-[1.15] [&_th]:tracking-[.08em] [&_th]:text-slate-500"
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
          <tr v-for="line in item.charges" :key="line.id" class="transition-colors">
            <td class="font-medium text-slate-900">{{ chargeLineLabel(line.chargeType, line.label) }}</td>
            <td class="numeric meter-reading text-right tabular-nums text-slate-500">
              {{ isMeterLine(line) ? formatMeterReading(metadataNumber(line, 'previous_reading_value')) : '' }}
            </td>
            <td class="numeric meter-reading text-right tabular-nums text-slate-500">
              {{ isMeterLine(line) ? formatMeterReading(metadataNumber(line, 'current_reading_value')) : '' }}
            </td>
            <td class="numeric text-right tabular-nums text-slate-700">{{ formatViNumber(line.quantity) }}</td>
            <td class="numeric text-right tabular-nums text-slate-700">{{ formatCurrency(line.unitPrice) }}</td>
            <td class="numeric amount text-right font-semibold tabular-nums text-slate-900">
              {{ formatCurrency(line.amount) }}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Totals — right-aligned ledger stack (classical accountancy pattern) -->
      <dl class="invoice-summary ml-auto mt-[3mm] w-full max-w-[82mm] space-y-[.5mm]">
        <div class="flex items-baseline justify-between gap-[4mm]">
          <dt class="text-[7pt] text-slate-500">Đã thu</dt>
          <dd class="m-0 text-[9pt] font-medium tabular-nums text-slate-900">
            {{ formatCurrency(item.invoice.paidAmount) }}
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-[4mm]">
          <dt class="text-[7pt] text-slate-500">Còn lại</dt>
          <dd
            class="m-0 text-[9pt] font-semibold tabular-nums"
            :class="item.invoice.balanceAmount > 0 ? 'text-rose-600' : 'text-emerald-600'"
          >
            {{ formatCurrency(item.invoice.balanceAmount) }}
          </dd>
        </div>
        <div
          class="!mt-[1.4mm] flex items-baseline justify-between gap-[4mm] border-t-[.5mm] border-slate-900 pt-[1.6mm]"
        >
          <dt class="invoice-balance text-[8pt] font-semibold tracking-[.01em] text-slate-900">Tổng tiền</dt>
          <dd class="m-0 text-[16pt] font-bold leading-none tabular-nums tracking-[-0.02em] text-slate-900">
            {{ formatCurrency(item.invoice.totalAmount) }}
          </dd>
        </div>
      </dl>
    </div>

    <!-- Separator -->
    <div role="separator" aria-hidden="true" class="mt-[2.5mm] h-px w-full shrink-0 bg-slate-200" />

    <!-- Payment footer (shadcn CardFooter cadence) -->
    <footer
      class="payment-footer mt-[1mm] grid min-h-[40mm] grid-cols-[minmax(0,1fr)_40mm] items-stretch gap-[3mm] px-[6mm] pt-[2mm] sm:px-[7mm]"
    >
      <div v-if="item.invoiceProfile" class="payment-copy flex min-w-0 flex-col justify-between gap-[2mm]">
        <div class="space-y-[1.2mm]">
          <p class="payment-kicker m-0 inline-flex items-center gap-[1.5mm] text-[6.3pt] font-semibold uppercase tracking-[.1em] text-slate-900">
            <span aria-hidden="true" class="inline-block h-[.35mm] w-[5mm] bg-slate-900" />
            Thông tin chuyển khoản
          </p>
          <dl class="m-0 grid grid-cols-[22mm_minmax(0,1fr)] gap-x-[2mm] gap-y-[.6mm]">
            <dt class="text-[6.8pt] leading-[1.35] text-slate-500">Người thụ hưởng</dt>
            <dd class="m-0 break-words text-[7.3pt] font-medium leading-[1.35] text-slate-900">
              {{ item.invoiceProfile.accountHolder }}
            </dd>
            <dt class="text-[6.8pt] leading-[1.35] text-slate-500">Số tài khoản</dt>
            <dd class="m-0 break-words text-[7.6pt] font-semibold tabular-nums leading-[1.35] tracking-[.02em] text-slate-900">
              {{ item.invoiceProfile.accountNumber }}
            </dd>
            <dt class="text-[6.8pt] leading-[1.35] text-slate-500">Ngân hàng</dt>
            <dd class="m-0 break-words text-[7.3pt] font-medium leading-[1.35] text-slate-900">
              {{ item.invoiceProfile.bankName }}
            </dd>
            <dt class="text-[6.8pt] leading-[1.35] text-slate-500">Nội dung</dt>
            <dd class="m-0 break-words text-[7.3pt] font-medium leading-[1.35] text-slate-900">
              {{ item.invoiceProfile.transferContent }}
            </dd>
          </dl>
        </div>
        <p class="payment-note m-0 flex items-start gap-[1.5mm] rounded-[1mm] border border-amber-200 bg-amber-50 px-[2mm] py-[1.2mm] text-[6.4pt] leading-[1.4] text-amber-900">
          <span
            aria-hidden="true"
            class="mt-[.2mm] inline-flex h-[2.4mm] w-[2.4mm] shrink-0 items-center justify-center rounded-full bg-amber-500 text-[5pt] font-bold leading-none text-white"
          >!</span>
          <span>Vui lòng thanh toán trước hạn thanh toán để tránh những phát sinh chi phí của việc chậm thanh toán.</span>
        </p>
      </div>
      <p v-else class="payment-empty m-0 flex items-end text-[7.5pt] italic text-slate-500">
        Liên hệ quản lý để nhận thông tin thanh toán.
      </p>
      <div
        v-if="item.invoiceProfile"
        class="flex flex-col items-center justify-end gap-[.8mm]"
      >
        <img
          data-test="payment-qr"
          class="payment-qr block h-[40mm] w-[40mm] rounded-[1.5mm] border border-slate-200 bg-white object-contain p-[.8mm]"
          :src="item.invoiceProfile.qrImageUrl"
          alt="Mã QR chuyển khoản ngân hàng"
        >
        <span class="text-[6pt] italic text-slate-500">
          Quét mã để chuyển khoản
        </span>
      </div>
    </footer>
  </article>
</template>
