<script setup lang="ts">
import type { BillingItemSummary, BillingItemDetail } from '~/types/billing'

const props = defineProps<{
  items: BillingItemSummary[]
  selectedIds: string[]
  expandedDetail?: BillingItemDetail | null
  isLoadingDetail?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-select', id: string): void
  (e: 'select-all'): void
  (e: 'clear-selection'): void
  (e: 'expand', itemId: string): void
}>()

function formatVnd(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount)
}

function isSelected(id: string) {
  return props.selectedIds.includes(id)
}

const allSelected = computed(
  () => props.items.length > 0 && props.items.every(i => isSelected(i.id)),
)

function onSelectAll() {
  if (allSelected.value) {
    emit('clear-selection')
  }
  else {
    emit('select-all')
  }
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="min-w-full text-sm">
      <thead>
        <tr class="border-b border-dark-border text-muted text-xs">
          <th class="py-2 px-3 w-8">
            <input type="checkbox" :checked="allSelected" class="rounded border-dark-border" @change="onSelectAll" >
          </th>
          <th class="py-2 px-3 text-left">Phòng</th>
          <th class="py-2 px-3 text-left">Khách thuê</th>
          <th class="py-2 px-3 text-right">Thuê</th>
          <th class="py-2 px-3 text-right">Điện</th>
          <th class="py-2 px-3 text-right">Nước</th>
          <th class="py-2 px-3 text-right">DV</th>
          <th class="py-2 px-3 text-right font-semibold">Tổng</th>
          <th class="py-2 px-3 text-center">Trạng thái</th>
          <th class="py-2 px-3 text-left">Ngày TT</th>
          <th class="py-2 px-3 w-8" />
        </tr>
      </thead>
      <tbody>
        <template v-for="item in items" :key="item.id">
          <tr class="border-b border-dark-border/50 hover:bg-dark-surface/50">
            <td class="py-2 px-3">
              <input
                type="checkbox"
                :checked="isSelected(item.id)"
                class="rounded border-dark-border"
                @change="$emit('toggle-select', item.id)"
              >
            </td>
            <td class="py-2 px-3 font-medium text-white">{{ item.room?.roomNumber }}</td>
            <td class="py-2 px-3 text-muted">{{ item.tenant?.fullName }}</td>
            <td class="py-2 px-3 text-right text-white">{{ formatVnd(item.rentAmount) }}</td>
            <td class="py-2 px-3 text-right text-white">{{ formatVnd(item.electricityAmount) }}</td>
            <td class="py-2 px-3 text-right text-white">{{ formatVnd(item.waterAmount) }}</td>
            <td class="py-2 px-3 text-right text-white">{{ formatVnd(item.serviceAmount) }}</td>
            <td class="py-2 px-3 text-right font-semibold text-white">{{ formatVnd(item.totalAmount) }}</td>
            <td class="py-2 px-3 text-center">
              <BillingStatusBadge :status="item.paymentStatus" />
            </td>
            <td class="py-2 px-3 text-muted text-xs">
              {{ item.paidAt ? new Date(item.paidAt).toLocaleDateString('vi-VN') : '—' }}
            </td>
            <td class="py-2 px-3 text-center">
              <button
                class="text-muted hover:text-white text-xs transition-colors"
                @click="$emit('expand', item.id)"
              >
                <span v-if="isLoadingDetail">...</span>
                <span v-else>▼</span>
              </button>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
