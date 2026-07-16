<script setup lang="ts">

import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { ApiSuccess } from '~/types/api'
import type {
  BillingWorkspaceOverview,
  InvoiceCharge,
  InvoicePayment,
  InvoiceWithCharges,
} from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'
import { billingWorkspacePath } from '~/utils/routes/operational'

definePageMeta({ title: 'Hoá đơn' })

const route = useRoute()
const invoiceId = String(route.params.id ?? '')

const {
  data: invoiceResponse,
  pending,
  error,
} = await useFetch<ApiSuccess<InvoiceWithCharges>>(`/api/billing/invoices/${invoiceId}`)

const detail = computed(() => invoiceResponse.value?.data ?? null)
const invoice = computed(() => detail.value?.invoice ?? null)

const { data: overview } = await useAsyncData(
  `billing-invoice-overview-${invoiceId}`,
  async () => {
    const periodId = invoice.value?.billingPeriodId
    if (!periodId) return null
    const resp = await apiFetch<ApiSuccess<BillingWorkspaceOverview>>(`/api/billing/periods/${periodId}/overview`)
    return resp.data
  },
  { watch: [invoice] },
)

const workspaceHref = computed(() => {
  if (!overview.value) return '/dashboard/billing'
  return billingWorkspacePath(
    {
      id: overview.value.buildingId,
      slug: overview.value.buildingSlug,
      name: overview.value.buildingName,
    },
    overview.value.period.periodYear,
    overview.value.period.periodMonth,
  )
})

const periodLabel = computed(() => {
  const period = overview.value?.period
  if (!period) return ''
  return `${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}`
})

const title = computed(() => invoice.value?.invoiceCode || invoiceId)
const contractHref = computed(() =>
  invoice.value
    ? `/dashboard/contracts/${invoice.value.contractCode || invoice.value.contractId}`
    : '/dashboard/contracts',
)

const chargeColumns: UiTableColumn<InvoiceCharge>[] = [
  { key: 'label', label: 'Khoản phí' },
  { key: 'quantity', label: 'SL', numeric: true, hideOnMobile: true, width: 'w-20' },
  { key: 'unitPrice', label: 'Đơn giá', numeric: true, hideOnMobile: true },
  { key: 'amount', label: 'Thành tiền', numeric: true },
]

const paymentColumns: UiTableColumn<InvoicePayment>[] = [
  { key: 'paidAt', label: 'Ngày', width: 'w-28' },
  { key: 'amount', label: 'Số tiền', numeric: true, width: 'w-32' },
  { key: 'paymentMethod', label: 'Hình thức', hideOnMobile: true },
  { key: 'recordedByName', label: 'Người ghi', hideOnMobile: true },
  { key: 'note', label: 'Ghi chú', hideOnMobile: true },
]

function dateText(value: string | null | undefined): string {
  if (!value) return '---'
  return new Date(value).toLocaleDateString('vi-VN')
}

function dateTimeText(value: string | null | undefined): string {
  if (!value) return '---'
  return new Date(value).toLocaleString('vi-VN')
}
</script>

<template>
  <div class="space-y-5">
    <UiPageHeader
      :title="title"
      :description="invoice ? `${invoice.tenantName ?? 'Khách thuê'}${invoice.roomNumber ? ` - P.${invoice.roomNumber}` : ''}` : 'Đang tải hoá đơn'"
    >
      <template #actions>
        <UiStatusBadge v-if="invoice" :status="invoice.status" context="invoice" />
        <NuxtLink :to="workspaceHref">
          <UiButton variant="ghost" size="sm">← Kỳ {{ periodLabel || 'vận hành' }}</UiButton>
        </NuxtLink>
      </template>
    </UiPageHeader>

    <div v-if="pending" class="space-y-3">
      <UiSkeleton class="h-24 w-full" />
      <UiSkeleton class="h-48 w-full" />
    </div>

    <UiAlert v-else-if="error" severity="danger">
      {{ error.data?.error?.message ?? error.message ?? 'Không thể tải hoá đơn' }}
    </UiAlert>

    <template v-else-if="detail && invoice">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <UiMetric label="Tổng tiền" :value="formatCurrency(invoice.totalAmount)" tone="default" />
        <UiMetric label="Đã thu" :value="formatCurrency(invoice.paidAmount)" tone="success" />
        <UiMetric label="Còn lại" :value="formatCurrency(invoice.balanceAmount)" :tone="invoice.balanceAmount > 0 ? 'danger' : 'default'" />
        <UiMetric label="Hạn thanh toán" :value="dateText(invoice.dueDate)" tone="default" />
      </div>

      <UiSection title="Thông tin">
        <dl class="grid gap-3 text-sm md:grid-cols-2">
          <div class="rounded-lg border border-dark-border bg-dark-surface px-3 py-2">
            <dt class="text-xs uppercase tracking-wide text-muted">Hợp đồng</dt>
            <dd class="mt-1">
              <NuxtLink :to="contractHref" class="text-cyan hover:text-white">
                {{ invoice.contractCode || invoice.contractId }}
              </NuxtLink>
            </dd>
          </div>
          <div class="rounded-lg border border-dark-border bg-dark-surface px-3 py-2">
            <dt class="text-xs uppercase tracking-wide text-muted">Phòng</dt>
            <dd class="mt-1 text-white">{{ invoice.roomNumber ? `P.${invoice.roomNumber}` : invoice.roomId }}</dd>
          </div>
          <div class="rounded-lg border border-dark-border bg-dark-surface px-3 py-2">
            <dt class="text-xs uppercase tracking-wide text-muted">Ngày phát hành</dt>
            <dd class="mt-1 text-white">{{ dateTimeText(invoice.issuedAt) }}</dd>
          </div>
          <div class="rounded-lg border border-dark-border bg-dark-surface px-3 py-2">
            <dt class="text-xs uppercase tracking-wide text-muted">Thanh toán gần nhất</dt>
            <dd class="mt-1 text-white">{{ dateTimeText(invoice.paidAt) }}</dd>
          </div>
        </dl>
      </UiSection>

      <UiSection title="Khoản phí">
        <UiTable
          :rows="detail.charges"
          :columns="chargeColumns"
          row-key="id"
          empty-title="Chưa có khoản phí"
        >
          <template #cell-label="{ row }">
            <UiStatusBadge :status="row.chargeType" context="correction" />
            <span class="ml-2">{{ row.label }}</span>
          </template>
          <template #cell-quantity="{ row }">{{ row.quantity }}</template>
          <template #cell-unitPrice="{ row }">{{ formatCurrency(row.unitPrice) }}</template>
          <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
        </UiTable>
      </UiSection>

      <UiSection title="Thanh toán">
        <UiTable
          :rows="detail.payments"
          :columns="paymentColumns"
          row-key="id"
          empty-title="Chưa có thanh toán nào"
        >
          <template #cell-paidAt="{ row }">{{ dateText(row.paidAt) }}</template>
          <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
          <template #cell-paymentMethod="{ row }">{{ row.paymentMethod ?? '---' }}</template>
          <template #cell-recordedByName="{ row }">{{ row.recordedByName ?? 'Hệ thống' }}</template>
          <template #cell-note="{ row }">{{ row.note ?? '---' }}</template>
        </UiTable>
      </UiSection>
    </template>
  </div>
</template>
