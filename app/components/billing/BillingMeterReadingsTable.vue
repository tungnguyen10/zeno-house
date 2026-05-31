<script setup lang="ts">
import type { BillingWorkspaceMeterReading, BillingWorkspaceContract } from '~/types/billing'

const props = defineProps<{
  contracts: BillingWorkspaceContract[]
  meterReadings: BillingWorkspaceMeterReading[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:reading', roomId: string, meterType: 'electricity' | 'water', field: string, value: number | boolean | string | null): void
}>()

function getReading(roomId: string, meterType: 'electricity' | 'water') {
  return props.meterReadings.find(r => r.roomId === roomId && r.meterType === meterType) ?? null
}

function onReadingInput(roomId: string, meterType: 'electricity' | 'water', field: string, value: number | boolean | string | null) {
  emit('update:reading', roomId, meterType, field, value)
}

function hasNegative(roomId: string, meterType: 'electricity' | 'water') {
  const r = getReading(roomId, meterType)
  if (!r) return false
  const consumption = r.isAdjusted
    ? r.consumption
    : r.oldReading != null && r.newReading != null
      ? r.newReading - r.oldReading
      : r.consumption
  return consumption != null && consumption < 0
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="min-w-full text-sm">
      <thead>
        <tr class="border-b border-dark-border text-muted text-xs">
          <th class="py-2 px-3 text-left">Phòng</th>
          <th class="py-2 px-3 text-left">Khách thuê</th>
          <th class="py-2 px-3 text-right">Điện cũ</th>
          <th class="py-2 px-3 text-right">Điện mới</th>
          <th class="py-2 px-3 text-right">TT điện</th>
          <th class="py-2 px-3 text-right">Nước cũ</th>
          <th class="py-2 px-3 text-right">Nước mới</th>
          <th class="py-2 px-3 text-right">TT nước</th>
          <th class="py-2 px-3 text-left">Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="contract in contracts" :key="contract.contractId" class="border-b border-dark-border/50 hover:bg-dark-surface/50">
          <td class="py-2 px-3 font-medium text-white">{{ contract.roomNumber }}</td>
          <td class="py-2 px-3 text-muted">{{ contract.tenantName }}</td>

          <!-- Electricity -->
          <template v-for="meterType in ['electricity', 'water'] as const" :key="meterType">
            <td class="py-2 px-3 text-right text-muted">
              {{ getReading(contract.roomId, meterType)?.oldReading ?? '—' }}
            </td>
            <td class="py-2 px-3">
              <div :class="['flex items-center justify-end gap-1', hasNegative(contract.roomId, meterType) ? 'text-error-vivid' : '']">
                <input
                  v-if="!disabled"
                  type="number"
                  class="w-20 bg-dark-surface border border-dark-border rounded px-2 py-1 text-right text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan/30"
                  :value="getReading(contract.roomId, meterType)?.newReading ?? ''"
                  @change="(e) => onReadingInput(contract.roomId, meterType, 'newReading', Number((e.target as HTMLInputElement).value))"
                >
                <span v-else>{{ getReading(contract.roomId, meterType)?.newReading ?? '—' }}</span>
                <span v-if="hasNegative(contract.roomId, meterType)" class="text-error-vivid text-xs">⚠</span>
              </div>
            </td>
            <td class="py-2 px-3 text-right">
              <span :class="hasNegative(contract.roomId, meterType) ? 'text-error-vivid' : 'text-white'">
                {{
                  (() => {
                    const r = getReading(contract.roomId, meterType)
                    if (!r) return '—'
                    if (r.isAdjusted) return r.consumption ?? '—'
                    if (r.oldReading != null && r.newReading != null) return r.newReading - r.oldReading
                    return '—'
                  })()
                }}
              </span>
            </td>
          </template>

          <td class="py-2 px-3 text-muted text-xs">—</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
