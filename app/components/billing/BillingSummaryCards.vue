<script setup lang="ts">
import type { BillingItemsSummary } from '~/types/billing'

defineProps<{
  summary: BillingItemsSummary
}>()

function formatVnd(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount)
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    <div class="rounded-lg bg-dark-surface p-4 border border-dark-border">
      <p class="text-xs text-muted mb-1">Số phòng</p>
      <p class="text-xl font-semibold text-white">{{ summary.totalRooms }}</p>
    </div>
    <div class="rounded-lg bg-dark-surface p-4 border border-dark-border">
      <p class="text-xs text-muted mb-1">Tổng phải thu</p>
      <p class="text-xl font-semibold text-white">{{ formatVnd(summary.totalReceivable) }}đ</p>
    </div>
    <div class="rounded-lg bg-dark-surface p-4 border border-dark-border">
      <p class="text-xs text-muted mb-1">Đã thanh toán</p>
      <p class="text-xl font-semibold text-success-neon">{{ formatVnd(summary.totalPaid) }}đ</p>
    </div>
    <div class="rounded-lg bg-dark-surface p-4 border border-dark-border">
      <p class="text-xs text-muted mb-1">Chưa thanh toán</p>
      <p class="text-xl font-semibold text-warning">{{ formatVnd(summary.totalUnpaid) }}đ</p>
    </div>
    <div class="rounded-lg bg-dark-surface p-4 border border-dark-border">
      <p class="text-xs text-muted mb-1">Tổng điện</p>
      <p class="text-xl font-semibold text-cyan">{{ formatVnd(summary.totalElectricity) }}đ</p>
    </div>
    <div class="rounded-lg bg-dark-surface p-4 border border-dark-border">
      <p class="text-xs text-muted mb-1">Tổng nước</p>
      <p class="text-xl font-semibold text-cyan">{{ formatVnd(summary.totalWater) }}đ</p>
    </div>
  </div>
</template>
