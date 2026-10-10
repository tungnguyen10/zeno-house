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

function normalizeRecipient(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase()
  return normalized || null
}

const currentRecipientDeliveries = computed(() => {
  const recipient = normalizeRecipient(detail.value?.recipientEmail)
  return recipient
    ? emailHistory.value.filter(delivery => normalizeRecipient(delivery.recipientEmail) === recipient)
    : []
})
const latestDelivery = computed(() => currentRecipientDeliveries.value[0] ?? null)
const inFlightDelivery = computed(() =>
  currentRecipientDeliveries.value.find(delivery => isInvoiceEmailDeliveryInFlight(delivery.status)),
)
const hasPreviousDelivery = computed(() => currentRecipientDeliveries.value.length > 0)
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
          <h2 class="min-w-0 break-all text-base font-semibold text-ui-primary sm:truncate">{{ invoice.invoice_code }}</h2>
          <UiStatusBadge :status="invoice.status" context="invoice" />
        </div>
        <p class="mt-1 truncate text-sm text-ui-muted">
          {{ invoice.tenant_name ?? 'Khách thuê' }} · {{ invoice.room_number ? `P.${invoice.room_number}` : invoice.room_id }}
        </p>
      </div>
      <h2 v-else class="text-base font-semibold text-ui-primary">Chi tiết hoá đơn</h2>
    </template>

    <div class="-mx-2 -my-1 space-y-3 sm:mx-0 sm:my-0 sm:space-y-4">
      <UiAlert v-if="error" severity="danger">
        {{ error }}
        <UiButton v-if="invoice" variant="secondary" size="sm" class="mt-3" @click="load(invoice.invoice_code)">
          Thử lại
        </UiButton>
      </UiAlert>

      <div
        v-if="invoice"
        class="rounded-xl border border-ui-border bg-ui-surface px-3 py-2.5"
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-xs text-ui-muted">Tổng tiền</span>
          <span class="text-base font-semibold tabular-nums text-ui-primary">{{ formatCurrency(invoice.total_amount) }}</span>
        </div>
        <div class="mt-1 flex items-baseline justify-between gap-3 text-xs">
          <span class="min-w-0 truncate tabular-nums text-ui-muted">
            Hạn {{ invoice.due_date ?? '---' }}
            <template v-if="invoice.balance_amount > 0 && invoice.paid_amount > 0">
              · Đã thu {{ formatCurrency(invoice.paid_amount) }}
            </template>
          </span>
          <span
            :class="[
              'shrink-0 font-medium tabular-nums',
              invoice.balance_amount > 0 ? 'text-status-danger' : 'text-status-success',
            ]"
          >
            {{ invoice.balance_amount > 0 ? `Còn ${formatCurrency(invoice.balance_amount)}` : 'Đã thu đủ' }}
          </span>
        </div>
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
          <div class="space-y-2">
            <UiEmptyState
              v-if="payments.length === 0"
              title="Chưa có thanh toán"
            />
            <div
              v-for="payment in payments"
              v-else
              :key="payment.id"
              class="rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ui-primary tabular-nums">{{ paymentDate(payment) }}</p>
                  <p class="mt-0.5 truncate text-xs text-ui-muted">{{ paymentMethodLabel(payment) }}</p>
                </div>
                <p class="shrink-0 text-sm font-medium text-ui-primary tabular-nums">{{ formatCurrency(payment.amount) }}</p>
              </div>
              <p v-if="payment.recordedByName || payment.note" class="mt-1 truncate text-xs text-ui-muted">
                {{ payment.recordedByName ?? 'Hệ thống' }}<span v-if="payment.note"> · {{ payment.note }}</span>
              </p>
            </div>
          </div>

          <div class="space-y-2 border-t border-ui-border pt-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-ui-muted">Gửi qua email</p>
                <p
                  class="mt-0.5 truncate text-sm text-ui-primary"
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
              <span v-else-if="!loadingHistory" class="shrink-0 text-xs text-ui-muted">Chưa có lần gửi nào</span>
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
              <UiSkeleton v-for="item in 2" :key="item" class="h-10 w-full" />
            </div>
            <div v-else-if="emailHistory.length > 0" class="divide-y divide-ui-border">
              <div
                v-for="delivery in emailHistory"
                :key="delivery.id"
                class="flex items-start justify-between gap-3 py-2"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm text-ui-primary" :title="delivery.recipientEmail ?? undefined">
                    {{ delivery.recipientEmail ?? 'Không có người nhận' }}
                  </p>
                  <p class="mt-0.5 text-xs text-ui-muted tabular-nums">
                    {{ deliveryDate(delivery.createdAt) }} · {{ delivery.source === 'automatic' ? 'Tự động' : 'Thủ công' }}
                  </p>
                  <p v-if="delivery.lastErrorMessage" class="mt-1 text-xs text-status-danger">
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
          </div>
        </UiSection>

        <UiSection v-if="detail.invoice.notes" title="Ghi chú">
          <p class="text-sm text-ui-primary">{{ detail.invoice.notes }}</p>
        </UiSection>
      </template>
    </div>

    <template #footer>
      <!-- Below `sm` the actions form a 2-up grid; `sm:flex` keeps the original single desktop row. -->
      <div class="-mx-2 -my-1 grid grid-cols-2 gap-2 sm:mx-0 sm:my-0 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
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
        <UiButton class="w-full sm:w-auto" variant="secondary" @click="openWorkspace">
          <span>Mở trong kỳ</span>
          <IconChevronRight class="h-4 w-4" aria-hidden="true" />
        </UiButton>
        <UiButton class="w-full sm:w-auto" variant="secondary" @click="copyCode">
          <IconDocumentText class="h-4 w-4" aria-hidden="true" />
          <span>Sao mã</span>
        </UiButton>
        <!-- UiDrawer is a bottom sheet (with its own close affordance) until `lg`. -->
        <UiButton class="hidden lg:inline-flex lg:w-auto" variant="ghost" @click="close">Đóng</UiButton>
      </div>
    </template>
  </UiDrawer>

  <UiModal
    :open="resendConfirmationOpen"
    title="Gửi lại hoá đơn qua email?"
    size="sm"
    @close="resendConfirmationOpen = false"
  >
    <p class="text-sm leading-6 text-ui-muted">
      Nhà cung cấp đã {{ resendableDelivery?.status === 'delivered' ? 'xác nhận giao' : 'tiếp nhận' }} email trước đó.
      Người nhận có thể nhận thêm một email hoá đơn giống nhau.
    </p>
    <template #footer>
      <UiButton variant="secondary" :disabled="sendingEmail" @click="resendConfirmationOpen = false">Huỷ</UiButton>
      <UiButton :loading="sendingEmail" @click="resendEmail(true)">Vẫn gửi lại</UiButton>
    </template>
  </UiModal>
</template>
