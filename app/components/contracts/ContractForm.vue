<script setup lang="ts">
import type { Room } from '~/types/rooms'
import type { Tenant } from '~/types/tenants'
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { ContractWithDetails } from '~/types/contracts'
import type { MeterReading } from '~/types/meter-readings'
import { formatCurrency } from '~/utils/format/currency'
import { contractCreateSchema, contractUpdateSchema } from '~/utils/validators/contracts'

export interface ContractFormData {
  room_id: string
  tenant_id: string
  start_date: string
  end_date: string
  monthly_rent: string
  deposit: string
  payment_day: string
  occupant_count: string
  discount_amount: string
  surcharge_amount: string
  status: 'active' | 'expired' | 'terminated'
  notes: string
  handover_electricity_reading: string
  handover_water_reading: string
  handover_reading_date: string
}

const props = withDefaults(defineProps<{
  modelValue: ContractFormData
  loading?: boolean
  errors?: Record<string, string[]>
  apiError?: string | null
  excludeContractId?: string
  showHandover?: boolean
  hasDraft?: boolean
  draftSavedAt?: string
  draftError?: string | null
  isDraftVersionMismatch?: boolean
  isDirty?: boolean
  submitLabel?: string
  cancelLabel?: string
  mobileSubmitLabel?: string
  mobileCancelLabel?: string
}>(), {
  loading: false,
  errors: () => ({}),
  apiError: null,
  showHandover: false,
  hasDraft: false,
  draftSavedAt: '',
  draftError: null,
  isDraftVersionMismatch: false,
  isDirty: false,
  submitLabel: 'Lưu',
  cancelLabel: 'Huỷ',
  mobileSubmitLabel: undefined,
  mobileCancelLabel: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: ContractFormData]
  'submit': [value: ContractFormData]
  'cancel': []
  'restore-draft': []
  'dismiss-draft': []
  'clear-draft': []
}>()

const { data: roomsData } = useFetch<ApiSuccess<Room[]>>('/api/rooms', {
  query: computed(() => ({ limit: 200 })),
})
const { data: buildingsData } = useFetch<ApiSuccess<Building[]>>('/api/buildings', {
  query: { limit: 100 },
})
const { data: activeContractsData } = useFetch<ApiSuccess<ContractWithDetails[]> & { meta: { total: number } }>('/api/contracts', {
  query: { status: 'active', limit: 1000 },
})

const buildingMap = computed(() => {
  const map: Record<string, string> = {}
  for (const building of buildingsData.value?.data ?? []) map[building.id] = building.name
  return map
})

const occupiedRoomIds = computed(() => {
  const contracts = activeContractsData.value?.data ?? []
  return new Set(
    contracts
      .filter(contract => contract.roomId !== props.modelValue.room_id)
      .map(contract => contract.roomId),
  )
})

const availableRooms = computed(() =>
  (roomsData.value?.data ?? []).filter(room => !occupiedRoomIds.value.has(room.id)),
)

const selectedRoom = computed(() =>
  (roomsData.value?.data ?? []).find(room => room.id === props.modelValue.room_id) ?? null,
)

const { data: tenantsData } = useFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
  query: computed(() => ({
    limit: 200,
    available: true,
    excludeContractId: props.excludeContractId || undefined,
  })),
})
const availableTenants = computed(() => tenantsData.value?.data ?? [])

const selectedTenant = computed(() =>
  availableTenants.value.find(tenant => tenant.id === props.modelValue.tenant_id) ?? null,
)

const relationReadonly = computed(() => !props.showHandover && props.modelValue.status === 'active')

function update<K extends keyof ContractFormData>(field: K, value: ContractFormData[K]) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function selectRoom(roomId: string) {
  const room = availableRooms.value.find(item => item.id === roomId)
  const updates: Partial<ContractFormData> = { room_id: roomId }
  if (room) updates.monthly_rent = String(room.monthlyRent)
  emit('update:modelValue', { ...props.modelValue, ...updates })
}

function onRoomSelect(room: Room | null) {
  if (!room) {
    update('room_id', '')
    return
  }
  selectRoom(room.id)
}

function onTenantSelect(tenant: Tenant | null) {
  update('tenant_id', tenant?.id ?? '')
}

const handoverRoomId = computed(() => props.showHandover ? props.modelValue.room_id : '')

const { data: latestReadingsData, refresh: refreshLatestReadings } = useFetch<
  ApiSuccess<{ electricity: MeterReading | null, water: MeterReading | null }>
>('/api/meter-readings/latest', {
  query: computed(() => ({ room_id: handoverRoomId.value })),
  immediate: false,
  watch: false,
})

const previousElectricity = computed(() => latestReadingsData.value?.data?.electricity ?? null)
const previousWater = computed(() => latestReadingsData.value?.data?.water ?? null)

watch(handoverRoomId, async (roomId) => {
  if (!roomId) {
    latestReadingsData.value = undefined
    return
  }
  await refreshLatestReadings()
  const updates: Partial<ContractFormData> = {}
  if (props.modelValue.handover_electricity_reading === '' && previousElectricity.value) {
    updates.handover_electricity_reading = String(previousElectricity.value.readingValue)
  }
  if (props.modelValue.handover_water_reading === '' && previousWater.value) {
    updates.handover_water_reading = String(previousWater.value.readingValue)
  }
  if (Object.keys(updates).length > 0) {
    emit('update:modelValue', { ...props.modelValue, ...updates })
  }
}, { immediate: true })

const electricityWarning = computed(() => {
  const ref = previousElectricity.value
  const current = Number(props.modelValue.handover_electricity_reading)
  if (!ref || !Number.isFinite(current) || props.modelValue.handover_electricity_reading === '') return null
  return current < ref.readingValue ? 'Số mới thấp hơn số cũ. Đồng hồ vừa được thay?' : null
})

const waterWarning = computed(() => {
  const ref = previousWater.value
  const current = Number(props.modelValue.handover_water_reading)
  if (!ref || !Number.isFinite(current) || props.modelValue.handover_water_reading === '') return null
  return current < ref.readingValue ? 'Số mới thấp hơn số cũ. Đồng hồ vừa được thay?' : null
})

interface FieldMeta { id: string, label: string }

const FIELD_META: Record<string, FieldMeta> = {
  room_id: { id: 'contract-room', label: 'Phòng' },
  tenant_id: { id: 'contract-tenant', label: 'Khách thuê' },
  start_date: { id: 'contract-start-date', label: 'Ngày bắt đầu' },
  end_date: { id: 'contract-end-date', label: 'Ngày kết thúc' },
  monthly_rent: { id: 'contract-monthly-rent', label: 'Giá thuê / tháng' },
  deposit: { id: 'contract-deposit', label: 'Tiền đặt cọc' },
  payment_day: { id: 'contract-payment-day', label: 'Ngày thanh toán' },
  occupant_count: { id: 'contract-occupant-count', label: 'Số người ở' },
  discount_amount: { id: 'contract-discount', label: 'Giảm giá' },
  surcharge_amount: { id: 'contract-surcharge', label: 'Phụ thu' },
  status: { id: 'contract-status', label: 'Trạng thái' },
  notes: { id: 'contract-notes', label: 'Ghi chú' },
  handover_electricity_reading: { id: 'contract-handover-electricity', label: 'Số điện bàn giao' },
  handover_water_reading: { id: 'contract-handover-water', label: 'Số nước bàn giao' },
  handover_reading_date: { id: 'contract-handover-date', label: 'Ngày đọc số' },
}

const touched = ref(new Set<string>())
const localErrors = ref<Record<string, string>>({})
const submitAttempted = ref(false)
const draftDismissed = ref(false)

function markTouched(field: string) {
  if (touched.value.has(field)) return
  touched.value = new Set([...touched.value, field])
}

function toPayload(data: ContractFormData) {
  return {
    room_id: data.room_id,
    tenant_id: data.tenant_id,
    start_date: data.start_date,
    end_date: data.end_date,
    monthly_rent: Number(data.monthly_rent),
    deposit: data.deposit ? Number(data.deposit) : 0,
    payment_day: data.payment_day ? Number(data.payment_day) : null,
    occupant_count: data.occupant_count ? Number(data.occupant_count) : 1,
    discount_amount: data.discount_amount ? Number(data.discount_amount) : 0,
    surcharge_amount: data.surcharge_amount ? Number(data.surcharge_amount) : 0,
    status: data.status,
    notes: data.notes || null,
    handover_electricity_reading: Number(data.handover_electricity_reading),
    handover_water_reading: Number(data.handover_water_reading),
    handover_reading_date: data.handover_reading_date || undefined,
  }
}

function setRequiredErrors(next: Record<string, string>) {
  const required = ['room_id', 'tenant_id', 'start_date', 'end_date', 'monthly_rent']
  if (props.showHandover) required.push('handover_electricity_reading', 'handover_water_reading')
  for (const field of required) {
    if (String(props.modelValue[field as keyof ContractFormData] ?? '').trim() === '') {
      next[field] = `${FIELD_META[field]?.label ?? field} là bắt buộc`
    }
  }
}

function runValidation() {
  const next: Record<string, string> = {}
  setRequiredErrors(next)

  const payload = toPayload(props.modelValue)
  const schema = props.showHandover ? contractCreateSchema : contractUpdateSchema
  const result = schema.safeParse(payload)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      if (key && !next[key]) next[key] = issue.message
    }
  }

  localErrors.value = next
}

watch(() => props.modelValue, () => {
  if (submitAttempted.value || Object.keys(localErrors.value).length > 0) runValidation()
}, { deep: true })

function onBlur(field: string) {
  markTouched(field)
  runValidation()
}

function errorFor(field: string) {
  if (!touched.value.has(field) && !submitAttempted.value) return undefined
  return localErrors.value[field] ?? props.errors?.[field]?.[0]
}

interface VisibleError extends FieldMeta { field: string, message: string }

const visibleErrors = computed<VisibleError[]>(() => {
  const merged: Record<string, string> = { ...localErrors.value }
  for (const [field, messages] of Object.entries(props.errors ?? {})) {
    if (messages?.length && !merged[field]) merged[field] = messages[0]!
  }
  return Object.entries(merged)
    .filter(([field]) => touched.value.has(field) || submitAttempted.value)
    .map(([field, message]) => ({ field, message, ...FIELD_META[field] }))
    .filter((item): item is VisibleError => Boolean(item.id))
})

function focusField(id: string) {
  if (typeof document === 'undefined') return
  const el = document.getElementById(id) as HTMLElement | null
  el?.focus?.()
  el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
}

function onSubmit() {
  submitAttempted.value = true
  runValidation()
  nextTick(() => {
    if (visibleErrors.value.length > 0) {
      focusField(visibleErrors.value[0]!.id)
      return
    }
    emit('submit', props.modelValue)
  })
}

const draftAlertVisible = computed(() => props.hasDraft && !draftDismissed.value)
const draftSavedLabel = computed(() => {
  if (!props.draftSavedAt) return ''
  return new Date(props.draftSavedAt).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

function dismissDraft() {
  draftDismissed.value = true
  emit('dismiss-draft')
}

function clearDraft() {
  draftDismissed.value = false
  emit('clear-draft')
}

function restoreDraft() {
  draftDismissed.value = false
  emit('restore-draft')
}

const submitText = computed(() => props.submitLabel)
const mobileSubmitText = computed(() => props.mobileSubmitLabel ?? props.submitLabel)
const mobileCancelText = computed(() => props.mobileCancelLabel ?? props.cancelLabel)
</script>

<template>
  <form class="space-y-6 pb-28 md:pb-0" novalidate @submit.prevent="onSubmit">
    <UiAlert v-if="draftAlertVisible" severity="info" data-test="draft-banner">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm font-medium text-white">
            {{ isDraftVersionMismatch ? 'Bản nháp cũ không tương thích — chỉ có thể xoá' : 'Có bản nháp chưa lưu' }}
          </p>
          <p v-if="draftError" class="mt-0.5 text-xs text-muted">{{ draftError }}</p>
          <p v-else-if="draftSavedLabel" class="mt-0.5 text-xs text-muted">Lưu lúc {{ draftSavedLabel }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UiButton v-if="!isDraftVersionMismatch" type="button" size="sm" variant="secondary" @click="restoreDraft">
            Khôi phục
          </UiButton>
          <UiButton v-if="!isDraftVersionMismatch" type="button" size="sm" variant="ghost" @click="dismissDraft">
            Bỏ qua
          </UiButton>
          <UiButton type="button" size="sm" variant="ghost" @click="clearDraft">
            Xoá bản nháp
          </UiButton>
        </div>
      </div>
    </UiAlert>

    <UiAlert v-if="visibleErrors.length > 0" severity="danger" data-test="error-summary" role="alert">
      <div class="space-y-2">
        <p class="text-sm font-medium text-white">Có {{ visibleErrors.length }} lỗi cần sửa</p>
        <ul class="space-y-1 text-sm">
          <li v-for="err in visibleErrors" :key="err.field">
            <UiButton unstyled class="text-left underline hover:text-white" @click="focusField(err.id)">
              {{ err.label }}: {{ err.message }}
            </UiButton>
          </li>
        </ul>
      </div>
    </UiAlert>

    <UiAlert v-if="apiError" severity="danger">
      {{ apiError }}
    </UiAlert>

    <section
      class="rounded-lg border border-dark-border bg-dark-surface p-5"
      :class="showHandover ? 'space-y-5' : 'space-y-5 border-t-2 border-t-cyan/60'"
    >
      <header v-if="!showHandover" class="flex items-start gap-3">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 text-sm font-semibold text-cyan">1</span>
        <div>
          <h3 class="text-sm font-semibold text-white">Quan hệ</h3>
          <p class="mt-0.5 text-xs text-muted">Phòng và khách thuê gắn với hợp đồng.</p>
        </div>
      </header>

      <div class="grid gap-4 md:grid-cols-2">
        <UiCombobox
          id="contract-room"
          :model-value="selectedRoom"
          :options="availableRooms"
          :option-key="room => room.id"
          :option-label="room => `Phòng ${room.roomNumber} - ${buildingMap[room.buildingId] ?? ''} (${formatCurrency(room.monthlyRent)}/tháng)`"
          label="Phòng"
          placeholder="Tìm và chọn phòng..."
          search-placeholder="Tìm số phòng hoặc tòa nhà..."
          required
          :disabled="loading || relationReadonly"
          :error="errorFor('room_id')"
          empty-message="Không tìm thấy phòng trống nào"
          @update:model-value="onRoomSelect"
        />

        <UiCombobox
          id="contract-tenant"
          :model-value="selectedTenant"
          :options="availableTenants"
          :option-key="tenant => tenant.id"
          :option-label="tenant => `${tenant.fullName} - ${tenant.phone}`"
          label="Khách thuê"
          placeholder="Tìm và chọn khách thuê..."
          search-placeholder="Tìm theo tên hoặc số điện thoại..."
          required
          :disabled="loading || relationReadonly"
          :error="errorFor('tenant_id')"
          empty-message="Không tìm thấy khách thuê nào"
          @update:model-value="onTenantSelect"
        />
      </div>

      <p v-if="relationReadonly" class="text-xs text-muted">
        Hợp đồng đang chạy — không thể đổi phòng hoặc khách thuê.
      </p>
    </section>

    <section class="rounded-lg border border-dark-border bg-dark-surface p-5 space-y-5" :class="!showHandover ? 'border-t-2 border-t-cyan/60' : ''">
      <header v-if="!showHandover" class="flex items-start gap-3">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 text-sm font-semibold text-cyan">2</span>
        <div>
          <h3 class="text-sm font-semibold text-white">Thời hạn & Giá</h3>
          <p class="mt-0.5 text-xs text-muted">Mốc hiệu lực, tiền thuê và lịch thanh toán.</p>
        </div>
      </header>

      <div class="grid gap-4 md:grid-cols-2">
        <UiInput
          id="contract-start-date"
          label="Ngày bắt đầu"
          type="date"
          :model-value="modelValue.start_date"
          :error="errorFor('start_date')"
          :disabled="loading"
          required
          @update:model-value="update('start_date', $event)"
          @blur="onBlur('start_date')"
        />

        <UiInput
          id="contract-end-date"
          label="Ngày kết thúc"
          type="date"
          :model-value="modelValue.end_date"
          :error="errorFor('end_date')"
          :disabled="loading"
          required
          @update:model-value="update('end_date', $event)"
          @blur="onBlur('end_date')"
        />

        <div class="flex flex-col gap-1">
          <UiInput
            id="contract-monthly-rent"
            label="Giá thuê / tháng (VNĐ)"
            type="number"
            number-mode="currency"
            :model-value="modelValue.monthly_rent"
            :error="errorFor('monthly_rent')"
            :disabled="loading"
            required
            placeholder="0"
            @update:model-value="update('monthly_rent', $event)"
            @blur="onBlur('monthly_rent')"
          />
          <p v-if="selectedRoom" class="text-xs text-muted">
            Mặc định lấy theo phòng ({{ formatCurrency(selectedRoom.monthlyRent) }}/tháng) — sửa nếu cần ghi đè.
          </p>
        </div>

        <UiInput
          id="contract-deposit"
          label="Tiền đặt cọc (VNĐ)"
          type="number"
          number-mode="currency"
          :model-value="modelValue.deposit"
          :error="errorFor('deposit')"
          :disabled="loading"
          placeholder="0"
          @update:model-value="update('deposit', $event)"
          @blur="onBlur('deposit')"
        />

        <UiInput
          id="contract-payment-day"
          label="Ngày thanh toán (ghi đè tòa nhà, 1-31)"
          type="number"
          number-mode="day"
          :model-value="modelValue.payment_day"
          :error="errorFor('payment_day')"
          :disabled="loading"
          placeholder="Mặc định theo tòa nhà"
          @update:model-value="update('payment_day', $event)"
          @blur="onBlur('payment_day')"
        />
      </div>
    </section>

    <section class="rounded-lg border border-dark-border bg-dark-surface p-5 space-y-5" :class="!showHandover ? 'border-t-2 border-t-cyan/60' : ''">
      <header v-if="!showHandover" class="flex items-start gap-3">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 text-sm font-semibold text-cyan">3</span>
        <div>
          <h3 class="text-sm font-semibold text-white">Điều khoản</h3>
          <p class="mt-0.5 text-xs text-muted">Sức chứa, giảm giá và phụ thu cố định.</p>
        </div>
      </header>

      <div class="grid gap-4 md:grid-cols-3">
        <UiInput
          id="contract-occupant-count"
          label="Số người ở"
          type="number"
          number-mode="integer"
          :model-value="modelValue.occupant_count"
          :error="errorFor('occupant_count')"
          :disabled="loading"
          placeholder="1"
          @update:model-value="update('occupant_count', $event)"
          @blur="onBlur('occupant_count')"
        />
        <UiInput
          id="contract-discount"
          label="Giảm giá (VNĐ)"
          type="number"
          number-mode="currency"
          :model-value="modelValue.discount_amount"
          :error="errorFor('discount_amount')"
          :disabled="loading"
          placeholder="0"
          @update:model-value="update('discount_amount', $event)"
          @blur="onBlur('discount_amount')"
        />
        <UiInput
          id="contract-surcharge"
          label="Phụ thu (VNĐ)"
          type="number"
          number-mode="currency"
          :model-value="modelValue.surcharge_amount"
          :error="errorFor('surcharge_amount')"
          :disabled="loading"
          placeholder="0"
          @update:model-value="update('surcharge_amount', $event)"
          @blur="onBlur('surcharge_amount')"
        />
      </div>
    </section>

    <section v-if="showHandover" class="space-y-4 rounded-lg border border-dark-border bg-dark-hover/30 p-5">
      <div>
        <p class="text-sm font-semibold text-white">Số bàn giao đầu vào</p>
        <p class="mt-0.5 text-xs text-muted">Đọc số điện và nước tại thời điểm bàn giao phòng cho khách thuê.</p>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="flex flex-col gap-1">
          <UiInput
            id="contract-handover-electricity"
            label="Số điện (kWh)"
            type="number"
            number-mode="meter"
            :model-value="modelValue.handover_electricity_reading"
            :error="errorFor('handover_electricity_reading')"
            :disabled="loading"
            required
            placeholder="0"
            @update:model-value="update('handover_electricity_reading', $event)"
            @blur="onBlur('handover_electricity_reading')"
          />
          <p v-if="previousElectricity" class="text-xs text-muted">
            Số cũ: {{ previousElectricity.readingValue }} kWh (đọc {{ new Date(previousElectricity.readingDate).toLocaleDateString('vi-VN') }})
          </p>
          <p v-else-if="modelValue.room_id" class="text-xs text-muted">Chưa có số trước đó cho phòng này.</p>
          <p v-if="electricityWarning" class="text-xs text-amber-400">{{ electricityWarning }}</p>
        </div>

        <div class="flex flex-col gap-1">
          <UiInput
            id="contract-handover-water"
            label="Số nước (m3)"
            type="number"
            number-mode="meter"
            :model-value="modelValue.handover_water_reading"
            :error="errorFor('handover_water_reading')"
            :disabled="loading"
            required
            placeholder="0"
            @update:model-value="update('handover_water_reading', $event)"
            @blur="onBlur('handover_water_reading')"
          />
          <p v-if="previousWater" class="text-xs text-muted">
            Số cũ: {{ previousWater.readingValue }} m3 (đọc {{ new Date(previousWater.readingDate).toLocaleDateString('vi-VN') }})
          </p>
          <p v-else-if="modelValue.room_id" class="text-xs text-muted">Chưa có số trước đó cho phòng này.</p>
          <p v-if="waterWarning" class="text-xs text-amber-400">{{ waterWarning }}</p>
        </div>
      </div>

      <UiInput
        id="contract-handover-date"
        label="Ngày đọc số"
        type="date"
        :model-value="modelValue.handover_reading_date"
        :error="errorFor('handover_reading_date')"
        :disabled="loading"
        @update:model-value="update('handover_reading_date', $event)"
        @blur="onBlur('handover_reading_date')"
      />
      <p class="text-xs text-muted">Mặc định lấy theo ngày bắt đầu hợp đồng nếu để trống.</p>
    </section>

    <section class="rounded-lg border border-dark-border bg-dark-surface p-5 space-y-5" :class="!showHandover ? 'border-t-2 border-t-cyan/60' : ''">
      <header v-if="!showHandover" class="flex items-start gap-3">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 text-sm font-semibold text-cyan">4</span>
        <div>
          <h3 class="text-sm font-semibold text-white">Trạng thái & Ghi chú</h3>
          <p class="mt-0.5 text-xs text-muted">Vòng đời hợp đồng và ghi chú nội bộ.</p>
        </div>
      </header>

      <div class="grid gap-4 md:grid-cols-2">
        <UiSelect
          id="contract-status"
          :model-value="modelValue.status"
          label="Trạng thái"
          :options="[
            { value: 'active', label: 'Đang hiệu lực' },
            { value: 'expired', label: 'Đã hết hạn' },
            { value: 'terminated', label: 'Đã chấm dứt' },
          ]"
          :disabled="loading"
          @update:model-value="update('status', String($event) as ContractFormData['status'])"
        />

        <div class="md:col-span-2">
          <UiTextarea
            id="contract-notes"
            label="Ghi chú"
            :model-value="modelValue.notes"
            :disabled="loading"
            :rows="3"
            resize="none"
            placeholder="Ghi chú hợp đồng (không bắt buộc)"
            :error="errorFor('notes')"
            @update:model-value="update('notes', $event)"
            @blur="onBlur('notes')"
          />
        </div>
      </div>
    </section>

    <div class="hidden justify-end gap-3 pt-2 md:flex">
      <UiButton type="button" variant="secondary" :disabled="loading" @click="emit('cancel')">
        {{ cancelLabel }}
      </UiButton>
      <UiButton type="submit" :loading="loading">
        {{ submitText }}
      </UiButton>
    </div>

    <div class="fixed inset-x-0 bottom-0 z-40 border-t border-dark-border bg-dark-deep/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur md:hidden">
      <div class="mx-auto flex max-w-screen-sm gap-2">
        <UiButton type="button" variant="secondary" class="flex-1" :disabled="loading" @click="emit('cancel')">
          {{ mobileCancelText }}
        </UiButton>
        <UiButton type="submit" class="flex-1" :loading="loading">
          {{ mobileSubmitText }}
        </UiButton>
      </div>
    </div>
  </form>
</template>
