<script setup lang="ts">
import type { ContractStatus } from '~/types/contracts'

const props = defineProps<{
  contractId: string
  roomId: string
  startDate: string
  endDate: string | null
  status: ContractStatus
}>()

const {
  isLoading,
  handoverInReadings,
  handoverOutReadings,
  getReadingByType,
  saveReadingForType,
  isSaving,
  saveError,
} = useContractHandoverReadings(props.contractId, props.roomId)

const showHandoverOut = computed(() =>
  props.status === 'terminated' || props.status === 'expired',
)

const startYear = computed(() => new Date(props.startDate).getFullYear())
const startMonth = computed(() => new Date(props.startDate).getMonth() + 1)
const endYear = computed(() => props.endDate ? new Date(props.endDate).getFullYear() : null)
const endMonth = computed(() => props.endDate ? new Date(props.endDate).getMonth() + 1 : null)

const METER_TYPES = ['electricity', 'water'] as const
type MeterType = typeof METER_TYPES[number]

interface RowState { value: string; date: string }
const rowStates = ref<Record<string, RowState>>({})

function rowKey(meterType: MeterType, readingType: 'handover_in' | 'handover_out') {
  return `${meterType}:${readingType}`
}

function getRow(meterType: MeterType, readingType: 'handover_in' | 'handover_out'): RowState {
  const key = rowKey(meterType, readingType)
  if (!rowStates.value[key]) {
    const existing = getReadingByType(meterType, readingType)
    rowStates.value[key] = {
      value: existing ? String(existing.readingValue) : '',
      date: readingType === 'handover_in'
        ? props.startDate
        : (props.endDate ?? new Date().toISOString().slice(0, 10)),
    }
  }
  return rowStates.value[key]
}

// Reset rowStates when props change OR when fetched readings update (after save)
watch(
  () => [props.startDate, props.endDate, handoverInReadings.value, handoverOutReadings.value],
  () => { rowStates.value = {} },
)

async function handleSave(meterType: MeterType, readingType: 'handover_in' | 'handover_out') {
  const row = getRow(meterType, readingType)
  if (!row.value || row.value === '') return
  const year = readingType === 'handover_in' ? startYear.value : (endYear.value ?? startYear.value)
  const month = readingType === 'handover_in' ? startMonth.value : (endMonth.value ?? startMonth.value)
  await saveReadingForType(meterType, readingType, Number(row.value), row.date, year, month)
}

const meterTypeLabel: Record<MeterType, string> = { electricity: 'Điện', water: 'Nước' }
</script>

<template>
  <div>
    <div v-if="isLoading" class="space-y-2">
      <UiSkeleton class="h-8 w-full rounded" />
      <UiSkeleton class="h-8 w-full rounded" />
    </div>

    <template v-else>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-dark-border">
              <th class="text-left text-xs text-muted pb-2 pr-3 w-24">Loại</th>
              <th v-if="showHandoverOut" class="text-left text-xs text-muted pb-2 pr-3 w-16">Chiều</th>
              <th class="text-right text-xs text-muted pb-2 pr-3 w-36">Chỉ số</th>
              <th class="text-center text-xs text-muted pb-2 w-36">Ngày đọc</th>
              <th class="text-xs text-muted pb-2 w-8" />
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-border">
            <template v-for="meterType in METER_TYPES" :key="meterType">
              <!-- Handover in row -->
              <tr>
                <td class="py-2 pr-3 text-white font-medium">{{ meterTypeLabel[meterType] }}</td>
                <td v-if="showHandoverOut" class="py-2 pr-3 text-xs text-muted">Vào</td>
                <td class="py-2 pr-3">
                  <input
                    v-model="getRow(meterType, 'handover_in').value"
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="0"
                    class="w-full rounded border border-dark-border bg-dark px-2 py-1 text-right text-sm text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-cyan"
                    @blur="handleSave(meterType, 'handover_in')"
                  >
                </td>
                <td class="py-2 pr-3">
                  <input
                    v-model="getRow(meterType, 'handover_in').date"
                    type="date"
                    class="w-full rounded border border-dark-border bg-dark px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan"
                    @blur="handleSave(meterType, 'handover_in')"
                  >
                </td>
                <td class="py-2 text-center">
                  <span v-if="getReadingByType(meterType, 'handover_in')" class="text-xs text-green-400">✓</span>
                </td>
              </tr>

              <!-- Handover out row (only for terminated/expired) -->
              <tr v-if="showHandoverOut">
                <td class="py-2 pr-3 text-white font-medium">{{ meterTypeLabel[meterType] }}</td>
                <td class="py-2 pr-3 text-xs text-muted">Ra</td>
                <td class="py-2 pr-3">
                  <input
                    v-model="getRow(meterType, 'handover_out').value"
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="0"
                    class="w-full rounded border border-dark-border bg-dark px-2 py-1 text-right text-sm text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-cyan"
                    @blur="handleSave(meterType, 'handover_out')"
                  >
                </td>
                <td class="py-2 pr-3">
                  <input
                    v-model="getRow(meterType, 'handover_out').date"
                    type="date"
                    class="w-full rounded border border-dark-border bg-dark px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan"
                    @blur="handleSave(meterType, 'handover_out')"
                  >
                </td>
                <td class="py-2 text-center">
                  <span v-if="getReadingByType(meterType, 'handover_out')" class="text-xs text-green-400">✓</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <p v-if="saveError" class="text-xs text-red-400 mt-2">{{ saveError }}</p>
      <p v-if="isSaving" class="text-xs text-muted mt-2">Đang lưu...</p>
    </template>
  </div>
</template>
