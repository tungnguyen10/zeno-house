<script setup lang="ts">
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'
import { formatCurrencyNumber } from '~/utils/format/currency'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Hoá đơn', back: null })

const { invoices, status, error, refresh } = usePortalInvoices()
</script>

<template>
  <PortalPullToRefresh :on-refresh="refresh">
    <div class="space-y-3 px-4 py-5">
      <!-- Loading -->
      <template v-if="status === 'pending'">
        <PortalSkeleton v-for="n in 4" :key="n" variant="statement" />
      </template>

      <!-- Error -->
      <PortalEmptyState
        v-else-if="error"
        tone="error"
        title="Không tải được hoá đơn"
        description="Đã xảy ra lỗi khi tải danh sách hoá đơn."
        action-label="Thử lại"
        @action="refresh"
      />

      <!-- Empty -->
      <PortalEmptyState
        v-else-if="invoices.length === 0"
        title="Chưa có hoá đơn"
        description="Hoá đơn của bạn sẽ xuất hiện tại đây khi được phát hành."
      />

      <!-- List -->
      <template v-else>
        <PortalCard
          v-for="invoice in invoices"
          :key="invoice.id"
          interactive
          :accent="portalInvoiceStatementAccent(invoice.status)"
          @click="navigateTo(`/portal/invoices/${invoice.id}`)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="portal-type-heading text-title">
                Kỳ {{ String(invoice.periodMonth).padStart(2, '0') }}/{{ invoice.periodYear }}
              </p>
              <p class="portal-type-caption mt-0.5 truncate text-body">{{ invoice.invoiceCode }}</p>
            </div>
            <PortalInvoiceStatusBadge :status="invoice.status" />
          </div>
          <p
            class="portal-money mt-3 text-xl font-bold leading-7"
            :class="`portal-money--${portalInvoiceStatementAccent(invoice.status)}`"
          >
            <span>{{ formatCurrencyNumber(invoice.balanceAmount) }}</span><span class="portal-money-unit">₫</span>
          </p>
          <p v-if="invoice.dueDate" class="portal-type-caption mt-2 text-body">Hạn thanh toán {{ invoice.dueDate }}</p>
        </PortalCard>
      </template>
    </div>
  </PortalPullToRefresh>
</template>
