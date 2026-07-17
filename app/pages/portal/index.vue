<script setup lang="ts">
import { formatCurrency } from '~/utils/format/currency'

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

async function refreshAll() {
  await refreshInvoices()
}
</script>

<template>
  <PortalPullToRefresh :on-refresh="refreshAll">
    <div class="space-y-4 px-4 py-4">
      <!-- Greeting -->
      <div>
        <p class="text-sm text-body">Xin chào,</p>
        <PortalSkeleton v-if="loading" class="mt-1 h-7 w-40" />
        <h2 v-else class="text-xl font-bold text-title">
          {{ profile?.fullName ?? 'Người thuê' }}
        </h2>
      </div>

      <!-- Latest invoice -->
      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-title">Hoá đơn mới nhất</h3>
          <NuxtLink to="/portal/invoices" class="text-xs font-medium text-theme">Tất cả</NuxtLink>
        </div>
        <PortalSkeleton v-if="loading" class="h-28 w-full" />
        <PortalCard v-else-if="latest" interactive @click="navigateTo(`/portal/invoices/${latest.id}`)">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-xs text-body">Kỳ {{ String(latest.periodMonth).padStart(2, '0') }}/{{ latest.periodYear }}</p>
              <p class="mt-1 text-2xl font-bold text-title">{{ formatCurrency(latest.balanceAmount) }}</p>
              <p class="mt-0.5 text-xs text-body">
                {{ latest.balanceAmount > 0 ? 'Còn phải thanh toán' : 'Đã hoàn tất' }}
              </p>
            </div>
            <PortalInvoiceStatusBadge :status="latest.status" />
          </div>
          <p v-if="latest.dueDate" class="mt-3 text-xs text-body">
            Hạn thanh toán: <span class="font-medium text-title">{{ latest.dueDate }}</span>
          </p>
        </PortalCard>
        <PortalCard v-else>
          <p class="text-sm text-body">Chưa có hoá đơn nào.</p>
        </PortalCard>
      </section>

      <!-- Contract / room -->
      <section class="space-y-2">
        <h3 class="text-sm font-semibold text-title">Phòng của bạn</h3>
        <PortalSkeleton v-if="loading" class="h-24 w-full" />
        <PortalCard v-else-if="contract" interactive @click="navigateTo('/portal/room')">
          <div class="flex items-center gap-3">
            <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-smoke-blue text-theme">
              <IconDoor class="h-6 w-6" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <p class="truncate font-semibold text-title">Phòng {{ contract.roomNumber }}</p>
              <p class="truncate text-xs text-body">{{ contract.buildingName }}</p>
            </div>
            <IconChevronRight class="ml-auto h-5 w-5 text-body" aria-hidden="true" />
          </div>
        </PortalCard>
        <PortalCard v-else>
          <p class="text-sm text-body">Chưa có hợp đồng đang hoạt động.</p>
        </PortalCard>
      </section>

      <!-- Quick actions -->
      <section class="grid grid-cols-2 gap-3">
        <PortalCard interactive @click="navigateTo('/portal/requests')">
          <div class="flex flex-col items-start gap-2">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-smoke-blue text-theme">
              <IconMessageCircle class="h-5 w-5" aria-hidden="true" />
            </span>
            <span class="text-sm font-semibold text-title">Gửi yêu cầu</span>
          </div>
        </PortalCard>
        <PortalCard interactive @click="navigateTo('/portal/profile')">
          <div class="flex flex-col items-start gap-2">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-smoke-blue text-theme">
              <IconUser class="h-5 w-5" aria-hidden="true" />
            </span>
            <span class="text-sm font-semibold text-title">Hồ sơ</span>
          </div>
        </PortalCard>
      </section>
    </div>
  </PortalPullToRefresh>
</template>
