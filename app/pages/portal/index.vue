<script setup lang="ts">
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'
import { formatCurrencyNumber } from '~/utils/format/currency'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Zeno House', back: null })

const { profile, status: profileStatus } = usePortalProfile()
const { contract, status: contractStatus } = usePortalContract()
const { latest, status: invoiceStatus, refresh: refreshInvoices } = usePortalInvoices()

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

async function refreshAll() {
  await refreshInvoices()
}
</script>

<template>
  <PortalPullToRefresh :on-refresh="refreshAll">
    <div class="space-y-5 px-4 py-5 lg:px-8 lg:py-8">
      <!-- Greeting -->
      <div class="pt-1">
        <p class="portal-type-label uppercase tracking-wide text-body">{{ greeting }}</p>
        <PortalSkeleton v-if="loading" class="mt-1.5 h-8 w-48" />
        <h2 v-else class="portal-type-display mt-0.5 text-title">
          {{ profile?.fullName ?? 'Người thuê' }}
        </h2>
      </div>

      <div class="grid gap-5 lg:grid-cols-12 lg:items-stretch">
        <!-- Latest invoice -->
        <section class="flex flex-col gap-3 lg:col-span-7">
          <div class="flex items-center justify-between">
            <h3 class="portal-type-heading text-title">Hoá đơn mới nhất</h3>
            <NuxtLink to="/portal/invoices" class="portal-type-label inline-flex items-center gap-0.5 rounded-md text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40">
              Tất cả<IconChevronRight class="h-3.5 w-3.5" aria-hidden="true" />
            </NuxtLink>
          </div>
          <PortalSkeleton v-if="loading" variant="statement" class="flex-1" />
          <PortalCard
            v-else-if="latest"
            interactive
            :accent="portalInvoiceStatementAccent(latest.status)"
            class="flex flex-1 flex-col"
            @click="navigateTo(`/portal/invoices/${latest.id}`)"
          >
            <div class="flex items-start justify-between">
              <div>
                <p class="portal-type-caption text-body">Kỳ {{ String(latest.periodMonth).padStart(2, '0') }}/{{ latest.periodYear }}</p>
                <p
                  class="portal-money portal-type-display mt-2"
                  :class="`portal-money--${portalInvoiceStatementAccent(latest.status)}`"
                >
                  <span>{{ formatCurrencyNumber(latest.balanceAmount) }}</span><span class="portal-money-unit">₫</span>
                </p>
                <p class="portal-type-caption mt-1 text-body">
                  {{ latest.balanceAmount > 0 ? 'Còn phải thanh toán' : 'Đã hoàn tất' }}
                </p>
              </div>
              <PortalStatusBadge :status="latest.status" />
            </div>
            <p v-if="latest.dueDate" class="portal-type-caption mt-auto border-t border-border-light pt-3 text-body">
              Hạn thanh toán: <span class="font-medium text-title">{{ latest.dueDate }}</span>
            </p>
          </PortalCard>
          <PortalCard v-else class="flex-1">
            <p class="text-sm text-body">Chưa có hoá đơn nào.</p>
          </PortalCard>
        </section>

        <!-- Contract / room -->
        <section class="flex flex-col gap-3 lg:col-span-5">
          <h3 class="portal-type-heading text-title">Phòng của bạn</h3>
          <PortalSkeleton v-if="loading" variant="card" class="flex-1" />
          <PortalCard v-else-if="contract" interactive class="flex flex-1 items-center" @click="navigateTo('/portal/room')">
            <div class="flex w-full items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-smoke-blue text-theme">
                <IconDoor class="h-6 w-6" aria-hidden="true" />
              </span>
              <div class="min-w-0">
                <p class="portal-type-heading truncate text-title">Phòng {{ contract.roomNumber }}</p>
                <p class="portal-type-caption truncate text-body">{{ contract.buildingName }}</p>
              </div>
              <IconChevronRight class="ml-auto h-5 w-5 text-body" aria-hidden="true" />
            </div>
          </PortalCard>
          <PortalCard v-else class="flex-1">
            <p class="text-sm text-body">Chưa có hợp đồng đang hoạt động.</p>
          </PortalCard>
        </section>
      </div>

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
    </div>
  </PortalPullToRefresh>
</template>
