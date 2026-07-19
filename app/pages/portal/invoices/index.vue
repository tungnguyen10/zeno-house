<script setup lang="ts">
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'
import { formatCurrency, formatCurrencyNumber } from '~/utils/format/currency'

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
    <div class="px-4 py-5 lg:px-8 lg:py-8">
      <!-- Loading -->
      <div v-if="status === 'pending'" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <PortalSkeleton v-for="n in 6" :key="n" variant="statement" />
      </div>

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
      <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
              <p class="portal-type-caption mt-0.5 truncate text-body opacity-60">{{ invoice.invoiceCode }}</p>
            </div>
            <PortalStatusBadge :status="invoice.status" />
          </div>
          <p class="portal-type-caption mt-3 text-body">
            {{ invoice.balanceAmount > 0 ? 'Còn phải thanh toán' : 'Tổng hoá đơn' }}
          </p>
          <p
            class="portal-money mt-0.5 text-xl font-bold leading-7"
            :class="`portal-money--${portalInvoiceStatementAccent(invoice.status)}`"
          >
            <span>{{ formatCurrencyNumber(invoice.balanceAmount > 0 ? invoice.balanceAmount : invoice.totalAmount) }}</span><span class="portal-money-unit">₫</span>
          </p>
          <div class="mt-2 flex items-center gap-2 border-t border-border-light pt-2">
            <span class="portal-type-caption text-body">Tổng: <span class="font-medium text-title">{{ formatCurrency(invoice.totalAmount) }}</span></span>
            <span class="text-border-light" aria-hidden="true">·</span>
            <span class="portal-type-caption text-body">Đã trả: <span class="font-medium text-portal-positive-ink">{{ formatCurrency(invoice.paidAmount) }}</span></span>
          </div>
          <p v-if="invoice.dueDate" class="portal-type-caption mt-2 text-body">Hạn thanh toán {{ invoice.dueDate }}</p>
        </PortalCard>
      </div>
    </div>
  </PortalPullToRefresh>
</template>
