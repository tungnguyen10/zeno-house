<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BillingDraftGridRow } from '~/types/billing'
import type { UtilityUsageOverrideInput } from '~/utils/validators/billing'

type MeterType = 'electricity' | 'water'
type OverrideReason = 'normal' | 'replacement' | 'reset' | 'correction' | 'manual_adjustment'

interface MeterFormState {
  enabled: boolean
  previousReadingId: string | null
  previousValue: string
  currentReadingId: string | null
  currentValue: string
  oldMeterFinal: string
  newMeterStart: string
  billableUsage: string
  reason: OverrideReason
  note: string
}

const props = defineProps<{
  open: boolean
  row: BillingDraftGridRow | null
  initialType?: MeterType | null
  onSaveOverride: (input: UtilityUsageOverrideInput) => Promise<void>
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const overrideElectricity = ref<MeterFormState>(emptyMeterForm())
const overrideWater = ref<MeterFormState>(emptyMeterForm())
const overrideError = ref<string | null>(null)
const overrideSaving = ref(false)

const electricityRequired = computed(() => !!props.row?.electricity?.required)
const waterRequired = computed(() => !!props.row?.water?.required)

function emptyMeterForm(): MeterFormState {
  return {
    enabled: false,
    previousReadingId: null,
    previousValue: '',
    currentReadingId: null,
    currentValue: '',
    oldMeterFinal: '',
    newMeterStart: '',
    billableUsage: '',
    reason: 'replacement',
    note: '',
  }
}

function populateMeterForm(row: BillingDraftGridRow, type: MeterType): MeterFormState {
  const cell = type === 'electricity' ? row.electricity : row.water
  const form = emptyMeterForm()
  if (!cell) return form
  form.previousReadingId = cell.previousReadingId
  form.previousValue = cell.previousValue !== null ? String(cell.previousValue) : ''
  form.currentReadingId = cell.currentReadingId
  form.currentValue = cell.currentValue !== null ? String(cell.currentValue) : ''
  form.billableUsage = cell.usage !== null ? String(Math.max(cell.usage, 0)) : ''
  return form
}

function loadForms(row: BillingDraftGridRow | null, type?: MeterType | null) {
  if (!row) {
    overrideElectricity.value = emptyMeterForm()
    overrideWater.value = emptyMeterForm()
    overrideError.value = null
    return
  }
  const hasElec = !!row.electricity?.required
  const hasWater = !!row.water?.required
  if (hasElec) {
    overrideElectricity.value = populateMeterForm(row, 'electricity')
    overrideElectricity.value.enabled = type ? type === 'electricity' : !hasWater || true
  } else {
    overrideElectricity.value = emptyMeterForm()
  }
  if (hasWater) {
    overrideWater.value = populateMeterForm(row, 'water')
    overrideWater.value.enabled = type ? type === 'water' : !hasElec || true
  } else {
    overrideWater.value = emptyMeterForm()
  }
  if (type === 'electricity') overrideWater.value.enabled = false
  if (type === 'water') overrideElectricity.value.enabled = false
  if (!type) {
    if (hasElec) overrideElectricity.value.enabled = true
    if (hasWater) overrideWater.value.enabled = true
  }
  overrideError.value = null
}

watch(
  () => [props.open, props.row, props.initialType] as const,
  ([open, row, initialType]) => {
    if (open) loadForms(row, initialType)
  },
  { immediate: true },
)

function toNum(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

interface BillableResult { value: number | null; missing: string[] }

function computeBillable(form: MeterFormState): BillableResult {
  const prev = toNum(form.previousValue)
  const curr = toNum(form.currentValue)
  const oldFinal = toNum(form.oldMeterFinal)
  const newStart = toNum(form.newMeterStart)
  const reason = form.reason
  const missing: string[] = []

  if (reason === 'manual_adjustment') return { value: null, missing: [] }

  if (prev === null) missing.push('Chỉ số kỳ trước')
  if (curr === null) missing.push('Chỉ số kỳ này')

  if (reason === 'replacement') {
    if (oldFinal === null) missing.push('Số cuối đồng hồ cũ')
    if (newStart === null) missing.push('Số đầu đồng hồ mới')
    if (missing.length > 0) return { value: null, missing }
    return { value: (oldFinal! - prev!) + (curr! - newStart!), missing: [] }
  }
  if (reason === 'reset') {
    if (oldFinal === null) missing.push('Số cuối đồng hồ cũ (trước khi nhảy về 0)')
    if (missing.length > 0) return { value: null, missing }
    return { value: (oldFinal! - prev!) + curr!, missing: [] }
  }
  if (missing.length > 0) return { value: null, missing }
  return { value: curr! - prev!, missing: [] }
}

const electricityBillable = computed(() => computeBillable(overrideElectricity.value))
const waterBillable = computed(() => computeBillable(overrideWater.value))

watch(electricityBillable, (next) => {
  const form = overrideElectricity.value
  if (form.reason === 'manual_adjustment') return
  form.billableUsage = next.value !== null ? String(next.value) : ''
})

watch(waterBillable, (next) => {
  const form = overrideWater.value
  if (form.reason === 'manual_adjustment') return
  form.billableUsage = next.value !== null ? String(next.value) : ''
})

watch(() => overrideElectricity.value.reason, (reason, previous) => {
  const form = overrideElectricity.value
  if (reason !== 'replacement' && reason !== 'reset') form.oldMeterFinal = ''
  if (reason !== 'replacement') form.newMeterStart = ''
  if (reason === 'manual_adjustment') return
  if (previous === 'manual_adjustment') {
    const next = electricityBillable.value
    form.billableUsage = next.value !== null ? String(next.value) : ''
  }
})

watch(() => overrideWater.value.reason, (reason, previous) => {
  const form = overrideWater.value
  if (reason !== 'replacement' && reason !== 'reset') form.oldMeterFinal = ''
  if (reason !== 'replacement') form.newMeterStart = ''
  if (reason === 'manual_adjustment') return
  if (previous === 'manual_adjustment') {
    const next = waterBillable.value
    form.billableUsage = next.value !== null ? String(next.value) : ''
  }
})

function closeOverrideModal() {
  emit('close')
}

function validateForm(form: MeterFormState, label: string): string | null {
  const billable = Number(form.billableUsage)
  const prev = Number(form.previousValue)
  const curr = Number(form.currentValue)
  if (!Number.isFinite(billable) || billable < 0) return `${label}: tiêu thụ tính tiền phải >= 0`
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return `${label}: giá trị chỉ số không hợp lệ`
  if (form.reason !== 'normal' && form.note.trim().length === 0) return `${label}: cần ghi rõ lý do điều chỉnh`
  return null
}

function buildOverridePayload(row: BillingDraftGridRow, form: MeterFormState, type: MeterType): UtilityUsageOverrideInput {
  const oldFinal = form.oldMeterFinal.trim()
  const newStart = form.newMeterStart.trim()
  return {
    room_id: row.roomId,
    meter_type: type,
    previous_reading_id: form.previousReadingId,
    previous_reading_value: Number(form.previousValue),
    current_reading_id: form.currentReadingId,
    current_reading_value: Number(form.currentValue),
    old_meter_final_value: oldFinal === '' ? null : Number(oldFinal),
    new_meter_start_value: newStart === '' ? null : Number(newStart),
    billable_usage: Number(form.billableUsage),
    reason: form.reason,
    note: form.note.trim() === '' ? null : form.note.trim(),
  }
}

async function submitOverride() {
  if (!props.row) return
  const elec = overrideElectricity.value
  const water = overrideWater.value
  const tasks: Array<{ payload: UtilityUsageOverrideInput }> = []

  if (electricityRequired.value && elec.enabled) {
    const err = validateForm(elec, 'Điện')
    if (err) { overrideError.value = err; return }
    tasks.push({ payload: buildOverridePayload(props.row, elec, 'electricity') })
  }
  if (waterRequired.value && water.enabled) {
    const err = validateForm(water, 'Nước')
    if (err) { overrideError.value = err; return }
    tasks.push({ payload: buildOverridePayload(props.row, water, 'water') })
  }
  if (tasks.length === 0) {
    overrideError.value = 'Hãy bật ít nhất một loại đồng hồ để điều chỉnh'
    return
  }

  overrideError.value = null
  overrideSaving.value = true
  try {
    for (const task of tasks) {
      await props.onSaveOverride(task.payload)
    }
    closeOverrideModal()
  }
  catch (error) {
    overrideError.value = error instanceof Error ? error.message : 'Lưu thất bại'
  }
  finally {
    overrideSaving.value = false
  }
}
</script>

<template>
  <UiModal :open="open" title="Điều chỉnh chỉ số" size="lg" @close="closeOverrideModal">
    <div v-if="row" class="space-y-4">
      <p class="text-sm text-muted">
        Phòng <span class="font-semibold text-white">P{{ row.roomNumber ?? '—' }}</span>
        <span v-if="row.tenantName"> · {{ row.tenantName }}</span>
      </p>

      <p v-if="electricityRequired && waterRequired" class="text-xs text-muted">
        Có thể bật cùng lúc cả hai loại đồng hồ để điều chỉnh trong một thao tác.
      </p>

      <div
        v-if="electricityRequired"
        class="rounded-lg border border-dark-border bg-dark-surface p-3 space-y-3"
      >
        <UiCheckbox
          :model-value="overrideElectricity.enabled"
          label="Điều chỉnh đồng hồ điện"
          @update:model-value="overrideElectricity.enabled = $event"
        />

        <template v-if="overrideElectricity.enabled">
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted">Chỉ số kỳ trước</label>
              <UiInput v-model="overrideElectricity.previousValue" type="number" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted">Chỉ số kỳ này</label>
              <UiInput v-model="overrideElectricity.currentValue" type="number" />
            </div>
            <div
              v-if="overrideElectricity.reason === 'replacement' || overrideElectricity.reason === 'reset'"
              class="flex flex-col gap-1"
            >
              <label class="text-xs text-muted">
                {{ overrideElectricity.reason === 'reset' ? 'Số cuối trước khi nhảy về 0' : 'Số cuối đồng hồ cũ' }}
              </label>
              <UiInput v-model="overrideElectricity.oldMeterFinal" type="number" />
            </div>
            <div
              v-if="overrideElectricity.reason === 'replacement'"
              class="flex flex-col gap-1"
            >
              <label class="text-xs text-muted">Số đầu đồng hồ mới</label>
              <UiInput v-model="overrideElectricity.newMeterStart" type="number" />
            </div>
            <div class="flex flex-col gap-1 col-span-2">
              <label class="text-xs text-muted">
                Tiêu thụ tính tiền (kWh)
                <span v-if="overrideElectricity.reason !== 'manual_adjustment'" class="text-muted">(tự tính)</span>
              </label>
              <UiInput
                v-model="overrideElectricity.billableUsage"
                type="number"
                :disabled="overrideElectricity.reason !== 'manual_adjustment'"
              />
              <p v-if="overrideElectricity.reason !== 'manual_adjustment' && electricityBillable.missing.length > 0" class="text-xs text-warning">
                Cần điền: {{ electricityBillable.missing.join(', ') }}
              </p>
              <p v-else-if="overrideElectricity.reason !== 'manual_adjustment' && electricityBillable.value !== null && electricityBillable.value < 0" class="text-xs text-error-vivid">
                Kết quả âm ({{ electricityBillable.value }}) — kiểm tra lại các chỉ số.
              </p>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted">Lý do</label>
              <UiSelect
                v-model="overrideElectricity.reason"
                :options="[
                  { value: 'replacement', label: 'Thay đồng hồ' },
                  { value: 'reset', label: 'Đồng hồ nhảy về 0' },
                  { value: 'correction', label: 'Đính chính chỉ số sai' },
                  { value: 'manual_adjustment', label: 'Điều chỉnh thủ công' },
                  { value: 'normal', label: 'Bình thường' },
                ]"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted">Ghi chú</label>
              <UiInput v-model="overrideElectricity.note" />
            </div>
          </div>
        </template>
      </div>

      <div
        v-if="waterRequired"
        class="rounded-lg border border-dark-border bg-dark-surface p-3 space-y-3"
      >
        <UiCheckbox
          :model-value="overrideWater.enabled"
          label="Điều chỉnh đồng hồ nước"
          @update:model-value="overrideWater.enabled = $event"
        />
        <template v-if="overrideWater.enabled">
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted">Chỉ số kỳ trước</label>
              <UiInput v-model="overrideWater.previousValue" type="number" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted">Chỉ số kỳ này</label>
              <UiInput v-model="overrideWater.currentValue" type="number" />
            </div>
            <div
              v-if="overrideWater.reason === 'replacement' || overrideWater.reason === 'reset'"
              class="flex flex-col gap-1"
            >
              <label class="text-xs text-muted">
                {{ overrideWater.reason === 'reset' ? 'Số cuối trước khi nhảy về 0' : 'Số cuối đồng hồ cũ' }}
              </label>
              <UiInput v-model="overrideWater.oldMeterFinal" type="number" />
            </div>
            <div
              v-if="overrideWater.reason === 'replacement'"
              class="flex flex-col gap-1"
            >
              <label class="text-xs text-muted">Số đầu đồng hồ mới</label>
              <UiInput v-model="overrideWater.newMeterStart" type="number" />
            </div>
            <div class="flex flex-col gap-1 col-span-2">
              <label class="text-xs text-muted">
                Tiêu thụ tính tiền (m³)
                <span v-if="overrideWater.reason !== 'manual_adjustment'" class="text-muted">(tự tính)</span>
              </label>
              <UiInput
                v-model="overrideWater.billableUsage"
                type="number"
                :disabled="overrideWater.reason !== 'manual_adjustment'"
              />
              <p v-if="overrideWater.reason !== 'manual_adjustment' && waterBillable.missing.length > 0" class="text-xs text-warning">
                Cần điền: {{ waterBillable.missing.join(', ') }}
              </p>
              <p v-else-if="overrideWater.reason !== 'manual_adjustment' && waterBillable.value !== null && waterBillable.value < 0" class="text-xs text-error-vivid">
                Kết quả âm ({{ waterBillable.value }}) — kiểm tra lại các chỉ số.
              </p>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted">Lý do</label>
              <UiSelect
                v-model="overrideWater.reason"
                :options="[
                  { value: 'replacement', label: 'Thay đồng hồ' },
                  { value: 'reset', label: 'Đồng hồ nhảy về 0' },
                  { value: 'correction', label: 'Đính chính chỉ số sai' },
                  { value: 'manual_adjustment', label: 'Điều chỉnh thủ công' },
                  { value: 'normal', label: 'Bình thường' },
                ]"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted">Ghi chú</label>
              <UiInput v-model="overrideWater.note" />
            </div>
          </div>
        </template>
      </div>

      <UiAlert v-if="overrideError" severity="danger" :title="'Lỗi'">
        {{ overrideError }}
      </UiAlert>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="closeOverrideModal">Huỷ</UiButton>
      <UiButton variant="primary" :disabled="overrideSaving" @click="submitOverride">
        {{ overrideSaving ? 'Đang lưu...' : 'Lưu điều chỉnh' }}
      </UiButton>
    </template>
  </UiModal>
</template>
