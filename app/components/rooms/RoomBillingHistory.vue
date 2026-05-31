<script setup lang="ts">
import type { BillingItemSummary } from '~/types/billing'
import type { ApiSuccess } from '~/types/api'

const props = defineProps<{
  roomId: string
  buildingId: string
}>()

const { data, status } = useFetch<ApiSuccess<BillingItemSummary[]>>(
  () => `/api/billing-items?room_id=${props.roomId}`,
  { watch: [() => props.roomId] },
)

const items = computed(() => data.value?.data ?? [])

function formatVnd(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount)
}
</script>

<template>
  <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
    <h2 class="text-sm font-semibold text-white mb-3">Lịch sử billing</h2>

    <div v-if="status === 'pending'" class="text-muted text-sm">Đang tải...</div>

    <div v-else-if="items.length === 0" class="text-muted text-sm">Chưa có hóa đơn nào.</div>

    <div v-else class="space-y-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-center justify-between text-sm py-2 border-b border-dark-border/50 last:border-0"
      >
        <div>
          <span class="text-white font-medium">{{ formatVnd(item.totalAmount) }}đ</span>
        </div>
        <div class="flex items-center gap-3">
          <BillingStatusBadge :status="item.paymentStatus" />
          <span class="text-muted text-xs">
            {{ item.paidAt ? new Date(item.paidAt).toLocaleDateString('vi-VN') : '' }}
          </span>
          <NuxtLink
            v-if="buildingId"
            :to="`/buildings/${buildingId}/billing`"
            class="text-muted hover:text-white text-xs transition-colors"
          >
            Xem chi tiết
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
