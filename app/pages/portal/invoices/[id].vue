<script setup lang="ts">
import { chargeLineLabel, groupChargeLines } from '~/utils/billing/charge-groups'
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'
import { formatCurrency, formatCurrencyNumber } from '~/utils/format/currency'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const route = useRoute()
const id = computed(() => route.params.id as string)

const { setChrome } = usePortalChrome()
setChrome({ title: 'Chi tiết hoá đơn', back: '/portal/invoices' })

const { invoice, status, error, refresh } = usePortalInvoiceDetail(id)

const chargeGroups = computed(() =>
  invoice.value ? groupChargeLines(invoice.value.charges) : [],
)
</script>

<template>
  <div class="space-y-5 px-4 py-5">
    <!-- Loading -->
    <template v-if="status === 'pending'">
      <PortalSkeleton variant="statement" />
      <PortalSkeleton variant="card" class="h-48" />
    </template>

    <!-- Error -->
    <PortalEmptyState
      v-else-if="error || !invoice"
      tone="error"
      title="Không tải được hoá đơn"
      description="Hoá đơn không tồn tại hoặc đã xảy ra lỗi."
      action-label="Thử lại"
      @action="refresh"
    />

    <template v-else>
      <!-- Summary -->
      <PortalCard :accent="portalInvoiceStatementAccent(invoice.status)">
        <div class="flex items-start justify-between">
          <div>
            <p class="portal-type-label text-title">Kỳ {{ String(invoice.periodMonth).padStart(2, '0') }}/{{ invoice.periodYear }}</p>
            <p class="portal-type-caption mt-0.5 text-body">{{ invoice.invoiceCode }}</p>
          </div>
          <PortalStatusBadge :status="invoice.status" />
        </div>
        <p class="portal-type-caption mt-5 text-body">Còn phải thanh toán</p>
        <p
          class="portal-money portal-type-display mt-1"
          :class="`portal-money--${portalInvoiceStatementAccent(invoice.status)}`"
        >
          <span>{{ formatCurrencyNumber(invoice.balanceAmount) }}</span><span class="portal-money-unit">₫</span>
        </p>
        <dl class="divide-y divide-border-light mt-4 border-y border-border-light">
          <div class="flex items-center justify-between py-3">
            <dt class="portal-type-body text-body">Tổng cộng</dt>
            <dd class="portal-money text-sm font-semibold text-title">{{ formatCurrency(invoice.totalAmount) }}</dd>
          </div>
          <div class="flex items-center justify-between py-3">
            <dt class="portal-type-body text-body">Đã thanh toán</dt>
            <dd class="portal-money text-sm font-semibold text-portal-positive-ink">{{ formatCurrency(invoice.paidAmount) }}</dd>
          </div>
        </dl>
        <p v-if="invoice.dueDate" class="portal-type-caption mt-3 text-body">
          Hạn thanh toán: <span class="font-medium text-title">{{ invoice.dueDate }}</span>
        </p>
      </PortalCard>

      <!-- Charge breakdown -->
      <section v-if="chargeGroups.length" class="space-y-3">
        <h3 class="portal-type-heading px-1 text-title">Chi tiết khoản thu</h3>
        <PortalCard :padded="false">
          <section v-for="group in chargeGroups" :key="group.key" class="border-b border-border-light last:border-b-0">
            <div class="flex items-center justify-between gap-3 px-4 py-3">
              <h4 class="portal-type-label text-title">{{ group.title }}</h4>
              <span class="portal-money text-sm font-semibold text-title">{{ formatCurrency(group.subtotal) }}</span>
            </div>
            <ul class="divide-y divide-border-light border-t border-border-light">
              <li
                v-for="line in group.lines"
                :key="line.id"
                class="flex items-start justify-between gap-4 px-4 py-3"
              >
                <span class="portal-type-body text-body">{{ chargeLineLabel(line.chargeType, line.label) }}</span>
                <span class="portal-money shrink-0 text-sm font-medium text-title">{{ formatCurrency(line.amount) }}</span>
              </li>
            </ul>
          </section>
        </PortalCard>
      </section>

      <!-- Notes -->
      <PortalCard v-if="invoice.notes">
        <p class="portal-type-label text-body">Ghi chú</p>
        <p class="portal-type-body mt-1 whitespace-pre-line text-title">{{ invoice.notes }}</p>
      </PortalCard>
    </template>
  </div>
</template>
