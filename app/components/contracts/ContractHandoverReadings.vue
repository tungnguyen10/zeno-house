<script setup lang="ts">
import type { ContractStatus } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import type { MeterReading } from '~/types/meter-readings'

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

// Latest reading from BEFORE this contract started — used to pre-fill the
// handover_in inputs when the contract has no explicit handover row yet
// (e.g. legacy contracts created before the create-time handover requirement).
const { data: priorReadingsData } = useFetch<
  ApiSuccess<{ electricity: MeterReading | null; water: MeterReading | null }>
>('/api/meter-readings/latest', {
  query: { room_id: props.roomId, before_date: props.startDate },
})
const priorReadings = computed(() => priorReadingsData.value?.data ?? null)

function priorReadingFor(meterType: MeterType): MeterReading | null {
  return priorReadings.value?.[meterType] ?? null
}

interface RowState { value: string; date: string; prefilled: boolean }
const rowStates = ref<Record<string, RowState>>({})

function rowKey(meterType: MeterType, readingType: 'handover_in' | 'handover_out') {
  return `${meterType}:${readingType}`
}

function getRow(meterType: MeterType, readingType: 'handover_in' | 'handover_out'): RowState {
  const key = rowKey(meterType, readingType)
  if (!rowStates.value[key]) {
    const existing = getReadingByType(meterType, readingType)
    const prior = readingType === 'handover_in' ? priorReadingFor(meterType) : null
    const initialValue = existing
      ? String(existing.readingValue)
      : prior
        ? String(prior.readingValue)
        : ''
    rowStates.value[key] = {
      value: initialValue,
      date: readingType === 'handover_in'
        ? props.startDate
        : (props.endDate ?? new Date().toISOString().slice(0, 10)),
      prefilled: !existing && Boolean(prior) && readingType === 'handover_in',
    }
  }
  return rowStates.value[key]
}

// Reset rowStates when props change OR when fetched readings update (after save)
watch(
  () => [props.startDate, props.endDate, handoverInReadings.value, handoverOutReadings.value, priorReadings.value],
  () => { rowStates.value = {} },
)

async function handleSave(meterType: MeterType, readingType: 'handover_in' | 'handover_out') {
  const row = getRow(meterType, readingType)
  if (!row.value || row.value === '') return
  row.prefilled = false
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

    <!-- Note: raw <table> is kept here because the direction column is conditional
         (showHandoverOut) and the per-meterType row grouping cannot be cleanly
         represented with UiTable's column-based model. Cell controls use primitives. -->
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
                  <UiInput
                    density="compact"
                    type="number"
                    :model-value="getRow(meterType, 'handover_in').value"
                    placeholder="0"
                    @update:model-value="(v) => { getRow(meterType, 'handover_in').value = String(v); handleSave(meterType, 'handover_in') }"
                  />
                  <p
                    v-if="getRow(meterType, 'handover_in').prefilled && priorReadingFor(meterType)"
                    class="mt-1 text-[10px] text-muted leading-tight"
                  >
                    Lấy tự động từ số chốt kỳ {{ priorReadingFor(meterType)!.periodMonth }}/{{ priorReadingFor(meterType)!.periodYear }} — chỉnh nếu sai.
                  </p>
                </td>
                <td class="py-2 pr-3">
                  <UiInput
                    density="compact"
                    type="date"
                    :model-value="getRow(meterType, 'handover_in').date"
                    @update:model-value="(v) => { getRow(meterType, 'handover_in').date = String(v); handleSave(meterType, 'handover_in') }"
                  />
                </td>
                <td class="py-2 text-center">
                  <span v-if="getReadingByType(meterType, 'handover_in')" class="text-xs text-success-neon">✓</span>
                </td>
              </tr>

              <!-- Handover out row (only for terminated/expired) -->
              <tr v-if="showHandoverOut">
                <td class="py-2 pr-3 text-white font-medium">{{ meterTypeLabel[meterType] }}</td>
                <td class="py-2 pr-3 text-xs text-muted">Ra</td>
                <td class="py-2 pr-3">
                  <UiInput
                    density="compact"
                    type="number"
                    :model-value="getRow(meterType, 'handover_out').value"
                    placeholder="0"
                    @update:model-value="(v) => { getRow(meterType, 'handover_out').value = String(v); handleSave(meterType, 'handover_out') }"
                  />
                </td>
                <td class="py-2 pr-3">
                  <UiInput
                    density="compact"
                    type="date"
                    :model-value="getRow(meterType, 'handover_out').date"
                    @update:model-value="(v) => { getRow(meterType, 'handover_out').date = String(v); handleSave(meterType, 'handover_out') }"
                  />
                </td>
                <td class="py-2 text-center">
                  <span v-if="getReadingByType(meterType, 'handover_out')" class="text-xs text-success-neon">✓</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <UiAlert v-if="saveError" severity="danger" class="mt-2">{{ saveError }}</UiAlert>
      <p v-if="isSaving" class="text-xs text-muted mt-2">Đang lưu...</p>
    </template>
  </div>
</template>
