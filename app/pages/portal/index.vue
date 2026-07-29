<script setup lang="ts">
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'
import {
  formatCurrency,
  formatCurrencyCompact,
  formatCurrencyNumber,
} from '~/utils/format/currency'
import { formatViDate } from '~/utils/format/time'
import { buildPortalFinancialOverview } from '~/utils/tenant-portal/financial-overview'

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
  status: invoiceStatus,
  error: bootstrapError,
  refresh: refreshInvoices,
} = usePortalInvoices()

const loading = computed(
  () => profileStatus.value === 'pending'
    || contractStatus.value === 'pending'
    || invoiceStatus.value === 'pending',
)
const financialOverview = computed(() =>
  buildPortalFinancialOverview(invoices.value, 6),
)
const latestInvoiceHeading = computed(() =>
  latest.value?.balanceAmount && latest.value.balanceAmount > 0
    ? 'Công nợ cần xử lý'
    : 'Hoá đơn mới nhất',
)

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
        <PortalSkeleton v-if="loading" variant="statement" class="h-56" />
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

            <div class="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 rounded-xl bg-smoke-card px-3 py-2.5">
              <div class="min-w-0">
                <p class="portal-type-caption text-body">Tiền thuê</p>
                <p class="portal-money mt-0.5 break-words text-sm font-semibold text-title">
                  {{ formatCurrency(contract.monthlyRent) }}<span class="font-normal text-body">/th</span>
                </p>
              </div>
              <div class="min-w-0">
                <p class="portal-type-caption text-body">Hợp đồng</p>
                <p class="portal-money mt-0.5 break-words text-sm font-semibold text-title">
                  {{ formatViDate(contract.startDate) }} – {{ formatViDate(contract.endDate) }}
                </p>
              </div>
            </div>
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

      <!-- Latest invoice -->
      <section class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h2 class="portal-type-heading text-title">{{ latestInvoiceHeading }}</h2>
          <NuxtLink to="/portal/invoices" class="portal-type-label inline-flex items-center gap-0.5 rounded-md text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40">
            Tất cả<IconChevronRight class="h-3.5 w-3.5" aria-hidden="true" />
          </NuxtLink>
        </div>
        <PortalSkeleton v-if="loading" variant="statement" />
        <PortalCard
          v-else-if="latest"
          interactive
          :accent="portalInvoiceStatementAccent(latest.status)"
          class="flex flex-col"
          @click="navigateTo(`/portal/invoices/${latest.id}`)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="portal-type-caption text-body">Kỳ {{ String(latest.periodMonth).padStart(2, '0') }}/{{ latest.periodYear }} <span class="opacity-50">· {{ latest.invoiceCode }}</span></p>
              <p class="portal-type-caption mt-2 text-body">
                {{ latest.balanceAmount > 0 ? 'Còn phải thanh toán' : 'Tổng hoá đơn' }}
              </p>
              <p
                class="portal-money portal-type-display mt-0.5"
                :class="`portal-money--${portalInvoiceStatementAccent(latest.status)}`"
              >
                <template v-if="latest.balanceAmount > 0">
                  <span>{{ formatCurrencyNumber(latest.balanceAmount) }}</span><span class="portal-money-unit">₫</span>
                </template>
                <template v-else>
                  <span>{{ formatCurrencyNumber(latest.totalAmount) }}</span><span class="portal-money-unit">₫</span>
                </template>
              </p>
            </div>
            <PortalStatusBadge :status="latest.status" />
          </div>
          <p class="portal-type-caption mt-3 text-body">
            Tổng <span class="portal-money font-semibold text-title">{{ formatCurrency(latest.totalAmount) }}</span>
            <span class="mx-1 opacity-40" aria-hidden="true">·</span>
            Đã trả <span class="portal-money font-semibold text-portal-positive-ink">{{ formatCurrency(latest.paidAmount) }}</span>
          </p>
          <div class="mt-3 flex items-end justify-between gap-3 border-t border-border-light pt-3">
            <div class="min-w-0">
              <p class="portal-type-caption text-body">
                {{ latest.balanceAmount > 0 ? 'Hạn thanh toán' : 'Trạng thái' }}
              </p>
              <p class="portal-type-label mt-0.5 truncate text-title">
                {{ latest.balanceAmount > 0 && latest.dueDate ? formatViDate(latest.dueDate) : 'Đã hoàn tất' }}
              </p>
            </div>
            <span class="portal-type-label inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-theme">
              Xem chi tiết
              <IconChevronRight class="size-4" aria-hidden="true" />
            </span>
          </div>
        </PortalCard>
        <PortalCard v-else>
          <p class="text-sm text-body">Chưa có hoá đơn nào.</p>
        </PortalCard>
      </section>

      <!-- Financial overview -->
      <section v-if="!loading && invoices.length >= 2" class="flex flex-col gap-3">
        <h2 class="portal-type-heading text-title">Tổng quan tài chính</h2>
        <PortalCard>
          <PortalSpendingChart :invoices="invoices" />
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
