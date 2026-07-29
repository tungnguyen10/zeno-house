<script setup lang="ts">
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'
import { formatCurrency, formatCurrencyNumber } from '~/utils/format/currency'
import { formatViDate } from '~/utils/format/time'
import { groupTenantInvoicesByYear } from '~/utils/tenant-portal/invoice-statement'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Hoá đơn', back: null })

const { invoices, status, error, refresh } = usePortalInvoices()
const invoiceYearGroups = computed(() => groupTenantInvoicesByYear(invoices.value))

function openInvoice(invoiceId: string) {
  return navigateTo(`/portal/invoices/${invoiceId}`)
}
</script>

<template>
  <PortalPullToRefresh :on-refresh="refresh">
    <div class="space-y-6 px-4 py-5 lg:px-8 lg:py-8">
      <header>
        <p class="portal-type-label text-body">Sao kê</p>
        <h1 class="portal-type-title mt-1 min-w-0 text-title [overflow-wrap:anywhere]">Lịch sử hoá đơn</h1>
        <p class="portal-type-body mt-1 text-body">
          <template v-if="status === 'pending'">Đang tải lịch sử thanh toán…</template>
          <template v-else>{{ invoices.length }} hoá đơn theo thứ tự mới nhất</template>
        </p>
      </header>

      <!-- Loading -->
      <PortalCard v-if="status === 'pending'" :padded="false" class="overflow-hidden">
        <div
          v-for="n in 6"
          :key="n"
          data-ledger-skeleton
          class="border-b border-border-light p-4 last:border-b-0"
        >
          <PortalSkeleton variant="statement" />
        </div>
      </PortalCard>

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
      <div v-else class="space-y-6">
        <section
          v-for="group in invoiceYearGroups"
          :key="group.year"
          :data-invoice-year="group.year"
          class="space-y-2"
        >
          <h2 class="portal-type-heading px-1 text-title">{{ group.year }}</h2>
          <PortalCard :padded="false" class="overflow-hidden">
            <button
              v-for="invoice in group.invoices"
              :key="invoice.id"
              :data-invoice-row="invoice.id"
              type="button"
              class="group block w-full border-b border-border-light px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-smoke active:bg-smoke focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan motion-reduce:transition-none md:px-5"
              @click="openInvoice(invoice.id)"
            >
              <div class="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-3 md:grid-cols-[5rem_minmax(0,1fr)_minmax(11rem,auto)_auto] md:items-center md:gap-x-5">
                <div class="self-start md:self-center">
                  <p class="portal-type-caption uppercase tracking-wider text-body opacity-60">Tháng</p>
                  <p class="portal-type-title mt-0.5 tabular-nums text-title">
                    {{ String(invoice.periodMonth).padStart(2, '0') }}
                  </p>
                </div>

                <div class="min-w-0">
                  <p class="portal-type-label truncate text-title">{{ invoice.invoiceCode }}</p>
                  <p v-if="invoice.dueDate" class="portal-type-caption mt-1 text-body">
                    Hạn thanh toán {{ formatViDate(invoice.dueDate) }}
                  </p>
                  <p class="portal-type-caption mt-1 text-body opacity-70">
                    Tổng {{ formatCurrency(invoice.totalAmount) }}
                    <span aria-hidden="true"> · </span>
                    Đã trả {{ formatCurrency(invoice.paidAmount) }}
                  </p>
                </div>

                <div class="col-span-2 row-start-3 mt-3 flex items-end justify-between gap-3 border-t border-border-light pt-3 md:col-span-1 md:col-start-auto md:row-start-auto md:mt-0 md:block md:border-0 md:pt-0 md:text-right">
                  <p class="portal-type-caption text-body">
                    {{ invoice.balanceAmount > 0 ? 'Còn phải thanh toán' : 'Tổng hoá đơn' }}
                  </p>
                  <p
                    class="portal-money text-lg font-bold leading-6 md:mt-0.5"
                    :class="`portal-money--${portalInvoiceStatementAccent(invoice.status)}`"
                  >
                    <span>{{ formatCurrencyNumber(invoice.balanceAmount > 0 ? invoice.balanceAmount : invoice.totalAmount) }}</span><span class="portal-money-unit">₫</span>
                  </p>
                </div>

                <div
                  data-invoice-status
                  class="col-start-2 row-start-2 mt-2 flex min-w-0 items-center gap-2 md:col-start-auto md:row-start-auto md:mt-0 md:justify-end"
                >
                  <PortalStatusBadge :status="invoice.status" />
                  <IconChevronRight
                    class="size-4 text-body opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-80 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </button>
          </PortalCard>
        </section>
      </div>
    </div>
  </PortalPullToRefresh>
</template>
