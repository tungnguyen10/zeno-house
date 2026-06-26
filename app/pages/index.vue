<script setup lang="ts">
import { formatCurrency } from '~/utils/format/currency'
import { formatTimeHHmm } from '~/utils/format/time'
import { buildingPath, pendingOperationPath } from '~/utils/routes/operational'

definePageMeta({
  title: 'Dashboard',
})

const { summary, meta, isLoading, error, errorCode, refresh } = useDashboardSummary()

const isForbidden = computed(() => errorCode.value === 'FORBIDDEN')
const hasError = computed(() => Boolean(error.value) && !isForbidden.value)

const generatedAtLabel = computed(() => {
  if (!meta.value?.generatedAt) return ''
  return formatTimeHHmm(meta.value.generatedAt)
})

const maxRooms = computed(() =>
  Math.max(1, ...(summary.value?.buildingBreakdown ?? []).map(building => building.rooms.total)),
)

const maxTrend = computed(() =>
  Math.max(
    1,
    ...(summary.value?.billingTrend ?? []).map(row => Math.max(row.paidAmount, row.outstandingAmount)),
  ),
)

function operationLabel(type: string): string {
  switch (type) {
    case 'missing_readings': return 'Chưa chốt số'
    case 'unissued_invoices': return 'Chưa phát hành'
    case 'overdue_invoices': return 'Quá hạn'
    default: return type
  }
}

function severityVariant(severity: string): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' {
  if (severity === 'danger') return 'danger'
  if (severity === 'warning') return 'warning'
  if (severity === 'info') return 'accent'
  return 'neutral'
}

async function handleRefresh() {
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <UiPageHeader title="Dashboard" description="Tổng quan vận hành nhà cho thuê">
      <template #actions>
        <div class="flex items-center gap-3">
          <span v-if="generatedAtLabel" class="text-xs text-muted">
            Cập nhật lúc {{ generatedAtLabel }}
          </span>
          <UiButton
            variant="ghost"
            size="sm"
            icon-only
            aria-label="Tải lại dashboard"
            :loading="isLoading"
            @click="handleRefresh"
          >
            <IconRefresh class="h-4 w-4" />
          </UiButton>
        </div>
      </template>
    </UiPageHeader>

    <UiAlert v-if="isForbidden" severity="warning" title="Không có quyền">
      Bạn không có quyền xem dashboard. Vui lòng liên hệ quản trị viên.
    </UiAlert>

    <UiAlert v-else-if="hasError" severity="danger" title="Lỗi tải dữ liệu">
      <div class="flex items-start justify-between gap-3">
        <span>{{ error }}</span>
        <UiButton variant="secondary" size="sm" :loading="isLoading" @click="handleRefresh">
          Thử lại
        </UiButton>
      </div>
    </UiAlert>

    <template v-else>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <template v-if="isLoading">
          <UiSkeleton v-for="i in 3" :key="i" class="h-36 rounded-xl" />
        </template>
        <template v-else-if="summary">
          <UiSection title="Phòng">
            <div class="grid grid-cols-3 gap-3">
              <UiMetric label="Trống" :value="summary.rooms.available" tone="success" />
              <UiMetric label="Đang thuê" :value="summary.rooms.occupied" tone="accent" />
              <UiMetric label="Bảo trì" :value="summary.rooms.maintenance" tone="warning" />
            </div>
          </UiSection>

          <UiSection title="Hợp đồng">
            <div class="grid grid-cols-2 gap-3">
              <UiMetric label="Active" :value="summary.contracts.active" tone="accent" />
              <UiMetric label="Sắp hết hạn" :value="summary.contracts.expiringSoon" tone="warning" />
            </div>
          </UiSection>

          <UiSection :title="`Billing ${summary.billing.currentMonth.period}`">
            <div class="grid grid-cols-1 gap-3">
              <UiMetric label="Phát hành" :value="formatCurrency(summary.billing.currentMonth.invoiceTotal)" tone="accent" />
              <div class="grid grid-cols-2 gap-3">
                <UiMetric label="Đã thu" :value="formatCurrency(summary.billing.currentMonth.paidAmount)" tone="success" />
                <UiMetric label="Còn nợ" :value="formatCurrency(summary.billing.currentMonth.outstandingAmount)" tone="danger" />
              </div>
            </div>
          </UiSection>
        </template>
      </div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <UiSection title="Tỷ lệ phòng theo tòa">
          <div v-if="isLoading" class="space-y-3">
            <UiSkeleton v-for="i in 4" :key="i" class="h-12 rounded-lg" />
          </div>
          <UiEmptyState
            v-else-if="!summary?.buildingBreakdown.length"
            title="Chưa có tòa nhà"
            description="Thêm tòa nhà để xem tỷ lệ phòng."
          />
          <div v-else class="space-y-4">
            <NuxtLink
              v-for="building in summary.buildingBreakdown"
              :key="building.id"
              :to="buildingPath(building)"
              class="block rounded-lg border border-dark-border bg-dark-surface p-4 hover:border-cyan/40"
            >
              <div class="mb-3 flex items-center justify-between gap-3">
                <span class="text-sm font-medium text-white">{{ building.name }}</span>
                <span class="text-xs text-muted">{{ building.rooms.total }} phòng</span>
              </div>
              <div class="flex h-3 overflow-hidden rounded-full bg-dark-border">
                <div class="bg-success-neon" :style="{ width: `${(building.rooms.available / maxRooms) * 100}%` }" />
                <div class="bg-cyan" :style="{ width: `${(building.rooms.occupied / maxRooms) * 100}%` }" />
                <div class="bg-warning" :style="{ width: `${(building.rooms.maintenance / maxRooms) * 100}%` }" />
              </div>
              <div class="mt-2 flex gap-4 text-xs text-muted">
                <span>Trống {{ building.rooms.available }}</span>
                <span>Thuê {{ building.rooms.occupied }}</span>
                <span>Bảo trì {{ building.rooms.maintenance }}</span>
              </div>
            </NuxtLink>
          </div>
        </UiSection>

        <UiSection title="Thu và công nợ theo tháng">
          <div v-if="isLoading" class="space-y-3">
            <UiSkeleton v-for="i in 4" :key="i" class="h-12 rounded-lg" />
          </div>
          <UiEmptyState
            v-else-if="!summary?.billingTrend.length"
            title="Chưa có dữ liệu billing"
            description="Khi phát hành hóa đơn, biểu đồ sẽ hiển thị tại đây."
          />
          <div v-else class="space-y-4">
            <div v-for="row in summary.billingTrend" :key="row.period">
              <div class="mb-2 flex items-center justify-between gap-3 text-xs">
                <span class="font-medium text-white">{{ row.period }}</span>
                <span class="text-muted">{{ formatCurrency(row.paidAmount) }} / {{ formatCurrency(row.outstandingAmount) }}</span>
              </div>
              <div class="grid grid-cols-[5rem_1fr] items-center gap-3">
                <span class="text-xs text-success-neon">Đã thu</span>
                <div class="h-2 rounded-full bg-dark-border">
                  <div class="h-2 rounded-full bg-success-neon" :style="{ width: `${(row.paidAmount / maxTrend) * 100}%` }" />
                </div>
                <span class="text-xs text-error-vivid">Còn nợ</span>
                <div class="h-2 rounded-full bg-dark-border">
                  <div class="h-2 rounded-full bg-error" :style="{ width: `${(row.outstandingAmount / maxTrend) * 100}%` }" />
                </div>
              </div>
            </div>
          </div>
        </UiSection>
      </div>

      <UiSection title="Việc cần xử lý">
        <div v-if="isLoading" class="space-y-2">
          <UiSkeleton v-for="i in 3" :key="i" class="h-12 rounded-lg" />
        </div>
        <UiEmptyState
          v-else-if="!summary?.pendingOperations.length"
          title="Không có việc tồn"
          description="Các kỳ vận hành hiện không có cảnh báo cần xử lý."
        />
        <div v-else class="divide-y divide-dark-border rounded-xl border border-dark-border bg-dark-surface">
          <NuxtLink
            v-for="item in summary.pendingOperations"
            :key="`${item.type}-${item.building.id}-${item.period}`"
            :to="pendingOperationPath(item)"
            class="grid grid-cols-1 gap-2 px-4 py-3 hover:bg-dark-hover md:grid-cols-[10rem_1fr_7rem_5rem]"
          >
            <UiBadge :variant="severityVariant(item.severity)" pill>{{ operationLabel(item.type) }}</UiBadge>
            <span class="text-sm text-white">{{ item.building.name }}</span>
            <span class="text-sm text-muted">{{ item.period }}</span>
            <span class="text-sm text-muted md:text-right">{{ item.count }}</span>
          </NuxtLink>
        </div>
      </UiSection>
    </template>
  </div>
</template>
