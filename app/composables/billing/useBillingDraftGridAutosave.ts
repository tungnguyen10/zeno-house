import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { BillingDraftGridResponse, BillingDraftGridRow, BillingPeriod } from '~/types/billing'
import type { MeterReadingBulkInput } from '~/utils/validators/meter-readings'

type MeterType = 'electricity' | 'water'
export type BillingDraftGridRowSaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface BillingDraftGridAutosaveOptions {
  response: ComputedRef<BillingDraftGridResponse | null>
  period: ComputedRef<BillingPeriod | null>
  periodEditable: ComputedRef<boolean>
  batchReadingDate: Ref<string>
  onSaveReadings: (
    readings: MeterReadingBulkInput['readings'],
    options?: { refresh?: boolean; silent?: boolean; refreshDrafts?: boolean },
  ) => Promise<void>
}

const AUTO_SAVE_DEBOUNCE_MS = 800
const SAVED_FLASH_MS = 1500

function cellKey(row: BillingDraftGridRow, type: MeterType): string {
  return `${row.roomId}::${type}`
}

export function useBillingDraftGridAutosave(options: BillingDraftGridAutosaveOptions) {
  const localReadings = ref<Record<string, string>>({})
  const savedReadings = ref<Record<string, string>>({})
  const effectiveReadings = computed(() => ({ ...savedReadings.value, ...localReadings.value }))
  const isSaving = ref(false)
  const rowSaveState = ref<Record<string, BillingDraftGridRowSaveState>>({})
  const rowSaveError = ref<Record<string, string>>({})
  const rowSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {}
  const rowSavedFlash: Record<string, ReturnType<typeof setTimeout>> = {}

  onBeforeUnmount(() => {
    for (const timer of Object.values(rowSaveTimers)) clearTimeout(timer)
    for (const timer of Object.values(rowSavedFlash)) clearTimeout(timer)
  })

  watch(
    options.response,
    () => {
      localReadings.value = {}
      savedReadings.value = {}
    },
  )

  function readingDraftValue(row: BillingDraftGridRow, type: MeterType): string {
    const key = cellKey(row, type)
    const local = localReadings.value[key]
    if (local !== undefined) return local
    const saved = savedReadings.value[key]
    if (saved !== undefined) return saved
    const cell = type === 'electricity' ? row.electricity : row.water
    if (!cell) return ''
    return cell.currentValue !== null ? String(cell.currentValue) : ''
  }

  function setReadingDraftValue(row: BillingDraftGridRow, type: MeterType, value: string) {
    localReadings.value[cellKey(row, type)] = value
    scheduleRowSave(row)
  }

  function scheduleRowSave(row: BillingDraftGridRow) {
    if (!options.periodEditable.value || !row.editable) return
    const existing = rowSaveTimers[row.roomId]
    if (existing) clearTimeout(existing)
    if (rowSaveState.value[row.roomId] === 'saved' || rowSaveState.value[row.roomId] === 'error') {
      rowSaveState.value[row.roomId] = 'idle'
      Reflect.deleteProperty(rowSaveError.value, row.roomId)
    }
    rowSaveTimers[row.roomId] = setTimeout(() => {
      void saveRow(row)
    }, AUTO_SAVE_DEBOUNCE_MS)
  }

  function isCellDirty(row: BillingDraftGridRow, type: MeterType): boolean {
    const key = cellKey(row, type)
    if (!(key in localReadings.value)) return false
    const local = localReadings.value[key]
    const cell = type === 'electricity' ? row.electricity : row.water
    if (!cell) return local !== ''
    const stored = cell.currentValue !== null ? String(cell.currentValue) : ''
    return (local ?? '') !== stored
  }

  function buildRowReadingsPayload(row: BillingDraftGridRow): MeterReadingBulkInput['readings'] {
    if (!options.period.value) return []
    if (!options.batchReadingDate.value) return []
    const out: MeterReadingBulkInput['readings'] = []
    for (const type of ['electricity', 'water'] as MeterType[]) {
      if (!isCellDirty(row, type)) continue
      const cell = type === 'electricity' ? row.electricity : row.water
      if (!cell) continue
      const localValue = localReadings.value[cellKey(row, type)] ?? ''
      const trimmed = localValue.trim()
      if (trimmed === '') continue
      const numeric = Number(trimmed)
      if (!Number.isFinite(numeric)) continue
      out.push({
        room_id: row.roomId,
        meter_type: type,
        period_year: options.period.value.periodYear,
        period_month: options.period.value.periodMonth,
        reading_type: 'monthly',
        reading_date: cell.readingDate ?? options.batchReadingDate.value,
        reading_value: numeric,
      })
    }
    return out
  }

  async function saveRow(row: BillingDraftGridRow) {
    Reflect.deleteProperty(rowSaveTimers, row.roomId)
    const payload = buildRowReadingsPayload(row)
    if (payload.length === 0) {
      rowSaveState.value[row.roomId] = 'idle'
      return
    }
    rowSaveState.value[row.roomId] = 'saving'
    Reflect.deleteProperty(rowSaveError.value, row.roomId)
    try {
      await options.onSaveReadings(payload, { refresh: false, refreshDrafts: false, silent: true })
      for (const item of payload) {
        const key = `${item.room_id}::${item.meter_type}`
        savedReadings.value[key] = String(item.reading_value)
        Reflect.deleteProperty(localReadings.value, key)
      }
      rowSaveState.value[row.roomId] = 'saved'
      if (rowSavedFlash[row.roomId]) clearTimeout(rowSavedFlash[row.roomId])
      rowSavedFlash[row.roomId] = setTimeout(() => {
        if (rowSaveState.value[row.roomId] === 'saved') {
          rowSaveState.value[row.roomId] = 'idle'
        }
      }, SAVED_FLASH_MS)
    }
    catch (err) {
      rowSaveState.value[row.roomId] = 'error'
      rowSaveError.value[row.roomId] = err instanceof Error ? err.message : 'Lưu thất bại'
    }
  }

  async function saveAll() {
    if (!options.periodEditable.value) return
    if (!options.period.value) return
    if (!options.batchReadingDate.value) return
    const payload: MeterReadingBulkInput['readings'] = []
    for (const row of options.response.value?.rows ?? []) {
      if (!row.editable) continue
      payload.push(...buildRowReadingsPayload(row))
    }
    if (payload.length === 0) return
    isSaving.value = true
    try {
      await options.onSaveReadings(payload, { refresh: false, refreshDrafts: false })
      for (const item of payload) {
        const key = `${item.room_id}::${item.meter_type}`
        savedReadings.value[key] = String(item.reading_value)
      }
      localReadings.value = {}
    }
    finally {
      isSaving.value = false
    }
  }

  function rowSaveStateOf(row: BillingDraftGridRow): BillingDraftGridRowSaveState {
    return rowSaveState.value[row.roomId] ?? 'idle'
  }

  const dirtyCountValue = computed(() => {
    let count = 0
    for (const row of options.response.value?.rows ?? []) {
      if (isCellDirty(row, 'electricity')) count += 1
      if (isCellDirty(row, 'water')) count += 1
    }
    return count
  })

  return {
    localReadings,
    savedReadings,
    effectiveReadings,
    isSaving,
    rowSaveState,
    rowSaveError,
    readingDraftValue,
    setReadingDraftValue,
    scheduleRowSave,
    buildRowReadingsPayload,
    saveRow,
    saveAll,
    rowSaveStateOf,
    isCellDirty,
    dirtyCountValue,
  }
}
