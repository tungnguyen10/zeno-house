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
  payment_due_day: string
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
  payment_due_day: { id: 'contract-payment-day', label: 'Ngày đến hạn riêng' },
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
    payment_due_day: data.payment_due_day ? Number(data.payment_due_day) : null,
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

const firstInvalidFieldId = computed<string | null>(() => {
  const merged: Record<string, string> = { ...localErrors.value }
  for (const [field, messages] of Object.entries(props.errors ?? {})) {
    if (messages?.length && !merged[field]) merged[field] = messages[0]!
  }
  for (const field of Object.keys(merged)) {
    if (!touched.value.has(field) && !submitAttempted.value) continue
    const id = FIELD_META[field]?.id
    if (id) return id
  }
  return null
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
    if (firstInvalidFieldId.value) {
      focusField(firstInvalidFieldId.value)
      return
    }
    emit('submit', props.modelValue)
  })
}

const draftAlertVisible = computed(() => props.hasDraft && !draftDismissed.value)

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

const canSubmit = computed(() => !props.loading && (props.isDirty || props.hasDraft || submitAttempted.value))

const selectedRoomLabel = computed(() => {
  const room = selectedRoom.value
  if (!room) return '—'
  const building = buildingMap.value[room.buildingId]
  return building ? `Phòng ${room.roomNumber} · ${building}` : `Phòng ${room.roomNumber}`
})
</script>

<template>
  <form class="space-y-6" novalidate @submit.prevent="onSubmit">
    <UiFormDraftBanner
      v-if="draftAlertVisible"
      dismissible
      :saved-at="draftSavedAt"
      :error="draftError"
      :version-mismatch="isDraftVersionMismatch"
      @restore="restoreDraft"
      @dismiss="dismissDraft"
      @clear="clearDraft"
    />

    <UiAlert v-if="apiError" severity="danger">
      {{ apiError }}
    </UiAlert>

    <UiFormSection title="Quan hệ" description="Phòng và khách thuê gắn với hợp đồng.">
      <dl v-if="relationReadonly" class="divide-y divide-ui-border" data-test="contract-relation-readonly">
        <div class="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt class="shrink-0 text-sm text-ui-muted">Phòng</dt>
          <dd class="min-w-0 text-right text-sm font-medium text-ui-primary">{{ selectedRoomLabel }}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt class="shrink-0 text-sm text-ui-muted">Khách thuê</dt>
          <dd class="min-w-0 text-right text-sm font-medium text-ui-primary">
            {{ selectedTenant?.fullName ?? '—' }}
            <span v-if="selectedTenant?.phone" class="block text-xs font-normal text-ui-muted">
              {{ selectedTenant.phone }}
            </span>
          </dd>
        </div>
      </dl>

      <div v-else class="grid gap-4 md:grid-cols-2">
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
          :disabled="loading"
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
          :disabled="loading"
          :error="errorFor('tenant_id')"
          empty-message="Không tìm thấy khách thuê nào"
          @update:model-value="onTenantSelect"
        />
      </div>

      <template v-if="relationReadonly" #footnote>
        <p class="text-xs text-ui-muted">Hợp đồng đang chạy — không thể đổi phòng hoặc khách thuê.</p>
      </template>
    </UiFormSection>

    <UiFormSection title="Thời hạn & Giá" description="Mốc hiệu lực, tiền thuê và lịch thanh toán.">
      <div class="grid gap-4 md:grid-cols-2">
        <UiDatePicker
          id="contract-start-date"
          label="Ngày bắt đầu"
          date-mode="period-start"
          :model-value="modelValue.start_date"
          :error="errorFor('start_date')"
          :disabled="loading"
          required
          @update:model-value="update('start_date', $event)"
          @blur="onBlur('start_date')"
        />

        <UiDatePicker
          id="contract-end-date"
          label="Ngày kết thúc"
          date-mode="period-end"
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
          <p v-if="selectedRoom" class="text-xs text-ui-muted">
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
          label="Ngày đến hạn riêng (1–31)"
          type="number"
          number-mode="day"
          :model-value="modelValue.payment_due_day"
          :error="errorFor('payment_due_day')"
          :disabled="loading"
          placeholder="Mặc định theo tòa nhà"
          hint="Để trống sẽ dùng ngày đến hạn của toà nhà; nếu có giá trị sẽ ưu tiên hơn cấu hình toà nhà."
          @update:model-value="update('payment_due_day', $event)"
          @blur="onBlur('payment_due_day')"
        />
      </div>
    </UiFormSection>

    <UiFormSection title="Điều khoản" description="Sức chứa, giảm giá và phụ thu cố định.">
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
    </UiFormSection>

    <UiFormSection
      v-if="showHandover"
      tone="muted"
      title="Số bàn giao đầu vào"
      description="Đọc số điện và nước tại thời điểm bàn giao phòng cho khách thuê."
    >
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
          <p v-if="previousElectricity" class="text-xs text-ui-muted">
            Số cũ: {{ previousElectricity.readingValue }} kWh (đọc {{ new Date(previousElectricity.readingDate).toLocaleDateString('vi-VN') }})
          </p>
          <p v-else-if="modelValue.room_id" class="text-xs text-ui-muted">Chưa có số trước đó cho phòng này.</p>
          <p v-if="electricityWarning" class="text-xs text-status-warning">{{ electricityWarning }}</p>
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
          <p v-if="previousWater" class="text-xs text-ui-muted">
            Số cũ: {{ previousWater.readingValue }} m3 (đọc {{ new Date(previousWater.readingDate).toLocaleDateString('vi-VN') }})
          </p>
          <p v-else-if="modelValue.room_id" class="text-xs text-ui-muted">Chưa có số trước đó cho phòng này.</p>
          <p v-if="waterWarning" class="text-xs text-status-warning">{{ waterWarning }}</p>
        </div>
      </div>

      <UiDatePicker
        id="contract-handover-date"
        label="Ngày đọc số"
        date-mode="reading"
        :model-value="modelValue.handover_reading_date"
        :error="errorFor('handover_reading_date')"
        :disabled="loading"
        @update:model-value="update('handover_reading_date', $event)"
        @blur="onBlur('handover_reading_date')"
      />
      <p class="text-xs text-ui-muted">Mặc định lấy theo ngày bắt đầu hợp đồng nếu để trống.</p>
    </UiFormSection>

    <UiFormSection title="Trạng thái &amp; Ghi chú" description="Vòng đời hợp đồng và ghi chú nội bộ.">
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
    </UiFormSection>

    <UiFormActions
      :submit-label="submitLabel"
      :cancel-label="cancelLabel"
      :mobile-submit-label="mobileSubmitLabel"
      :mobile-cancel-label="mobileCancelLabel"
      :loading="loading"
      :can-submit="canSubmit"
      @cancel="emit('cancel')"
    />
  </form>
</template>
