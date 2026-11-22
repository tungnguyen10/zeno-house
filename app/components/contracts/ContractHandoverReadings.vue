<script setup lang="ts">
import type { ContractStatus } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import type { MeterReading } from '~/types/meter-readings'
import { formatViNumber } from '~/utils/billing/meter-display'
import { formatDateOnlyVi } from '~/utils/format/date-only'
import { formatDateTimeShort } from '~/utils/format/time'

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
  saveError,
} = useContractHandoverReadings(props.contractId, props.roomId)
const toast = useToast()

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

interface RowState { value: string; date: string; prefilled: boolean; touched: boolean }
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
      // A saved reading (e.g. checkout's handover_out) keeps its own recorded
      // date even when it differs from the contract's start/end date.
      date: existing
        ? existing.readingDate
        : readingType === 'handover_in'
          ? props.startDate
          : (props.endDate ?? new Date().toISOString().slice(0, 10)),
      prefilled: !existing && Boolean(prior) && readingType === 'handover_in',
      touched: false,
    }
  }
  return rowStates.value[key]
}

// Reset rowStates when props change OR when fetched readings update (after save)
watch(
  () => [props.startDate, props.endDate, handoverInReadings.value, handoverOutReadings.value, priorReadings.value],
  () => {
    // Rebuild rows from fresh data, but keep the user's unsaved edits.
    rowStates.value = Object.fromEntries(Object.entries(rowStates.value).filter(([key, row]) => {
      const [meterType, readingType] = key.split(':') as [MeterType, ReadingType]
      return row.touched && isDirty(meterType, readingType)
    }))
  },
)

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key))
}

type ReadingType = 'handover_in' | 'handover_out'

const rows = computed(() => METER_TYPES.flatMap(meterType =>
  (showHandoverOut.value ? ['handover_in', 'handover_out'] as const : ['handover_in'] as const)
    .map(readingType => ({ meterType, readingType, key: rowKey(meterType, readingType) })),
))

function isDirty(meterType: MeterType, readingType: ReadingType): boolean {
  const row = rowStates.value[rowKey(meterType, readingType)]
  if (!row) return false
  const existing = getReadingByType(meterType, readingType)
  if (!existing) return row.value !== ''
  return row.touched && (row.value === '' || Number(row.value) !== existing.readingValue || row.date !== existing.readingDate)
}

function isValid(meterType: MeterType, readingType: ReadingType): boolean {
  const value = getRow(meterType, readingType).value
  return value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
}

const rowErrors = ref<Record<string, string>>({})
const savingKey = ref<string | null>(null)
const pending = ref<{ meterType: MeterType, readingType: ReadingType } | null>(null)

function updateRow(meterType: MeterType, readingType: ReadingType, patch: Partial<RowState>) {
  Object.assign(getRow(meterType, readingType), patch, { touched: true })
  rowErrors.value = omit(rowErrors.value, rowKey(meterType, readingType))
}

function discard(meterType: MeterType, readingType: ReadingType) {
  const key = rowKey(meterType, readingType)
  rowStates.value = omit(rowStates.value, key)
  rowErrors.value = omit(rowErrors.value, key)
}

function periodFor(readingType: ReadingType) {
  return readingType === 'handover_in'
    ? { year: startYear.value, month: startMonth.value }
    : { year: endYear.value ?? startYear.value, month: endMonth.value ?? startMonth.value }
}

const pendingSummary = computed(() => {
  if (!pending.value) return null
  const { meterType, readingType } = pending.value
  const row = getRow(meterType, readingType)
  const existing = getReadingByType(meterType, readingType)
  const next = Number(row.value)
  const prior = readingType === 'handover_in' ? priorReadingFor(meterType) : null
  return {
    title: `Lưu số ${meterTypeLabel[meterType].toLowerCase()} ${directionLabel[readingType]}`,
    confirmLabel: readingType === 'handover_in' ? 'Lưu số bàn giao' : 'Lưu số trả phòng',
    previous: existing ? formatViNumber(existing.readingValue) : null,
    next: formatViNumber(next),
    previousDate: existing && existing.readingDate !== row.date ? formatDateOnlyVi(existing.readingDate) : null,
    date: formatDateOnlyVi(row.date),
    period: periodFor(readingType),
    lowerThanPrior: prior && next < prior.readingValue ? prior : null,
  }
})

async function confirmSave() {
  if (!pending.value) return
  const { meterType, readingType } = pending.value
  const key = rowKey(meterType, readingType)
  const row = getRow(meterType, readingType)
  const value = Number(row.value)
  const { year, month } = periodFor(readingType)
  const label = `số ${meterTypeLabel[meterType].toLowerCase()} ${directionLabel[readingType]}`

  savingKey.value = key
  const saved = await saveReadingForType(meterType, readingType, value, row.date, year, month)
  savingKey.value = null
  pending.value = null

  if (saved) {
    row.prefilled = false
    toast.success(`Đã lưu ${label}: ${formatViNumber(value)}`)
    return
  }
  const message = saveError.value ?? 'Lưu thất bại'
  rowErrors.value[key] = message
  toast.error(`Chưa lưu được ${label}. ${message}`)
}

const meterTypeLabel: Record<MeterType, string> = { electricity: 'Điện', water: 'Nước' }
const meterUnit: Record<MeterType, string> = { electricity: 'kWh', water: 'm³' }
const directionLabel: Record<ReadingType, string> = { handover_in: 'bàn giao', handover_out: 'trả phòng' }
</script>

<template>
  <div>
    <div v-if="isLoading" class="grid gap-3 sm:grid-cols-2">
      <UiSkeleton class="h-24 w-full rounded-lg" />
      <UiSkeleton class="h-24 w-full rounded-lg" />
    </div>

    <ul v-else class="grid items-start gap-3 sm:grid-cols-2">
      <li
        v-for="{ meterType, readingType, key } in rows"
        :key="key"
        class="rounded-lg bg-ui-deep/30 p-3 ring-1 transition-shadow"
        :class="isDirty(meterType, readingType) ? 'ring-status-warning/40' : 'ring-ui-border'"
      >
        <div class="mb-2 flex items-baseline justify-between gap-3">
          <p class="text-sm font-medium text-ui-primary">
            {{ meterTypeLabel[meterType] }}<span v-if="showHandoverOut" class="font-normal text-ui-muted"> · {{ readingType === 'handover_in' ? 'vào' : 'ra' }}</span>
          </p>
          <p v-if="isDirty(meterType, readingType)" class="text-xs font-medium text-status-warning">Chưa lưu</p>
          <p v-else-if="getReadingByType(meterType, readingType)" class="whitespace-nowrap text-xs text-ui-muted tabular-nums">
            Đã lưu {{ formatDateTimeShort(getReadingByType(meterType, readingType)!.updatedAt) }}
          </p>
          <p v-else class="text-xs text-ui-muted">Chưa có số</p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UiInput
            density="compact"
            type="number"
            number-mode="meter"
            input-class="min-h-7"
            :aria-label="`Số ${meterTypeLabel[meterType].toLowerCase()} ${directionLabel[readingType]}`"
            :model-value="getRow(meterType, readingType).value"
            :error="rowErrors[key]"
            :disabled="savingKey === key"
            placeholder="0"
            @update:model-value="(v) => updateRow(meterType, readingType, { value: String(v ?? '') })"
          >
            <template #suffix>{{ meterUnit[meterType] }}</template>
          </UiInput>
          <UiDatePicker
            density="compact"
            date-mode="reading"
            :aria-label="`Ngày đọc số ${meterTypeLabel[meterType].toLowerCase()}`"
            :disabled="savingKey === key"
            :model-value="getRow(meterType, readingType).date"
            @update:model-value="(v) => updateRow(meterType, readingType, { date: String(v) })"
          />
        </div>
        <p
          v-if="readingType === 'handover_in' && getRow(meterType, readingType).prefilled && priorReadingFor(meterType)"
          class="mt-1.5 text-xs text-ui-muted"
        >
          Lấy từ số chốt {{ priorReadingFor(meterType)!.periodMonth }}/{{ priorReadingFor(meterType)!.periodYear }}, kiểm tra trước khi lưu.
        </p>
        <div v-if="isDirty(meterType, readingType)" class="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <UiButton size="sm" variant="ghost" class="min-h-9 sm:min-h-0" :disabled="savingKey === key" @click="discard(meterType, readingType)">Huỷ</UiButton>
          <UiButton
            size="sm"
            class="min-h-9 sm:min-h-0"
            :loading="savingKey === key"
            :disabled="!isValid(meterType, readingType)"
            @click="pending = { meterType, readingType }"
          >
            Lưu
          </UiButton>
        </div>
      </li>
    </ul>

    <UiModal :open="!!pendingSummary" :title="pendingSummary?.title" size="sm" @close="savingKey ? undefined : (pending = null)">
      <div v-if="pendingSummary" class="space-y-3">
        <div class="rounded-lg border border-ui-border bg-ui-surface px-4 py-3">
          <p class="flex flex-wrap items-baseline gap-x-2 tabular-nums">
            <span :class="pendingSummary.previous ? 'text-ui-muted line-through' : 'text-ui-muted text-sm'">
              {{ pendingSummary.previous ?? 'Chưa có' }}
            </span>
            <span class="text-ui-muted" aria-hidden="true">→</span>
            <span class="sr-only">thành</span>
            <span class="text-lg font-semibold text-ui-primary">{{ pendingSummary.next }}</span>
          </p>
          <p class="mt-1 text-xs text-ui-muted tabular-nums">
            Ngày đọc
            <template v-if="pendingSummary.previousDate">{{ pendingSummary.previousDate }} → </template>{{ pendingSummary.date }}
          </p>
        </div>
        <p v-if="pending?.readingType === 'handover_in'" class="text-sm text-ui-muted">
          Kỳ {{ pendingSummary.period.month }}/{{ pendingSummary.period.year }} dùng số này làm chỉ số kỳ trước khi tính hoá đơn. Hoá đơn đã phát hành không tự thay đổi.
        </p>
        <UiAlert v-if="pendingSummary.lowerThanPrior" severity="warning">
          Thấp hơn số chốt {{ pendingSummary.lowerThanPrior.periodMonth }}/{{ pendingSummary.lowerThanPrior.periodYear }}
          ({{ formatViNumber(pendingSummary.lowerThanPrior.readingValue) }}) — chỉ đúng khi đã thay đồng hồ.
        </UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="!!savingKey" @click="pending = null">Quay lại</UiButton>
        <UiButton :loading="!!savingKey" data-autofocus @click="confirmSave">
          {{ pendingSummary?.confirmLabel }}
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>
