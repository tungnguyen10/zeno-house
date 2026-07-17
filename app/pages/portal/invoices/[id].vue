<script setup lang="ts">
import { chargeLineLabel, groupChargeLines } from '~/utils/billing/charge-groups'
import { formatCurrency } from '~/utils/format/currency'

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
  <div class="space-y-4 px-4 py-4">
    <!-- Loading -->
    <template v-if="status === 'pending'">
      <PortalSkeleton class="h-40 w-full" />
      <PortalSkeleton class="h-48 w-full" />
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
      <PortalCard>
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs text-body">Kỳ {{ String(invoice.periodMonth).padStart(2, '0') }}/{{ invoice.periodYear }}</p>
            <p class="mt-0.5 text-sm font-medium text-body">{{ invoice.invoiceCode }}</p>
          </div>
          <PortalInvoiceStatusBadge :status="invoice.status" />
        </div>
        <div class="mt-4 space-y-2 border-t border-border-light pt-4">
          <div class="flex items-center justify-between text-sm">
            <span class="text-body">Tổng cộng</span>
            <span class="font-medium text-title">{{ formatCurrency(invoice.totalAmount) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-body">Đã thanh toán</span>
            <span class="font-medium text-success">{{ formatCurrency(invoice.paidAmount) }}</span>
          </div>
          <div class="flex items-center justify-between border-t border-border-light pt-2">
            <span class="text-sm font-semibold text-title">Còn lại</span>
            <span class="text-lg font-bold text-title">{{ formatCurrency(invoice.balanceAmount) }}</span>
          </div>
        </div>
        <p v-if="invoice.dueDate" class="mt-3 text-xs text-body">
          Hạn thanh toán: <span class="font-medium text-title">{{ invoice.dueDate }}</span>
        </p>
      </PortalCard>

      <!-- Charge breakdown -->
      <section v-if="chargeGroups.length" class="space-y-3">
        <h3 class="px-1 text-sm font-semibold text-title">Chi tiết khoản thu</h3>
        <PortalCard v-for="group in chargeGroups" :key="group.key" :padded="false">
          <div class="flex items-center justify-between border-b border-border-light px-4 py-2.5">
            <span class="text-sm font-semibold text-title">{{ group.title }}</span>
            <span class="text-sm font-semibold text-title">{{ formatCurrency(group.subtotal) }}</span>
          </div>
          <ul class="divide-y divide-border-light">
            <li
              v-for="line in group.lines"
              :key="line.id"
              class="flex items-center justify-between px-4 py-2.5"
            >
              <span class="text-sm text-body">{{ chargeLineLabel(line.chargeType, line.label) }}</span>
              <span class="text-sm text-title">{{ formatCurrency(line.amount) }}</span>
            </li>
          </ul>
        </PortalCard>
      </section>

      <!-- Notes -->
      <PortalCard v-if="invoice.notes">
        <p class="text-xs font-semibold text-body">Ghi chú</p>
        <p class="mt-1 whitespace-pre-line text-sm text-title">{{ invoice.notes }}</p>
      </PortalCard>
    </template>
  </div>
</template>
