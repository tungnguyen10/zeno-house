<script setup lang="ts">
import type { TenantPortalBootstrap } from '~/types/tenant-portal'
import { formatCurrency, formatCurrencyNumber } from '~/utils/format/currency'
import { portalInvoiceState } from '~/utils/tenant-portal/invoice-state'

const props = defineProps<{ summary: TenantPortalBootstrap['financialSummary'] }>()
const emit = defineEmits<{ (e: 'openInvoice', id: string): void; (e: 'openHistory'): void }>()
const next = computed(() => props.summary.nextInvoice)
const nextState = computed(() => next.value ? portalInvoiceState(next.value) : null)
</script>

<template>
  <section aria-labelledby="portal-debt-heading" class="space-y-3">
    <h2 id="portal-debt-heading" class="portal-type-heading text-title">Công nợ cần xử lý</h2>
    <PortalCard :accent="summary.overdueCount > 0 ? 'overdue' : summary.outstandingCount > 0 ? 'due' : 'paid'">
      <template v-if="summary.outstandingCount > 0">
        <p class="portal-type-caption text-body">Tổng còn phải thanh toán · {{ summary.outstandingCount }} hoá đơn</p>
        <p class="portal-money portal-type-display mt-1 break-words text-title">
          <span>{{ formatCurrencyNumber(summary.outstandingAmount) }}</span><span class="portal-money-unit">₫</span>
        </p>
        <p v-if="summary.overdueCount > 0" class="portal-type-body mt-2 text-portal-danger-ink">
          Trong đó {{ summary.overdueCount }} hoá đơn quá hạn: {{ formatCurrency(summary.overdueAmount) }}.
        </p>
        <div v-if="next && nextState" class="mt-4 border-t border-border-light pt-4">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="portal-type-label break-words text-title">Kỳ {{ String(next.periodMonth).padStart(2, '0') }}/{{ next.periodYear }}</p>
              <p class="portal-type-caption mt-1 break-words text-body">{{ next.invoiceCode }}</p>
            </div>
            <PortalStatusBadge :status="nextState.overdue ? 'overdue' : next.status" />
          </div>
          <dl class="mt-3 space-y-2">
            <div class="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt class="portal-type-body text-body">Còn lại của hoá đơn này</dt>
              <dd class="portal-money portal-type-label text-title">{{ formatCurrency(next.balanceAmount) }}</dd>
            </div>
            <div class="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt class="portal-type-body text-body">Hạn thanh toán</dt>
              <dd class="portal-type-body font-medium text-title">{{ nextState.dueLabel }}</dd>
            </div>
          </dl>
          <p v-if="nextState.graceLabel" class="portal-type-caption mt-2 text-portal-warning-ink">{{ nextState.graceLabel }}</p>
          <PortalButton block class="mt-4" @click="emit('openInvoice', next.id)">Xem và thanh toán</PortalButton>
        </div>
        <PortalButton v-else block class="mt-4" @click="emit('openHistory')">Xem hoá đơn cần trả</PortalButton>
      </template>
      <div v-else class="flex items-start gap-3">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-portal-positive/10 text-portal-positive-ink" aria-hidden="true"><IconCheckSmall class="size-5" /></span>
        <div>
          <p class="portal-type-label text-title">Không có khoản cần thanh toán</p>
          <p class="portal-type-body mt-1 text-body">Các khoản đã được cập nhật theo ghi nhận của quản lý.</p>
        </div>
      </div>
    </PortalCard>
  </section>
</template>
