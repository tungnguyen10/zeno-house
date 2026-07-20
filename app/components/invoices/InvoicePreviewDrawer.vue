<script setup lang="ts">
import type { InvoicePayment } from '~/types/billing'
import type { InvoiceListItem } from '~/utils/validators/invoices'
import { formatCurrency } from '~/utils/format/currency'
import { billingWorkspaceInvoicePath } from '~/utils/routes/operational'
import InvoicePaymentProfileCard from './InvoicePaymentProfileCard.vue'

const props = defineProps<{
  modelValue: boolean
  invoice: InvoiceListItem | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'print', invoiceId: string): void
}>()

const { detail, isLoading, error, load, clear } = useInvoiceDetail()
const toast = useToast()

watch(
  () => [props.modelValue, props.invoice?.invoice_code] as const,
  async ([open, code]) => {
    if (open && code) await load(code)
    if (!open) clear()
  },
  { immediate: true },
)

const payments = computed<InvoicePayment[]>(() => detail.value?.payments ?? [])

function close() {
  emit('update:modelValue', false)
}

async function copyCode() {
  if (!props.invoice?.invoice_code) return
  await navigator.clipboard.writeText(props.invoice.invoice_code)
  toast.success('Đã sao mã hoá đơn')
}

async function openWorkspace() {
  if (!props.invoice) return
  await navigateTo(billingWorkspaceInvoicePath(
    {
      id: props.invoice.building_id,
      slug: props.invoice.building_slug,
      name: props.invoice.building_name,
    },
    props.invoice.period_year,
    props.invoice.period_month,
    props.invoice.id,
  ))
}

function paymentDate(payment: InvoicePayment): string {
  return payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('vi-VN') : '---'
}

function paymentMethodLabel(payment: InvoicePayment): string {
  return payment.paymentMethod ?? '---'
}
</script>

<template>
  <UiDrawer
    :model-value="modelValue"
    title="Chi tiết hoá đơn"
    width="w-full sm:w-[480px]"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div v-if="invoice" class="min-w-0 pr-2">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="min-w-0 break-all text-base font-semibold text-white sm:truncate">{{ invoice.invoice_code }}</h2>
          <UiStatusBadge :status="invoice.status" context="invoice" />
        </div>
        <p class="mt-1 truncate text-sm text-muted">
          {{ invoice.tenant_name ?? 'Khách thuê' }} · {{ invoice.room_number ? `P.${invoice.room_number}` : invoice.room_id }}
        </p>
      </div>
      <h2 v-else class="text-base font-semibold text-white">Chi tiết hoá đơn</h2>
    </template>

    <div class="-mx-2 -my-1 space-y-3 sm:mx-0 sm:my-0 sm:space-y-4">
      <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>

      <div v-if="invoice" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <UiMetric label="Tổng tiền" :value="formatCurrency(invoice.total_amount)" />
        <UiMetric label="Đã thu" :value="formatCurrency(invoice.paid_amount)" tone="success" />
        <UiMetric
          label="Còn lại"
          :value="formatCurrency(invoice.balance_amount)"
          :tone="invoice.balance_amount > 0 ? 'danger' : 'default'"
        />
        <UiMetric label="Hạn" :value="invoice.due_date ?? '---'" />
      </div>

      <template v-if="isLoading">
        <UiSkeleton class="h-32 w-full" />
        <UiSkeleton class="h-40 w-full" />
      </template>

      <template v-else-if="detail && invoice">
        <UiSection title="Khoản phí">
          <BillingChargeBreakdown
            :lines="detail.charges"
            :total-amount="detail.invoice.totalAmount"
            :show-adjustments="true"
          />
        </UiSection>

        <UiSection title="Thanh toán theo hóa đơn">
          <InvoicePaymentProfileCard :profile="detail.invoiceProfile" />
        </UiSection>

        <UiSection title="Thanh toán">
          <div class="space-y-2 md:hidden">
            <UiEmptyState
              v-if="payments.length === 0"
              title="Chưa có thanh toán"
            />
            <div
              v-for="payment in payments"
              v-else
              :key="payment.id"
              class="rounded-lg border border-dark-border bg-dark-surface px-3 py-2"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-white tabular-nums">{{ paymentDate(payment) }}</p>
                  <p class="mt-0.5 truncate text-xs text-muted">{{ paymentMethodLabel(payment) }}</p>
                </div>
                <p class="shrink-0 text-sm font-medium text-white tabular-nums">{{ formatCurrency(payment.amount) }}</p>
              </div>
              <p v-if="payment.recordedByName || payment.note" class="mt-2 truncate text-xs text-muted">
                {{ payment.recordedByName ?? 'Hệ thống' }}<span v-if="payment.note"> · {{ payment.note }}</span>
              </p>
            </div>
          </div>

          <UiTable
            class="hidden md:block"
            :rows="payments"
            :columns="[
              { key: 'paidAt', label: 'Ngày', width: 'w-28' },
              { key: 'amount', label: 'Số tiền', numeric: true, width: 'w-32' },
              { key: 'paymentMethod', label: 'Hình thức', hideOnMobile: true },
              { key: 'recordedByName', label: 'Người ghi', hideOnMobile: true },
              { key: 'note', label: 'Ghi chú', hideOnMobile: true },
            ]"
            empty-title="Chưa có thanh toán"
          >
            <template #cell-paidAt="{ row }">{{ paymentDate(row) }}</template>
            <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
            <template #cell-paymentMethod="{ row }">{{ row.paymentMethod ?? '---' }}</template>
            <template #cell-recordedByName="{ row }">{{ row.recordedByName ?? 'Hệ thống' }}</template>
            <template #cell-note="{ row }">{{ row.note ?? '---' }}</template>
          </UiTable>
        </UiSection>

        <UiSection v-if="detail.invoice.notes" title="Ghi chú">
          <p class="text-sm text-white">{{ detail.invoice.notes }}</p>
        </UiSection>
      </template>
    </div>

    <template #footer>
      <div class="-mx-2 -my-1 grid grid-cols-1 gap-2 sm:mx-0 sm:my-0 sm:flex sm:items-center sm:justify-end">
        <UiButton
          v-if="invoice && invoice.status !== 'void'"
          class="w-full sm:w-auto"
          variant="secondary"
          @click="emit('print', invoice.id)"
        >
          In phiếu
        </UiButton>
        <UiButton class="w-full sm:w-auto" @click="openWorkspace">
          <span>Mở trong kỳ</span>
          <IconChevronRight class="h-4 w-4" aria-hidden="true" />
        </UiButton>
        <UiButton class="w-full sm:w-auto" variant="secondary" @click="copyCode">
          <IconDocumentText class="h-4 w-4" aria-hidden="true" />
          <span>Sao mã</span>
        </UiButton>
        <UiButton class="w-full sm:w-auto" variant="ghost" @click="close">Đóng</UiButton>
      </div>
    </template>
  </UiDrawer>
</template>
