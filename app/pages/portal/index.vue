<script setup lang="ts">
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'
import { formatCurrency, formatCurrencyNumber } from '~/utils/format/currency'
import { formatViDate } from '~/utils/format/time'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Zeno House', back: null })

const { profile, status: profileStatus } = usePortalProfile()
const { contract, status: contractStatus } = usePortalContract()
const { invoices, latest, status: invoiceStatus, refresh: refreshInvoices } = usePortalInvoices()

const loading = computed(
  () => profileStatus.value === 'pending'
    || contractStatus.value === 'pending'
    || invoiceStatus.value === 'pending',
)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 14) return 'Chào buổi trưa'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
})

const formattedDate = computed(() => {
  const now = new Date()
  const weekday = now.toLocaleDateString('vi-VN', { weekday: 'long' })
  const date = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${weekday}, ${date}`
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
      <!-- Identity hero: greeting + room (unified) -->
      <section>
        <PortalSkeleton v-if="loading" variant="statement" class="h-44" />
        <PortalCard
          v-else
          :interactive="!!contract"
          class="flex flex-col"
          @click="contract ? navigateTo('/portal/room') : undefined"
        >
          <!-- Greeting row: avatar + name + date -->
          <div class="flex items-start gap-3">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-smoke-blue portal-type-label font-bold text-theme">
              {{ initials }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="portal-type-caption text-body">{{ greeting }}</p>
              <p class="portal-type-display mt-0.5 text-title">{{ profile?.fullName ?? 'Người thuê' }}</p>
            </div>
            <p class="portal-type-caption shrink-0 pt-0.5 text-right text-body">{{ formattedDate }}</p>
          </div>

          <template v-if="contract">
            <!-- Room row -->
            <div class="mt-3 flex items-center gap-3 border-t border-border-light pt-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-smoke-blue text-theme">
                <IconDoor class="h-5 w-5" aria-hidden="true" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="portal-type-label text-title">Phòng {{ contract.roomNumber }}</p>
                <p class="portal-type-caption truncate text-body">{{ contract.buildingName }}</p>
              </div>
              <IconChevronRight class="h-4 w-4 shrink-0 text-body" aria-hidden="true" />
            </div>
            <!-- Contract stats panel -->
            <div class="mt-2.5 grid grid-cols-2 gap-x-4 rounded-xl bg-smoke-card px-3 py-2.5">
              <div>
                <p class="portal-type-caption text-body">Tiền thuê</p>
                <p class="portal-money mt-0.5 text-sm font-semibold text-title">{{ formatCurrency(contract.monthlyRent) }}<span class="font-normal text-body">/th</span></p>
              </div>
              <div>
                <p class="portal-type-caption text-body">Hợp đồng</p>
                <p class="portal-money mt-0.5 text-sm font-semibold text-title">{{ formatViDate(contract.startDate) }} – {{ formatViDate(contract.endDate) }}</p>
              </div>
            </div>
          </template>

          <p v-else class="portal-type-caption mt-3 border-t border-border-light pt-3 text-body">
            Chưa có hợp đồng đang hoạt động.
          </p>
        </PortalCard>
      </section>

      <!-- Latest invoice -->
      <section class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h3 class="portal-type-heading text-title">Hoá đơn mới nhất</h3>
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
          <p class="portal-type-caption mt-3 border-t border-border-light pt-3 text-body">
            Tổng: <span class="portal-money font-semibold text-title">{{ formatCurrency(latest.totalAmount) }}</span>
            <span class="mx-1.5 opacity-40" aria-hidden="true">·</span>
            Đã trả: <span class="portal-money font-semibold text-portal-positive-ink">{{ formatCurrency(latest.paidAmount) }}</span>
            <template v-if="latest.dueDate">
              <span class="mx-1.5 opacity-40" aria-hidden="true">·</span>
              Hạn: <span class="font-medium text-title">{{ latest.dueDate }}</span>
            </template>
          </p>
        </PortalCard>
        <PortalCard v-else>
          <p class="text-sm text-body">Chưa có hoá đơn nào.</p>
        </PortalCard>
      </section>

      <!-- Quick actions -->
      <section class="grid grid-cols-2 gap-3">
        <PortalCard interactive @click="navigateTo('/portal/requests')">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme">
              <IconMessageCircle class="h-5 w-5" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <p class="portal-type-heading text-title">Gửi yêu cầu</p>
              <p class="portal-type-caption text-body">Báo hỏng, hỗ trợ</p>
            </div>
          </div>
        </PortalCard>
        <PortalCard interactive @click="navigateTo('/portal/profile')">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme">
              <IconUser class="h-5 w-5" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <p class="portal-type-heading text-title">Hồ sơ</p>
              <p class="portal-type-caption text-body">Thông tin cá nhân</p>
            </div>
          </div>
        </PortalCard>
      </section>

      <!-- Spending trend (visible once at least 2 invoices exist) -->
      <section v-if="!loading && invoices.length >= 2" class="flex flex-col gap-3">
        <h3 class="portal-type-heading text-title">Xu hướng chi tiêu</h3>
        <PortalCard>
          <PortalSpendingChart :invoices="invoices" />
          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-light pt-2">
            <span class="inline-flex items-center gap-1.5 portal-type-caption text-body">
              <span class="inline-block h-2 w-2 rounded-full bg-portal-positive" aria-hidden="true" />Đã thanh toán
            </span>
            <span class="inline-flex items-center gap-1.5 portal-type-caption text-body">
              <span class="inline-block h-2 w-2 rounded-full bg-portal-warning" aria-hidden="true" />Chưa thanh toán
            </span>
            <span class="inline-flex items-center gap-1.5 portal-type-caption text-body">
              <span class="inline-block h-2 w-2 rounded-full bg-portal-danger" aria-hidden="true" />Quá hạn
            </span>
          </div>
        </PortalCard>
      </section>
    </div>
  </PortalPullToRefresh>
</template>
