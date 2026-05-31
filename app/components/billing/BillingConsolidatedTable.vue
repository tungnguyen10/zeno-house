<script setup lang="ts">
import type { BillingWorkspaceContract, BillingWorkspaceMeterReading, BillingItemSummary } from '~/types/billing'
import { calculateRowAmounts } from '~/utils/billing-calculator'

const props = defineProps<{
  contracts: BillingWorkspaceContract[]
  meterReadings: BillingWorkspaceMeterReading[]
  billingItems: BillingItemSummary[]
  electricityRate: number
  waterRate: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:reading', roomId: string, meterType: 'electricity' | 'water', value: number | null): void
  (e: 'toggle-paid', itemId: string, currentStatus: string): void
}>()

// Local state for edited readings
const localReadings = ref<Record<string, { newElec: number | null; newWater: number | null }>>({})

function getReading(roomId: string, meterType: 'electricity' | 'water') {
  return props.meterReadings.find(r => r.roomId === roomId && r.meterType === meterType) ?? null
}

function getLocalNewReading(roomId: string, meterType: 'electricity' | 'water'): number | null {
  const local = localReadings.value[roomId]
  if (meterType === 'electricity') return local?.newElec ?? null
  return local?.newWater ?? null
}

function getEffectiveNewReading(roomId: string, meterType: 'electricity' | 'water'): number | null {
  const local = getLocalNewReading(roomId, meterType)
  if (local != null) return local
  const reading = getReading(roomId, meterType)
  return reading?.newReading ?? null
}

function getOldReading(roomId: string, meterType: 'electricity' | 'water'): number | null {
  const reading = getReading(roomId, meterType)
  return reading?.oldReading ?? null
}

function getBillingItem(roomId: string) {
  return props.billingItems.find(i => i.room.id === roomId)
}

function computeRow(contract: BillingWorkspaceContract) {
  return calculateRowAmounts({
    oldElec: getOldReading(contract.roomId, 'electricity'),
    newElec: getEffectiveNewReading(contract.roomId, 'electricity'),
    oldWater: getOldReading(contract.roomId, 'water'),
    newWater: getEffectiveNewReading(contract.roomId, 'water'),
    electricityRate: props.electricityRate,
    waterRate: props.waterRate,
    monthlyRent: contract.monthlyRent,
    surchargeAmount: contract.surchargeAmount,
    discountAmount: contract.discountAmount,
    services: contract.services,
    occupantCount: contract.occupantCount,
  })
}

function onReadingBlur(roomId: string, meterType: 'electricity' | 'water', event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value ? Number(target.value) : null

  if (!localReadings.value[roomId]) {
    localReadings.value[roomId] = { newElec: null, newWater: null }
  }
  if (meterType === 'electricity') {
    localReadings.value[roomId].newElec = value
  }
  else {
    localReadings.value[roomId].newWater = value
  }

  emit('update:reading', roomId, meterType, value)
}

function onTogglePaid(roomId: string) {
  const item = getBillingItem(roomId)
  if (item) {
    emit('toggle-paid', item.id, item.paymentStatus)
  }
}

function isNegative(roomId: string, meterType: 'electricity' | 'water') {
  const old = getOldReading(roomId, meterType)
  const newVal = getEffectiveNewReading(roomId, meterType)
  if (old == null || newVal == null) return false
  return newVal - old < 0
}

function formatVnd(amount: number | null) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('vi-VN').format(amount)
}

// Totals
const totals = computed(() => {
  let totalAmount = 0
  let paidCount = 0
  let totalCount = 0

  for (const contract of props.contracts) {
    const row = computeRow(contract)
    totalAmount += row.totalAmount
    const item = getBillingItem(contract.roomId)
    if (item) {
      totalCount++
      if (item.paymentStatus === 'paid') paidCount++
    }
  }

  return { totalAmount, paidCount, totalCount }
})
</script>

<template>
  <div class="overflow-x-auto rounded-xl border border-dark-border">
    <table class="min-w-full text-sm">
      <thead>
        <tr class="border-b border-dark-border bg-dark-surface text-muted text-xs">
          <th class="py-2.5 px-3 text-left w-10">TT</th>
          <th class="py-2.5 px-3 text-left">Phòng</th>
          <th class="py-2.5 px-3 text-left">Họ tên</th>
          <th class="py-2.5 px-3 text-right">CS Điện cũ</th>
          <th class="py-2.5 px-3 text-right">CS Điện mới</th>
          <th class="py-2.5 px-3 text-right">CS Nước cũ</th>
          <th class="py-2.5 px-3 text-right">CS Nước mới</th>
          <th class="py-2.5 px-3 text-right">Tiền điện</th>
          <th class="py-2.5 px-3 text-right">Tiền nước</th>
          <th class="py-2.5 px-3 text-right">Phòng/DV</th>
          <th class="py-2.5 px-3 text-right font-semibold">Tổng</th>
          <th class="py-2.5 px-3 text-center">Đóng</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(contract, idx) in contracts"
          :key="contract.contractId"
          class="border-b border-dark-border/50 hover:bg-dark-surface/50"
        >
          <td class="py-2 px-3 text-muted">{{ idx + 1 }}</td>
          <td class="py-2 px-3 font-medium text-white">{{ contract.roomNumber }}</td>
          <td class="py-2 px-3 text-muted">{{ contract.tenantName }}</td>

          <!-- Electricity old -->
          <td class="py-2 px-3 text-right text-muted">
            {{ getOldReading(contract.roomId, 'electricity') ?? '—' }}
          </td>
          <!-- Electricity new (editable) -->
          <td class="py-2 px-3">
            <input
              v-if="!disabled"
              type="number"
              class="w-20 bg-dark-surface border rounded px-2 py-1 text-right text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan/30"
              :class="isNegative(contract.roomId, 'electricity') ? 'border-error-vivid' : 'border-dark-border'"
              :value="getEffectiveNewReading(contract.roomId, 'electricity') ?? ''"
              @blur="onReadingBlur(contract.roomId, 'electricity', $event)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            >
            <span v-else class="text-white text-right block">
              {{ getEffectiveNewReading(contract.roomId, 'electricity') ?? '—' }}
            </span>
          </td>

          <!-- Water old -->
          <td class="py-2 px-3 text-right text-muted">
            {{ getOldReading(contract.roomId, 'water') ?? '—' }}
          </td>
          <!-- Water new (editable) -->
          <td class="py-2 px-3">
            <input
              v-if="!disabled"
              type="number"
              class="w-20 bg-dark-surface border rounded px-2 py-1 text-right text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan/30"
              :class="isNegative(contract.roomId, 'water') ? 'border-error-vivid' : 'border-dark-border'"
              :value="getEffectiveNewReading(contract.roomId, 'water') ?? ''"
              @blur="onReadingBlur(contract.roomId, 'water', $event)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            >
            <span v-else class="text-white text-right block">
              {{ getEffectiveNewReading(contract.roomId, 'water') ?? '—' }}
            </span>
          </td>

          <!-- Computed amounts -->
          <td class="py-2 px-3 text-right" :class="isNegative(contract.roomId, 'electricity') ? 'text-error-vivid' : 'text-white'">
            {{ formatVnd(computeRow(contract).electricityAmount) }}
          </td>
          <td class="py-2 px-3 text-right" :class="isNegative(contract.roomId, 'water') ? 'text-error-vivid' : 'text-white'">
            {{ formatVnd(computeRow(contract).waterAmount) }}
          </td>
          <td class="py-2 px-3 text-right text-white">
            {{ formatVnd(computeRow(contract).roomServiceAmount) }}
          </td>
          <td class="py-2 px-3 text-right font-semibold text-white">
            {{ formatVnd(computeRow(contract).totalAmount) }}
          </td>

          <!-- Payment checkbox -->
          <td class="py-2 px-3 text-center">
            <input
              v-if="getBillingItem(contract.roomId)"
              type="checkbox"
              class="h-4 w-4 rounded border-dark-border text-cyan focus:ring-cyan"
              :checked="getBillingItem(contract.roomId)?.paymentStatus === 'paid'"
              @change="onTogglePaid(contract.roomId)"
            >
            <span v-else class="text-muted">—</span>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="contracts.length > 0">
        <tr class="border-t border-dark-border bg-dark-surface">
          <td colspan="10" class="py-2.5 px-3 text-right text-sm text-muted font-medium">TỔNG CỘNG:</td>
          <td class="py-2.5 px-3 text-right text-sm font-bold text-white">{{ formatVnd(totals.totalAmount) }}đ</td>
          <td class="py-2.5 px-3 text-center text-xs text-muted">{{ totals.paidCount }}/{{ totals.totalCount }}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
