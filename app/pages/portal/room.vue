<script setup lang="ts">
import type { ContractStatus } from '~/types/contracts'
import { formatCurrencyNumber } from '~/utils/format/currency'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Phòng của bạn', back: null })

const { contract, status, error, refresh } = usePortalContract()

const STATUS_LABELS: Record<ContractStatus, string> = {
  active: 'Đang hiệu lực',
  expired: 'Đã hết hạn',
  terminated: 'Đã chấm dứt',
  renewed: 'Đã gia hạn',
}

const STATUS_CLASS: Record<ContractStatus, string> = {
  active: 'bg-portal-positive/10 text-portal-positive-ink',
  expired: 'bg-portal-warning/10 text-portal-warning-ink',
  terminated: 'bg-portal-danger/10 text-portal-danger-ink',
  renewed: 'bg-theme/10 text-theme',
}
</script>

<template>
  <PortalPullToRefresh :on-refresh="refresh">
    <div class="space-y-5 px-4 py-5">
      <template v-if="status === 'pending'">
        <PortalSkeleton variant="statement" />
        <PortalSkeleton variant="card" class="h-40" />
      </template>

      <PortalEmptyState
        v-else-if="error"
        tone="error"
        title="Không tải được thông tin phòng"
        action-label="Thử lại"
        @action="refresh"
      />

      <PortalEmptyState
        v-else-if="!contract"
        title="Chưa có hợp đồng"
        description="Bạn chưa có hợp đồng thuê đang hoạt động."
      >
        <template #icon>
          <IconDoor class="h-6 w-6" aria-hidden="true" />
        </template>
      </PortalEmptyState>

      <template v-else>
        <PortalCard>
          <div class="flex items-center gap-3">
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-smoke-blue text-theme">
              <IconDoor class="h-6 w-6" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <p class="portal-type-heading text-title">Phòng {{ contract.roomNumber }}</p>
              <p class="portal-type-body truncate text-body">{{ contract.buildingName }}</p>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="STATUS_CLASS[contract.status]"
            >
              {{ STATUS_LABELS[contract.status] }}
            </span>
            <span class="portal-type-caption text-body">{{ contract.contractCode }}</span>
          </div>
        </PortalCard>

        <PortalCard :padded="false">
          <dl class="divide-y divide-border-light">
            <div class="flex items-center justify-between gap-4 px-4 py-3">
              <dt class="portal-type-body text-body">Tiền thuê hàng tháng</dt>
              <dd class="portal-money shrink-0 text-sm font-semibold text-title">
                {{ formatCurrencyNumber(contract.monthlyRent) }}<span class="portal-money-unit">₫</span>
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 px-4 py-3">
              <dt class="portal-type-body text-body">Tiền cọc</dt>
              <dd class="portal-money shrink-0 text-sm font-semibold text-title">
                {{ formatCurrencyNumber(contract.deposit) }}<span class="portal-money-unit">₫</span>
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 px-4 py-3">
              <dt class="portal-type-body text-body">Ngày bắt đầu</dt>
              <dd class="portal-type-body text-right font-medium text-title">{{ contract.startDate }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 px-4 py-3">
              <dt class="portal-type-body text-body">Ngày kết thúc</dt>
              <dd class="portal-type-body text-right font-medium text-title">{{ contract.endDate }}</dd>
            </div>
          </dl>
        </PortalCard>
      </template>
    </div>
  </PortalPullToRefresh>
</template>
