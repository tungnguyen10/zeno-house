<script setup lang="ts">
import type { BillingWorkspaceWarning } from '~/types/billing'

interface PreviewItem {
  contractId: string
  roomId: string
  roomNumber: string
  tenantName: string
  amounts: {
    rentAmount: number
    serviceAmount: number
    electricityAmount: number
    waterAmount: number
    utilityAmount: number
    totalAmount: number
  }
  warnings: BillingWorkspaceWarning[]
}

defineProps<{
  items: PreviewItem[]
  warnings: BillingWorkspaceWarning[]
  isCalculating?: boolean
}>()

defineEmits<{
  (e: 'calculate'): void
}>()

function formatVnd(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <span v-if="warnings.length" class="text-warning text-sm">⚠ {{ warnings.length }} cảnh báo</span>
      </div>
      <button
        class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        :disabled="isCalculating"
        @click="$emit('calculate')"
      >
        <span v-if="isCalculating">Đang tính...</span>
        <span v-else>Tính tiền preview</span>
      </button>
    </div>

    <div v-if="items.length > 0" class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b border-dark-border text-muted text-xs">
            <th class="py-2 px-3 text-left">Phòng</th>
            <th class="py-2 px-3 text-left">Khách thuê</th>
            <th class="py-2 px-3 text-right">Tiền thuê</th>
            <th class="py-2 px-3 text-right">Điện</th>
            <th class="py-2 px-3 text-right">Nước</th>
            <th class="py-2 px-3 text-right">Dịch vụ</th>
            <th class="py-2 px-3 text-right font-semibold">Tổng</th>
            <th class="py-2 px-3 text-center">Cảnh báo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.contractId" class="border-b border-dark-border/50 hover:bg-dark-surface/50">
            <td class="py-2 px-3 font-medium text-white">{{ item.roomNumber }}</td>
            <td class="py-2 px-3 text-muted">{{ item.tenantName }}</td>
            <td class="py-2 px-3 text-right text-white">{{ formatVnd(item.amounts.rentAmount) }}</td>
            <td class="py-2 px-3 text-right text-white">{{ formatVnd(item.amounts.electricityAmount) }}</td>
            <td class="py-2 px-3 text-right text-white">{{ formatVnd(item.amounts.waterAmount) }}</td>
            <td class="py-2 px-3 text-right text-white">{{ formatVnd(item.amounts.serviceAmount) }}</td>
            <td class="py-2 px-3 text-right font-semibold text-white">{{ formatVnd(item.amounts.totalAmount) }}</td>
            <td class="py-2 px-3 text-center">
              <span v-if="item.warnings.length" class="text-warning text-xs" :title="item.warnings.map(w => w.type).join(', ')">⚠</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!isCalculating" class="text-muted text-sm text-center py-8">
      Nhấn "Tính tiền preview" để xem kết quả dự kiến
    </div>
  </div>
</template>
