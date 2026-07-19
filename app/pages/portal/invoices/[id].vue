<script setup lang="ts">
import { chargeLineLabel, groupChargeLines } from '~/utils/billing/charge-groups'
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'
import { formatCurrency, formatCurrencyNumber } from '~/utils/format/currency'
import { formatViDate } from '~/utils/format/time'

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

function chargeLineUnit(chargeType: string): string | null {
  if (chargeType === 'electricity') return 'kWh'
  if (chargeType === 'water') return 'm³'
  return null
}
</script>

<template>
  <div class="space-y-5 px-4 py-5">
    <!-- Loading -->
    <template v-if="status === 'pending'">
      <PortalSkeleton variant="statement" />
      <PortalSkeleton variant="card" class="h-48" />
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
      <PortalCard :accent="portalInvoiceStatementAccent(invoice.status)">
        <!-- Header: period + status -->
        <div class="flex items-start justify-between">
          <div>
            <p class="portal-type-label text-title">Kỳ {{ String(invoice.periodMonth).padStart(2, '0') }}/{{ invoice.periodYear }}</p>
            <p class="portal-type-caption mt-0.5 text-body">{{ invoice.invoiceCode }}</p>
          </div>
          <PortalStatusBadge :status="invoice.status" />
        </div>

        <!-- Metadata: room/building + dates -->
        <div class="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-border-light pt-3">
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
          <div v-if="invoice.dueDate">
            <p class="portal-type-caption text-body">Hạn thanh toán</p>
            <p class="portal-type-body mt-0.5 font-medium text-title">{{ invoice.dueDate }}</p>
          </div>
        </div>

        <!-- Amount: context-aware headline figure -->
        <div class="mt-4">
          <p class="portal-type-caption text-body">
            {{ invoice.balanceAmount > 0 ? 'Còn phải thanh toán' : 'Tổng hoá đơn' }}
          </p>
          <p
            class="portal-money portal-type-display mt-1"
            :class="`portal-money--${portalInvoiceStatementAccent(invoice.status)}`"
          >
            <span>{{ formatCurrencyNumber(invoice.balanceAmount > 0 ? invoice.balanceAmount : invoice.totalAmount) }}</span><span class="portal-money-unit">₫</span>
          </p>
        </div>

        <!-- Financial breakdown -->
        <dl class="divide-y divide-border-light mt-4 border-y border-border-light">
          <div class="flex items-center justify-between py-3">
            <dt class="portal-type-body text-body">Tổng cộng</dt>
            <dd class="portal-money text-sm font-semibold text-title">{{ formatCurrency(invoice.totalAmount) }}</dd>
          </div>
          <div class="flex items-center justify-between py-3">
            <dt class="portal-type-body text-body">Đã thanh toán</dt>
            <dd class="portal-money text-sm font-semibold text-portal-positive-ink">{{ formatCurrency(invoice.paidAmount) }}</dd>
          </div>
          <div v-if="invoice.balanceAmount > 0" class="flex items-center justify-between py-3">
            <dt class="portal-type-body font-medium text-title">Còn lại</dt>
            <dd class="portal-money text-sm font-bold text-portal-danger-ink">{{ formatCurrency(invoice.balanceAmount) }}</dd>
          </div>
        </dl>
      </PortalCard>

      <!-- Charge breakdown -->
      <section v-if="chargeGroups.length" class="space-y-3">
        <h3 class="portal-type-heading px-1 text-title">Chi tiết khoản thu</h3>
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

      <!-- Notes -->
      <PortalCard v-if="invoice.notes">
        <p class="portal-type-label text-body">Ghi chú</p>
        <p class="portal-type-body mt-1 whitespace-pre-line text-title">{{ invoice.notes }}</p>
      </PortalCard>
    </template>
  </div>
</template>
