<script setup lang="ts">
import { chargeLineLabel, groupChargeLines } from '~/utils/billing/charge-groups'
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'
import { formatCurrency, formatCurrencyNumber } from '~/utils/format/currency'
import { formatViDate } from '~/utils/format/time'
import { tenantInvoicePaymentProgress } from '~/utils/tenant-portal/invoice-statement'
import { portalInvoiceState } from '~/utils/tenant-portal/invoice-state'
import type { TenantInvoicePayment } from '~/types/tenant-portal'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const route = useRoute()
const id = computed(() => route.params.id as string)

const { setChrome } = usePortalChrome()
setChrome({ title: 'Chi tiết hoá đơn', back: '/portal/invoices' })

const { invoice, status, error, refresh } = usePortalInvoiceDetail(id)
const toast = usePortalToast()
const checking = ref(false)
const checkedAt = ref<string | null>(null)
const paymentState = computed(() => invoice.value ? portalInvoiceState(invoice.value) : null)

const chargeGroups = computed(() =>
  invoice.value ? groupChargeLines(invoice.value.charges) : [],
)
const paymentProgress = computed(() =>
  invoice.value
    ? tenantInvoicePaymentProgress(invoice.value.totalAmount, invoice.value.paidAmount)
    : 0,
)
const paymentProgressClass = computed(() => {
  if (invoice.value?.status === 'paid') return 'bg-portal-positive'
  if (invoice.value?.status === 'overdue') return 'bg-portal-danger'
  return 'bg-theme'
})
const isVoid = computed(() => invoice.value?.status === 'void')
const showOutstandingPayment = computed(() => paymentState.value?.outstanding ?? false)
const showPaymentHistory = computed(() => invoice.value?.status === 'paid')
const isInGrace = computed(() => paymentState.value?.inGrace ?? false)

async function checkPayment() {
  if (checking.value || status.value === 'pending') return
  checking.value = true
  try {
    await refresh()
    if (error.value) { toast.error('Chưa kiểm tra được thanh toán. Vui lòng thử lại khi có kết nối.'); return }
    checkedAt.value = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
    if (invoice.value?.status === 'paid') toast.success('Hoá đơn đã được quản lý ghi nhận thanh toán đủ.')
  }
  catch { toast.error('Chưa kiểm tra được thanh toán. Vui lòng thử lại.') }
  finally { checking.value = false }
}

function paymentLabel(payment: TenantInvoicePayment): string {
  if (payment.fundingSource === 'deposit') return 'Khấu trừ tiền cọc'
  if (payment.fundingSource === 'credit') return 'Khấu trừ khoản đã trả trước'
  if (['bank_transfer', 'transfer', 'bank'].includes(payment.method ?? '')) return 'Chuyển khoản'
  if (payment.method === 'cash') return 'Tiền mặt'
  return 'Thanh toán đã ghi nhận'
}

function reportPayment() {
  if (invoice.value) return navigateTo({ path: '/portal/requests', query: { intent: 'payment-report', invoice: invoice.value.invoiceCode } })
}

function chargeLineUnit(chargeType: string): string | null {
  if (chargeType === 'electricity') return 'kWh'
  if (chargeType === 'water') return 'm³'
  return null
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 lg:px-8 lg:py-8">
    <!-- Loading -->
    <template v-if="status === 'pending' && !invoice">
      <PortalSkeleton variant="statement" />
      <PortalSkeleton variant="card" class="h-48" />
    </template>

    <!-- Error -->
    <PortalEmptyState
      v-else-if="!invoice"
      tone="error"
      title="Không tải được hoá đơn"
      description="Hoá đơn không tồn tại hoặc đã xảy ra lỗi."
      action-label="Thử lại"
      @action="refresh"
    />

    <template v-else>
      <div v-if="error" role="alert" class="rounded-xl border border-portal-warning/30 bg-portal-warning/10 p-3 portal-type-body text-portal-warning-ink">
        Chưa cập nhật được thông tin. Hãy kiểm tra lại trước khi chuyển khoản.
        <PortalButton variant="secondary" size="sm" class="mt-2" :loading="checking" @click="checkPayment">Thử lại</PortalButton>
      </div>
      <!-- Summary -->
      <PortalCard :accent="portalInvoiceStatementAccent(invoice.status)">
        <!-- Header: document identity + status -->
        <div class="flex items-start justify-between">
          <p class="portal-type-label text-body">Thông tin hoá đơn</p>
          <PortalStatusBadge :status="invoice.status" />
        </div>
        <div class="mt-3">
          <div>
            <h1 class="portal-type-title min-w-0 text-title [overflow-wrap:anywhere]">Kỳ {{ String(invoice.periodMonth).padStart(2, '0') }}/{{ invoice.periodYear }}</h1>
            <p class="portal-type-caption mt-0.5 text-body">{{ invoice.invoiceCode }}</p>
          </div>
        </div>

        <!-- Metadata: room/building + dates -->
        <div class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-border-light pt-4 sm:grid-cols-3">
          <div v-if="invoice.roomNumber || invoice.buildingName">
            <p class="portal-type-caption text-body">Phòng</p>
            <p class="portal-type-body mt-0.5 font-medium text-title">
              {{ [invoice.roomNumber, invoice.buildingName].filter(Boolean).join(' · ') }}
            </p>
          </div>
          <div v-if="invoice.issuedAt">
            <p class="portal-type-caption text-body">Ngày phát hành</p>
            <p class="portal-type-body mt-0.5 font-medium text-title">{{ formatViDate(invoice.issuedAt) }}</p>
          </div>
          <div>
            <p class="portal-type-caption text-body">Hạn thanh toán</p>
            <p class="portal-type-body mt-0.5 font-medium text-title">{{ paymentState?.dueLabel }}</p>
          </div>
        </div>

        <div v-if="isInGrace" class="mt-4 rounded-xl border border-portal-warning/30 bg-portal-warning/10 px-3 py-2 portal-type-body text-portal-warning-ink">
          {{ paymentState?.graceLabel }}.
        </div>

        <!-- Amount: context-aware headline figure -->
        <div class="mt-5">
          <p class="portal-type-caption text-body">
            {{ showOutstandingPayment ? 'Còn phải thanh toán' : 'Tổng hoá đơn' }}
          </p>
          <p
            class="portal-money portal-type-display mt-1"
            :class="`portal-money--${portalInvoiceStatementAccent(invoice.status)}`"
          >
            <template v-if="showOutstandingPayment">
              <span>{{ formatCurrencyNumber(invoice.balanceAmount) }}</span><span class="portal-money-unit">₫</span>
            </template>
            <template v-else>
              <span>{{ formatCurrencyNumber(invoice.totalAmount) }}</span><span class="portal-money-unit">₫</span>
            </template>
          </p>
        </div>

        <!-- Payment progress -->
        <div v-if="!isVoid" class="mt-5 border-t border-border-light pt-4">
          <div class="flex items-center justify-between gap-4">
            <p class="portal-type-label text-title">Tiến độ thanh toán</p>
            <p class="portal-type-label tabular-nums text-body">{{ paymentProgress }}%</p>
          </div>
          <div
            role="progressbar"
            aria-label="Tiến độ thanh toán hoá đơn"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="paymentProgress"
            :aria-valuetext="`${paymentProgress}% đã thanh toán`"
            class="mt-2 h-2 overflow-hidden rounded-full bg-smoke"
          >
            <div
              class="h-full rounded-full"
              :class="paymentProgressClass"
              :style="{ width: `${paymentProgress}%` }"
            />
          </div>

          <dl class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
            <div>
              <dt class="portal-type-caption text-body">Tổng cộng</dt>
              <dd class="portal-money mt-0.5 text-sm font-semibold text-title">{{ formatCurrency(invoice.totalAmount) }}</dd>
            </div>
            <div>
              <dt class="portal-type-caption text-body">Đã thanh toán</dt>
              <dd class="portal-money mt-0.5 text-sm font-semibold text-portal-positive-ink">{{ formatCurrency(invoice.paidAmount) }}</dd>
            </div>
            <div v-if="showOutstandingPayment" class="col-span-2 border-t border-border-light pt-3">
              <dt class="portal-type-caption font-medium text-title">Còn lại</dt>
              <dd class="portal-money mt-0.5 text-base font-bold text-portal-danger-ink">{{ formatCurrency(invoice.balanceAmount) }}</dd>
            </div>
          </dl>
        </div>
      </PortalCard>

      <!-- Void context -->
      <PortalCard v-if="isVoid">
        <div class="flex items-start gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-portal-danger/10 text-portal-danger-ink">
            <IconAlertCircle class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <h2 class="portal-type-heading text-title">Hoá đơn đã huỷ</h2>
            <p class="portal-type-caption mt-1 whitespace-pre-line text-body">
              {{ invoice.voidReason || 'Hoá đơn này không còn hiệu lực thanh toán.' }}
            </p>
          </div>
        </div>
      </PortalCard>

      <!-- Outstanding payment action -->
      <PortalInvoicePaymentInstructions
        v-if="!isVoid && showOutstandingPayment"
        :profile="invoice.invoiceProfile"
        :amount="invoice.balanceAmount"
        mode="outstanding"
      />

      <section v-if="showOutstandingPayment" aria-labelledby="portal-payment-check-heading" class="space-y-3">
        <h2 id="portal-payment-check-heading" class="portal-type-heading text-title">Bạn đã chuyển khoản?</h2>
        <p class="portal-type-body text-body">Số tiền đã trả chỉ thay đổi khi quản lý ghi nhận. Bạn có thể kiểm tra lại hoặc gửi thông tin để đối chiếu.</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <PortalButton block variant="secondary" :loading="checking || status === 'pending'" @click="checkPayment"><IconRefresh class="size-4" aria-hidden="true" />Kiểm tra thanh toán</PortalButton>
          <PortalButton block variant="ghost" @click="reportPayment">Yêu cầu đối chiếu</PortalButton>
        </div>
        <p v-if="checkedAt" role="status" class="portal-type-caption text-body">Đã kiểm tra lúc {{ checkedAt }}.</p>
      </section>

      <!-- Charge breakdown -->
      <section v-if="chargeGroups.length" class="space-y-3">
        <h2 class="portal-type-heading px-1 text-title">Chi tiết khoản thu</h2>
        <PortalCard :padded="false">
          <section v-for="group in chargeGroups" :key="group.key" class="border-b border-border-light last:border-b-0">
            <!-- Section label: small muted uppercase caption — clearly a category, not an item -->
            <div class="px-4 pb-1.5 pt-3">
              <p class="portal-type-caption uppercase tracking-wider text-body opacity-60">{{ group.title }}</p>
            </div>
            <!-- Line items: primary content, text-title so they pop -->
            <ul class="divide-y divide-border-light border-t border-border-light">
              <li
                v-for="line in group.lines"
                :key="line.id"
                class="flex items-start justify-between gap-4 px-4 py-3"
              >
                <div class="min-w-0">
                  <p class="portal-type-body text-title">{{ chargeLineLabel(line.chargeType, line.label) }}</p>
                  <p v-if="line.quantity !== 1" class="portal-type-caption mt-0.5 text-body opacity-60">
                    {{ line.quantity }}<template v-if="chargeLineUnit(line.chargeType)">&nbsp;{{ chargeLineUnit(line.chargeType) }}</template>&nbsp;×&nbsp;{{ formatCurrency(line.unitPrice) }}
                  </p>
                  <div v-if="line.meterReading" class="portal-type-caption mt-2 space-y-1 text-body">
                    <p>Chỉ số đầu {{ line.meterReading.previousValue ?? '—' }} → cuối {{ line.meterReading.currentValue ?? '—' }} {{ line.meterReading.unit }}</p>
                    <p v-if="line.meterReading.billableUsage !== null">Lượng tính tiền: {{ line.meterReading.billableUsage }} {{ line.meterReading.unit }}</p>
                    <p v-if="line.meterReading.adjusted" class="text-portal-warning-ink">Lượng sử dụng đã được quản lý điều chỉnh khi phát hành.</p>
                  </div>
                </div>
                <span class="portal-money shrink-0 text-sm font-semibold text-title">{{ formatCurrency(line.amount) }}</span>
              </li>
            </ul>
          </section>
          <!-- Grand total: heavier treatment, clear closing row -->
          <div class="flex items-center justify-between gap-3 border-t-2 border-border-light px-4 py-3.5">
            <span class="portal-type-label text-body">Tổng cộng</span>
            <span class="portal-money text-base font-bold text-title">{{ formatCurrency(invoice.totalAmount) }}</span>
          </div>
        </PortalCard>
      </section>

      <section v-if="invoice.payments?.length" aria-labelledby="portal-payment-history-heading" class="space-y-3">
        <h2 id="portal-payment-history-heading" class="portal-type-heading text-title">Các khoản đã ghi nhận</h2>
        <PortalCard :padded="false">
          <ul class="divide-y divide-border-light">
            <li v-for="payment in invoice.payments" :key="payment.id" class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
              <div class="min-w-0">
                <p class="portal-type-body font-medium text-title">{{ paymentLabel(payment) }}</p>
                <p class="portal-type-caption mt-1 text-body">{{ formatViDate(payment.paidAt) }}</p>
              </div>
              <p class="portal-money portal-type-label text-portal-positive-ink">{{ formatCurrency(payment.amount) }}</p>
            </li>
          </ul>
        </PortalCard>
      </section>

      <!-- Settled payment history -->
      <PortalInvoicePaymentInstructions
        v-if="!isVoid && showPaymentHistory"
        :profile="invoice.invoiceProfile"
        :amount="invoice.balanceAmount"
        mode="history"
      />

      <!-- Notes -->
      <PortalCard v-if="invoice.notes">
        <p class="portal-type-label text-body">Ghi chú</p>
        <p class="portal-type-body mt-1 whitespace-pre-line text-title">{{ invoice.notes }}</p>
      </PortalCard>
    </template>
  </div>
</template>
