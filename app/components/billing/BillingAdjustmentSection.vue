<script setup lang="ts">
import type { BillingWorkspaceContract, BillingWorkspaceMeterReading } from '~/types/billing'

const props = defineProps<{
  contracts: BillingWorkspaceContract[]
  meterReadings: BillingWorkspaceMeterReading[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:oldReading', roomId: string, meterType: 'electricity' | 'water', value: number | null, reason: string): void
}>()

const isOpen = ref(false)
const editingRows = ref<Record<string, { oldElec: string; oldWater: string; reason: string }>>({})

function getReading(roomId: string, meterType: 'electricity' | 'water') {
  return props.meterReadings.find(r => r.roomId === roomId && r.meterType === meterType)
}

function startEdit(roomId: string) {
  const elecReading = getReading(roomId, 'electricity')
  const waterReading = getReading(roomId, 'water')
  editingRows.value[roomId] = {
    oldElec: elecReading?.oldReading != null ? String(elecReading.oldReading) : '',
    oldWater: waterReading?.oldReading != null ? String(waterReading.oldReading) : '',
    reason: '',
  }
}

function saveRow(roomId: string) {
  const row = editingRows.value[roomId]
  if (!row || !row.reason.trim()) return

  const oldElec = row.oldElec ? Number(row.oldElec) : null
  const oldWater = row.oldWater ? Number(row.oldWater) : null

  emit('update:oldReading', roomId, 'electricity', oldElec, row.reason)
  emit('update:oldReading', roomId, 'water', oldWater, row.reason)

  const { [roomId]: _, ...rest } = editingRows.value
  editingRows.value = rest
}

function cancelEdit(roomId: string) {
  const { [roomId]: _, ...rest } = editingRows.value
  editingRows.value = rest
}

function isEditing(roomId: string) {
  return roomId in editingRows.value
}

function getEditRow(roomId: string) {
  return editingRows.value[roomId]!
}
</script>

<template>
  <div class="mt-6">
    <button
      class="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors"
      @click="isOpen = !isOpen"
    >
      <span class="text-xs">{{ isOpen ? '▼' : '▶' }}</span>
      <span>Điều chỉnh chỉ số đầu kỳ</span>
      <span class="text-xs text-muted">(thay đồng hồ / sửa sai)</span>
    </button>

    <div v-if="isOpen" class="mt-3 rounded-xl border border-dark-border overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b border-dark-border bg-dark-surface text-muted text-xs">
            <th class="py-2.5 px-3 text-left">STT</th>
            <th class="py-2.5 px-3 text-left">Phòng</th>
            <th class="py-2.5 px-3 text-left">Người thuê</th>
            <th class="py-2.5 px-3 text-right">Số Đ đầu kỳ</th>
            <th class="py-2.5 px-3 text-right">Số N đầu kỳ</th>
            <th class="py-2.5 px-3 text-left">Lý do</th>
            <th class="py-2.5 px-3 text-center">Thao tác</th>
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

            <!-- Old Electricity -->
            <td class="py-2 px-3 text-right">
              <input
                v-if="isEditing(contract.roomId)"
                v-model="getEditRow(contract.roomId).oldElec"
                type="number"
                class="w-20 bg-dark-surface border border-dark-border rounded px-2 py-1 text-right text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan/30"
              >
              <span v-else class="text-white">
                {{ getReading(contract.roomId, 'electricity')?.oldReading ?? '—' }}
              </span>
            </td>

            <!-- Old Water -->
            <td class="py-2 px-3 text-right">
              <input
                v-if="isEditing(contract.roomId)"
                v-model="getEditRow(contract.roomId).oldWater"
                type="number"
                class="w-20 bg-dark-surface border border-dark-border rounded px-2 py-1 text-right text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan/30"
              >
              <span v-else class="text-white">
                {{ getReading(contract.roomId, 'water')?.oldReading ?? '—' }}
              </span>
            </td>

            <!-- Reason -->
            <td class="py-2 px-3">
              <input
                v-if="isEditing(contract.roomId)"
                v-model="getEditRow(contract.roomId).reason"
                type="text"
                placeholder="Lý do thay đổi..."
                class="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-sm text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-cyan/30"
              >
              <span v-else class="text-muted text-xs">
                {{ getReading(contract.roomId, 'electricity')?.adjustmentReason ?? '' }}
              </span>
            </td>

            <!-- Actions -->
            <td class="py-2 px-3 text-center">
              <template v-if="!disabled">
                <div v-if="isEditing(contract.roomId)" class="flex items-center justify-center gap-1">
                  <button
                    class="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                    :disabled="!getEditRow(contract.roomId).reason?.trim()"
                    @click="saveRow(contract.roomId)"
                  >
                    Lưu
                  </button>
                  <button
                    class="px-2 py-1 text-xs text-muted hover:text-white"
                    @click="cancelEdit(contract.roomId)"
                  >
                    Hủy
                  </button>
                </div>
                <button
                  v-else
                  class="text-xs text-cyan hover:text-cyan/80"
                  @click="startEdit(contract.roomId)"
                >
                  Sửa
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
