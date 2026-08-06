<script setup lang="ts">
import type { ContractStatus } from '~/types/contracts'
import { formatCurrencyNumber } from '~/utils/format/currency'
import { formatViDate } from '~/utils/format/time'

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
    <div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 lg:px-8 lg:py-8">
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
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="portal-type-heading text-title">Phòng {{ contract.roomNumber }}</p>
                <span
                  v-if="contract.assignmentRole === 'roommate'"
                  class="rounded-full bg-theme/10 px-2 py-0.5 portal-type-caption font-semibold text-theme"
                >
                  Người ở cùng
                </span>
              </div>
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
          <p
            v-if="contract.assignmentRole === 'roommate' && contract.primaryTenantName"
            class="portal-type-caption mt-3 border-t border-border-light pt-3 text-body"
          >
            Người đứng hợp đồng: <span class="font-semibold text-title">{{ contract.primaryTenantName }}</span>
          </p>
        </PortalCard>

        <PortalCard :padded="false">
          <div class="px-4 pb-2 pt-4">
            <p class="portal-type-heading text-title">Điều khoản chính</p>
            <p class="portal-type-caption mt-0.5 text-body">Thông tin của hợp đồng đang hiệu lực</p>
          </div>
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
              <dd class="portal-type-body text-right font-medium text-title">{{ formatViDate(contract.startDate) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 px-4 py-3">
              <dt class="portal-type-body text-body">Ngày kết thúc</dt>
              <dd class="portal-type-body text-right font-medium text-title">{{ formatViDate(contract.endDate) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 px-4 py-3">
              <dt class="portal-type-body text-body">Ngày thanh toán</dt>
              <dd class="portal-type-body text-right font-medium text-title">
                {{ contract.paymentDueDay ? `Ngày ${contract.paymentDueDay} hằng tháng` : 'Chưa thỏa thuận' }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 px-4 py-3">
              <dt class="portal-type-body text-body">Số người ở</dt>
              <dd class="portal-type-body text-right font-medium text-title">
                {{ contract.occupantCount }} người
              </dd>
            </div>
          </dl>
        </PortalCard>

        <PortalCard
          v-if="contract.discountAmount !== 0 || contract.surchargeAmount !== 0 || contract.notes"
          :padded="false"
        >
          <div class="px-4 pb-2 pt-4">
            <p class="portal-type-heading text-title">Điều chỉnh hợp đồng</p>
          </div>
          <dl class="divide-y divide-border-light">
            <div v-if="contract.discountAmount !== 0" class="flex items-center justify-between gap-4 px-4 py-3">
              <dt class="portal-type-body text-body">Giảm giá</dt>
              <dd class="portal-money shrink-0 text-sm font-semibold text-title">
                {{ formatCurrencyNumber(contract.discountAmount) }}<span class="portal-money-unit">₫</span>
              </dd>
            </div>
            <div v-if="contract.surchargeAmount !== 0" class="flex items-center justify-between gap-4 px-4 py-3">
              <dt class="portal-type-body text-body">Phụ thu</dt>
              <dd class="portal-money shrink-0 text-sm font-semibold text-title">
                {{ formatCurrencyNumber(contract.surchargeAmount) }}<span class="portal-money-unit">₫</span>
              </dd>
            </div>
            <div v-if="contract.notes" class="px-4 py-3">
              <dt class="portal-type-body text-body">Ghi chú</dt>
              <dd class="portal-type-body mt-1.5 whitespace-pre-line break-words text-title">{{ contract.notes }}</dd>
            </div>
          </dl>
        </PortalCard>
      </template>
    </div>
  </PortalPullToRefresh>
</template>
