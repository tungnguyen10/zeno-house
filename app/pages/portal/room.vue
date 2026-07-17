<script setup lang="ts">
import type { ContractStatus } from '~/types/contracts'
import { formatCurrency } from '~/utils/format/currency'

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
</script>

<template>
  <PortalPullToRefresh :on-refresh="refresh">
    <div class="space-y-4 px-4 py-4">
      <template v-if="status === 'pending'">
        <PortalSkeleton class="h-32 w-full" />
        <PortalSkeleton class="h-40 w-full" />
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
              <p class="text-lg font-bold text-title">Phòng {{ contract.roomNumber }}</p>
              <p class="truncate text-sm text-body">{{ contract.buildingName }}</p>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <span class="inline-flex items-center rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
              {{ STATUS_LABELS[contract.status] }}
            </span>
            <span class="text-xs text-body">{{ contract.contractCode }}</span>
          </div>
        </PortalCard>

        <PortalCard :padded="false">
          <dl class="divide-y divide-border-light">
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-sm text-body">Tiền thuê hàng tháng</dt>
              <dd class="text-sm font-semibold text-title">{{ formatCurrency(contract.monthlyRent) }}</dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-sm text-body">Tiền cọc</dt>
              <dd class="text-sm font-semibold text-title">{{ formatCurrency(contract.deposit) }}</dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-sm text-body">Ngày bắt đầu</dt>
              <dd class="text-sm font-medium text-title">{{ contract.startDate }}</dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-sm text-body">Ngày kết thúc</dt>
              <dd class="text-sm font-medium text-title">{{ contract.endDate }}</dd>
            </div>
          </dl>
        </PortalCard>
      </template>
    </div>
  </PortalPullToRefresh>
</template>
