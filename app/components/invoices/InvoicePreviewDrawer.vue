<script setup lang="ts">
import type { InvoicePayment } from '~/types/billing'
import type { InvoiceListItem } from '~/utils/validators/invoices'
import { formatCurrency } from '~/utils/format/currency'
import { billingWorkspaceInvoicePath } from '~/utils/routes/operational'
import InvoicePaymentProfileCard from './InvoicePaymentProfileCard.vue'
import {
  INVOICE_EMAIL_DELIVERY_STATUS_LABELS,
  INVOICE_EMAIL_DELIVERY_STATUS_VARIANTS,
  isInvoiceEmailDeliveryInFlight,
} from '~/utils/constants/invoice-email'

const props = defineProps<{
  modelValue: boolean
  invoice: InvoiceListItem | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'print', invoiceId: string): void
}>()

const { detail, isLoading, error, load, clear } = useInvoiceDetail()
const {
  sending: sendingEmail,
  loadingHistory,
  error: emailError,
  history: emailHistory,
  enqueue: enqueueEmail,
  resend: resendEmailDelivery,
  loadHistory,
  clear: clearEmail,
} = useInvoiceEmailDelivery()
const toast = useToast()
const invoiceEmailEnabled = useRuntimeConfig().public.invoiceEmailEnabled === true
const latestDelivery = computed(() => emailHistory.value[0] ?? null)
const inFlightDelivery = computed(() =>
  emailHistory.value.find(delivery => isInvoiceEmailDeliveryInFlight(delivery.status)),
)
const hasPreviousDelivery = computed(() => emailHistory.value.length > 0)
const resendableDelivery = computed(() => {
  const delivery = latestDelivery.value
  return delivery && ['failed', 'accepted', 'delivered'].includes(delivery.status)
    ? delivery
    : null
})
const canEmailInvoice = computed(() =>
  invoiceEmailEnabled
  && Boolean(detail.value?.recipientEmail)
  && props.invoice?.status !== 'void'
)
const canStartEmail = computed(() => canEmailInvoice.value && !hasPreviousDelivery.value)
const canResendEmail = computed(() =>
  canEmailInvoice.value && !inFlightDelivery.value && Boolean(resendableDelivery.value),
)
const canEmailAction = computed(() => canStartEmail.value || canResendEmail.value)
const resendConfirmationOpen = ref(false)
const duplicateConfirmationRequired = computed(() =>
  resendableDelivery.value?.status === 'accepted' || resendableDelivery.value?.status === 'delivered',
)

watch(
  () => [props.modelValue, props.invoice?.invoice_code] as const,
  async ([open, code]) => {
    if (open && code) {
      await Promise.all([
        load(code),
        invoiceEmailEnabled ? loadHistory(code).catch(() => []) : Promise.resolve([]),
      ])
    }
    if (!open) {
      clear()
      clearEmail()
    }
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

function deliveryDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function sendEmail() {
  if (!props.invoice || !canStartEmail.value) return
  try {
    const result = await enqueueEmail([props.invoice.id])
    const item = result.results[0]
    if (item?.status === 'skipped') {
      toast.info(item.reason ?? 'Hoá đơn chưa có email người nhận hợp lệ.')
    }
    else if (item?.status === 'failed') {
      toast.error(item.reason ?? 'Không thể xếp hàng gửi hoá đơn.')
    }
    else {
      toast.success(item?.status === 'already_queued'
        ? 'Hoá đơn đã có trong hàng gửi.'
        : 'Đã xếp hàng gửi hoá đơn.')
    }
    await loadHistory(props.invoice.invoice_code)
  }
  catch {
    // The inline alert exposes the standardized API error.
  }
}

function requestEmailAction() {
  if (!canEmailAction.value) return
  if (!hasPreviousDelivery.value) {
    void sendEmail()
    return
  }
  if (duplicateConfirmationRequired.value) {
    resendConfirmationOpen.value = true
    return
  }
  void resendEmail(false)
}

async function resendEmail(confirmDuplicate: boolean) {
  if (!props.invoice || !canResendEmail.value) return
  try {
    await resendEmailDelivery(props.invoice.id, confirmDuplicate)
    resendConfirmationOpen.value = false
    toast.success('Đã xếp hàng gửi lại hoá đơn.')
    await loadHistory(props.invoice.invoice_code)
  }
  catch {
    // The inline alert exposes the standardized API error.
  }
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

        <UiSection title="Gửi qua email">
          <div class="space-y-3">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0">
                <p class="text-xs text-muted">Người nhận</p>
                <p
                  class="mt-0.5 truncate text-sm text-white"
                  :title="detail.recipientEmail ?? undefined"
                >
                  {{ detail.recipientEmail ?? 'Chưa có email liên hệ' }}
                </p>
              </div>
              <UiBadge
                v-if="latestDelivery"
                :variant="INVOICE_EMAIL_DELIVERY_STATUS_VARIANTS[latestDelivery.status]"
                pill
              >
                {{ INVOICE_EMAIL_DELIVERY_STATUS_LABELS[latestDelivery.status] }}
              </UiBadge>
            </div>

            <UiAlert v-if="!invoiceEmailEnabled" severity="info">
              Chức năng gửi email chưa được bật trên hệ thống.
            </UiAlert>
            <UiAlert v-else-if="!detail.recipientEmail" severity="warning">
              Thêm email liên hệ chính cho khách thuê trước khi gửi hoá đơn.
            </UiAlert>
            <UiAlert v-else-if="latestDelivery?.status === 'accepted'" severity="info">
              Nhà cung cấp đã tiếp nhận email và hệ thống đang chờ xác nhận giao. Bạn vẫn có thể gửi lại nếu cần.
            </UiAlert>
            <UiAlert
              v-else-if="latestDelivery?.status === 'bounced' || latestDelivery?.status === 'complained'"
              severity="warning"
            >
              Cập nhật email người nhận trước khi gửi lại hoá đơn.
            </UiAlert>
            <UiAlert v-if="emailError" severity="danger">{{ emailError }}</UiAlert>

            <div v-if="loadingHistory" class="space-y-2" aria-label="Đang tải lịch sử gửi email">
              <UiSkeleton v-for="item in 2" :key="item" class="h-12 w-full" />
            </div>
            <div v-else-if="emailHistory.length > 0" class="divide-y divide-dark-border border-y border-dark-border">
              <div
                v-for="delivery in emailHistory"
                :key="delivery.id"
                class="flex items-start justify-between gap-3 py-3"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm text-white" :title="delivery.recipientEmail ?? undefined">
                    {{ delivery.recipientEmail ?? 'Không có người nhận' }}
                  </p>
                  <p class="mt-0.5 text-xs text-muted tabular-nums">
                    {{ deliveryDate(delivery.createdAt) }} · {{ delivery.source === 'automatic' ? 'Tự động' : 'Thủ công' }}
                  </p>
                  <p v-if="delivery.lastErrorMessage" class="mt-1 text-xs text-error-vivid">
                    {{ delivery.lastErrorMessage }}
                  </p>
                </div>
                <UiBadge
                  :variant="INVOICE_EMAIL_DELIVERY_STATUS_VARIANTS[delivery.status]"
                  pill
                >
                  {{ INVOICE_EMAIL_DELIVERY_STATUS_LABELS[delivery.status] }}
                </UiBadge>
              </div>
            </div>
            <p v-else class="text-xs text-muted">Chưa có lần gửi nào.</p>
          </div>
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
      <div class="-mx-2 -my-1 grid grid-cols-1 gap-2 sm:mx-0 sm:my-0 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
        <UiButton
          v-if="invoice && invoice.status !== 'void'"
          class="w-full whitespace-nowrap sm:w-auto"
          :loading="sendingEmail"
          :disabled="!canEmailAction"
          @click="requestEmailAction"
        >
          {{ inFlightDelivery ? 'Đang gửi' : hasPreviousDelivery ? 'Gửi lại email' : 'Gửi email' }}
        </UiButton>
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

  <UiModal
    :open="resendConfirmationOpen"
    title="Gửi lại hoá đơn qua email?"
    size="sm"
    @close="resendConfirmationOpen = false"
  >
    <p class="text-sm leading-6 text-muted">
      Nhà cung cấp đã {{ resendableDelivery?.status === 'delivered' ? 'xác nhận giao' : 'tiếp nhận' }} email trước đó.
      Người nhận có thể nhận thêm một email hoá đơn giống nhau.
    </p>
    <template #footer>
      <UiButton variant="secondary" :disabled="sendingEmail" @click="resendConfirmationOpen = false">Huỷ</UiButton>
      <UiButton :loading="sendingEmail" @click="resendEmail(true)">Vẫn gửi lại</UiButton>
    </template>
  </UiModal>
</template>
