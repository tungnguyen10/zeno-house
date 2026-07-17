<script setup lang="ts">
import { formatCurrency } from '~/utils/format/currency'

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
    <div class="space-y-3 px-4 py-4">
      <!-- Loading -->
      <template v-if="status === 'pending'">
        <PortalSkeleton v-for="n in 4" :key="n" class="h-24 w-full" />
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
          @click="navigateTo(`/portal/invoices/${invoice.id}`)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-title">
                Kỳ {{ String(invoice.periodMonth).padStart(2, '0') }}/{{ invoice.periodYear }}
              </p>
              <p class="mt-0.5 truncate text-xs text-body">{{ invoice.invoiceCode }}</p>
              <p class="mt-2 text-lg font-bold text-title">{{ formatCurrency(invoice.balanceAmount) }}</p>
            </div>
            <div class="flex flex-col items-end gap-2">
              <PortalInvoiceStatusBadge :status="invoice.status" />
              <span v-if="invoice.dueDate" class="text-xs text-body">Hạn {{ invoice.dueDate }}</span>
            </div>
          </div>
        </PortalCard>
      </template>
    </div>
  </PortalPullToRefresh>
</template>
