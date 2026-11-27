<script setup lang="ts">
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'
import {
  formatCurrency,
  formatCurrencyCompact,
  formatCurrencyNumber,
} from '~/utils/format/currency'
import { formatViDate } from '~/utils/format/time'
import { buildPortalFinancialOverview } from '~/utils/tenant-portal/financial-overview'
import { portalInvoiceState } from '~/utils/tenant-portal/invoice-state'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Zeno House', back: null })

const { profile, status: profileStatus } = usePortalProfile()
const { contract, status: contractStatus } = usePortalContract()
const {
  invoices,
  latest,
  financialSummary,
  status: invoiceStatus,
  error: bootstrapError,
  refresh: refreshInvoices,
} = usePortalInvoices()

const loading = computed(
  () => !profile.value && (profileStatus.value === 'pending'
    || contractStatus.value === 'pending'
    || invoiceStatus.value === 'pending'),
)
const financialOverview = computed(() =>
  buildPortalFinancialOverview(invoices.value, 6),
)
const latestState = computed(() => latest.value ? portalInvoiceState(latest.value) : null)
const showLatest = computed(() => latest.value && latest.value.id !== financialSummary.value?.nextInvoice?.id)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 14) return 'Chào buổi trưa'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
})

const initials = computed(() => {
  const name = profile.value?.fullName?.trim() ?? ''
  if (!name) return '?'
  const parts = name.split(/\s+/)
  if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
})

async function refreshAll() {
  await refreshInvoices()
}
</script>

<template>
  <PortalPullToRefresh :on-refresh="refreshAll">
    <div class="space-y-5 px-4 py-5 lg:px-8 lg:py-8">
      <PortalEmptyState
        v-if="!loading && bootstrapError"
        tone="error"
        title="Không tải được trang chủ"
        description="Không thể tải thông tin phòng và hoá đơn. Kiểm tra kết nối rồi thử lại."
        action-label="Thử lại"
        @action="refreshAll"
      />

      <template v-else>
      <!-- Identity hero: room keycard -->
      <section>
        <PortalSkeleton v-if="loading" variant="statement" class="h-40" />
        <PortalCard
          v-else
          :interactive="!!contract"
          class="flex flex-col"
          @click="contract ? navigateTo('/portal/room') : undefined"
        >
          <template v-if="contract">
            <!-- Room keycard header -->
            <p class="portal-type-caption min-w-0 truncate text-body">
              {{ contract.buildingName }}
            </p>

            <div class="mt-2.5 flex items-end justify-between gap-3">
              <div class="min-w-0">
                <p class="portal-type-caption text-body">Nơi ở hiện tại</p>
                <div class="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
                  <p class="portal-type-display min-w-0 break-words text-title">
                    Phòng {{ contract.roomNumber }}
                  </p>
                  <span
                    v-if="contract.assignmentRole === 'roommate'"
                    class="rounded-full bg-theme/10 px-2 py-0.5 portal-type-caption font-semibold text-theme"
                  >
                    Người ở cùng
                  </span>
                </div>
              </div>
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme">
                <IconDoor class="h-5 w-5" aria-hidden="true" />
              </span>
            </div>

            <p class="portal-type-caption mt-2 text-body">
              {{ formatCurrency(contract.monthlyRent) }}/tháng · Hợp đồng đến {{ formatViDate(contract.endDate) }}
            </p>
          </template>

          <!-- Room keycard identity footer -->
          <div
            class="flex items-center gap-3"
            :class="contract ? 'mt-3 border-t border-border-light pt-3' : 'mt-2'"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-smoke-blue portal-type-label font-bold text-theme">
              {{ initials }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="portal-type-caption text-body">{{ greeting }}</p>
              <p class="portal-type-label truncate text-title">
                {{ profile?.fullName ?? 'Người thuê' }}
              </p>
              <p
                v-if="contract?.assignmentRole === 'roommate' && contract.primaryTenantName"
                class="portal-type-caption mt-0.5 truncate text-body"
              >
                Người đứng hợp đồng: {{ contract.primaryTenantName }}
              </p>
            </div>
            <IconChevronRight
              v-if="contract"
              class="h-4 w-4 shrink-0 text-body"
              aria-hidden="true"
            />
          </div>

          <p v-if="!contract" class="portal-type-caption mt-3 border-t border-border-light pt-3 text-body">
            Chưa có nơi ở đang hoạt động.
          </p>
        </PortalCard>
      </section>

      <PortalDebtSummary
        v-if="!loading && financialSummary"
        :summary="financialSummary"
        @open-invoice="navigateTo(`/portal/invoices/${$event}`)"
        @open-history="navigateTo('/portal/invoices')"
      />
      <PortalSkeleton v-else-if="loading" variant="statement" />

      <!-- Latest history is secondary to unresolved balances across all periods. -->
      <section v-if="!loading" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="portal-type-heading text-title">Hoá đơn gần đây</h2>
          <NuxtLink to="/portal/invoices" class="portal-type-label inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40">
            Xem tất cả<IconChevronRight class="size-4" aria-hidden="true" />
          </NuxtLink>
        </div>
        <PortalCard
          v-if="showLatest && latest && latestState"
          interactive
          :accent="portalInvoiceStatementAccent(latest.status)"
          @click="navigateTo(`/portal/invoices/${latest.id}`)"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="portal-type-label text-title">Kỳ {{ String(latest.periodMonth).padStart(2, '0') }}/{{ latest.periodYear }}</p>
              <p class="portal-type-caption mt-1 break-words text-body">{{ latest.invoiceCode }}</p>
            </div>
            <PortalStatusBadge :status="latest.status" />
          </div>
          <p class="portal-money mt-3 text-xl font-semibold text-title"><span>{{ formatCurrencyNumber(latest.totalAmount) }}</span><span class="portal-money-unit">₫</span></p>
          <p class="portal-type-caption mt-1 text-body">Đã trả {{ formatCurrency(latest.paidAmount) }}</p>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-light pt-3">
            <p class="portal-type-caption text-body">{{ latest.status === 'void' ? 'Hoá đơn đã huỷ' : latestState.outstanding ? latestState.dueLabel : 'Đã hoàn tất' }}</p>
            <span class="portal-type-label inline-flex items-center gap-1 text-theme">Xem chi tiết<IconChevronRight class="size-4" aria-hidden="true" /></span>
          </div>
        </PortalCard>
        <p v-else-if="!latest" class="portal-type-body text-body">Hoá đơn sẽ xuất hiện tại đây khi được phát hành.</p>
      </section>

      <!-- Financial overview -->
      <section v-if="!loading && financialOverview.labels.length >= 2" class="flex flex-col gap-3">
        <h2 class="portal-type-heading text-title">Chi phí gần đây</h2>
        <PortalCard>
          <PortalSpendingChart :invoices="invoices" />
          <p class="portal-type-caption mt-3 text-body">Theo các hoá đơn đã tải, tối đa 6 tháng hiển thị.</p>
          <!-- Integrated finance metrics -->
          <div class="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] divide-x divide-border-light border-t border-border-light pt-4">
            <div class="min-w-0 pr-3">
            <p class="portal-type-caption text-body">Bình quân mỗi tháng</p>
            <p class="portal-money mt-1 whitespace-nowrap text-sm font-semibold text-title sm:text-base">
              {{ formatCurrencyCompact(financialOverview.averageMonthlyAmount) }}
              <span class="portal-money-unit">₫</span>
            </p>
            </div>
            <div class="min-w-0 pl-3">
            <p class="portal-type-caption text-body">Tỷ lệ đã thanh toán</p>
            <p class="portal-money mt-1 text-sm font-semibold text-[color:var(--portal-positive-ink)] sm:text-base">
              {{ financialOverview.paidRatio }}%
            </p>
            </div>
          </div>
        </PortalCard>
      </section>
      </template>
    </div>
  </PortalPullToRefresh>
</template>
