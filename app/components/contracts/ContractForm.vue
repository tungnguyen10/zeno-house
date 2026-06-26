<script setup lang="ts">
import type { Room } from '~/types/rooms'
import type { Tenant } from '~/types/tenants'
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { ContractWithDetails } from '~/types/contracts'
import type { MeterReading } from '~/types/meter-readings'
import { formatCurrency } from '~/utils/format/currency'

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
}>(), {
  loading: false,
  errors: () => ({}),
  apiError: null,
  showHandover: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: ContractFormData]
  'submit': [value: ContractFormData]
  'cancel': []
}>()

// Rooms with buildings lookup
const { data: roomsData } = useFetch<ApiSuccess<Room[]>>('/api/rooms', {
  query: computed(() => ({ limit: 200 })),
})
const { data: buildingsData } = useFetch<ApiSuccess<Building[]>>('/api/buildings', {
  query: { limit: 100 },
})
// Active contracts — to exclude occupied rooms from the select
const { data: activeContractsData } = useFetch<ApiSuccess<ContractWithDetails[]> & { meta: { total: number } }>('/api/contracts', {
  query: { status: 'active', limit: 1000 },
})

const buildingMap = computed(() => {
  const map: Record<string, string> = {}
  for (const b of buildingsData.value?.data ?? []) {
    map[b.id] = b.name
  }
  return map
})

// Rooms that already have an active contract — exclude from select,
// BUT keep the currently-selected room visible (editing existing contract).
const occupiedRoomIds = computed(() => {
  const contracts = activeContractsData.value?.data ?? []
  return new Set(
    contracts
      .filter((c) => c.roomId !== props.modelValue.room_id)
      .map((c) => c.roomId),
  )
})

const availableRooms = computed(() =>
  (roomsData.value?.data ?? []).filter((r) => !occupiedRoomIds.value.has(r.id)),
)

const selectedRoom = computed(() =>
  (roomsData.value?.data ?? []).find((r) => r.id === props.modelValue.room_id) ?? null,
)

// Tenants — pre-load available tenants; UiCombobox handles client-side filtering
const { data: tenantsData } = useFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
  query: computed(() => ({
    limit: 200,
    available: true,
    excludeContractId: props.excludeContractId || undefined,
  })),
})
const availableTenants = computed(() => tenantsData.value?.data ?? [])

const selectedTenant = computed(() =>
  availableTenants.value.find((t) => t.id === props.modelValue.tenant_id) ?? null,
)

function update<K extends keyof ContractFormData>(field: K, value: ContractFormData[K]) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function selectRoom(roomId: string) {
  const room = availableRooms.value.find((r) => r.id === roomId)
  const updates: Partial<ContractFormData> = { room_id: roomId }
  // Room là nguồn giá chuẩn — luôn ghi đè giá thuê theo phòng khi đổi phòng.
  // User vẫn có thể sửa tay sau (ví dụ: giảm giá đặc biệt cho hợp đồng dài hạn).
  if (room) {
    updates.monthly_rent = String(room.monthlyRent)
  }
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

// ─── Handover meter readings (create flow only) ──────────────────────────────
const handoverRoomId = computed(() => props.showHandover ? props.modelValue.room_id : '')

const { data: latestReadingsData, refresh: refreshLatestReadings } = useFetch<
  ApiSuccess<{ electricity: MeterReading | null; water: MeterReading | null }>
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
  // Pre-fill empty inputs with the latest reading values — user can adjust.
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

function onSubmit() {
  emit('submit', props.modelValue)
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">

    <!-- Room picker -->
    <UiCombobox
      :model-value="selectedRoom"
      :options="availableRooms"
      :option-key="r => r.id"
      :option-label="r => `Phòng ${r.roomNumber} — ${buildingMap[r.buildingId] ?? ''} (${formatCurrency(r.monthlyRent)}/tháng)`"
      label="Phòng"
      placeholder="Tìm và chọn phòng..."
      search-placeholder="Tìm số phòng hoặc tòa nhà..."
      required
      :disabled="loading"
      :error="errors.room_id?.[0]"
      empty-message="Không tìm thấy phòng trống nào"
      @update:model-value="onRoomSelect"
    />

    <!-- Tenant picker -->
    <UiCombobox
      :model-value="selectedTenant"
      :options="availableTenants"
      :option-key="t => t.id"
      :option-label="t => `${t.fullName} — ${t.phone}`"
      label="Khách thuê"
      placeholder="Tìm và chọn khách thuê..."
      search-placeholder="Tìm theo tên hoặc số điện thoại..."
      required
      :disabled="loading"
      :error="errors.tenant_id?.[0]"
      empty-message="Không tìm thấy khách thuê nào"
      @update:model-value="onTenantSelect"
    />

    <!-- start_date -->
    <UiInput
      label="Ngày bắt đầu"
      type="date"
      :model-value="modelValue.start_date"
      :error="errors.start_date?.[0]"
      :disabled="loading"
      required
      @update:model-value="update('start_date', $event)"
    />

    <!-- end_date -->
    <UiInput
      label="Ngày kết thúc"
      type="date"
      :model-value="modelValue.end_date"
      :error="errors.end_date?.[0]"
      :disabled="loading"
      required
      @update:model-value="update('end_date', $event)"
    />

    <!-- monthly_rent -->
    <div class="flex flex-col gap-1">
      <UiInput
        label="Giá thuê / tháng (VNĐ)"
        type="number"
        :model-value="modelValue.monthly_rent"
        :error="errors.monthly_rent?.[0]"
        :disabled="loading"
        required
        placeholder="0"
        @update:model-value="update('monthly_rent', $event)"
      />
      <p v-if="selectedRoom" class="text-xs text-muted">
        Mặc định lấy theo phòng ({{ formatCurrency(selectedRoom.monthlyRent) }}/tháng) — sửa nếu cần ghi đè.
      </p>
    </div>

    <!-- deposit -->
    <UiInput
      label="Tiền đặt cọc (VNĐ)"
      type="number"
      :model-value="modelValue.deposit"
      :error="errors.deposit?.[0]"
      :disabled="loading"
      placeholder="0"
      @update:model-value="update('deposit', $event)"
    />

    <!-- Commercial terms -->
    <div class="grid grid-cols-3 gap-4">
      <UiInput
        label="Số người ở"
        type="number"
        :model-value="modelValue.occupant_count"
        :error="errors.occupant_count?.[0]"
        :disabled="loading"
        placeholder="1"
        @update:model-value="update('occupant_count', $event)"
      />
      <UiInput
        label="Giảm giá (VNĐ)"
        type="number"
        :model-value="modelValue.discount_amount"
        :error="errors.discount_amount?.[0]"
        :disabled="loading"
        placeholder="0"
        @update:model-value="update('discount_amount', $event)"
      />
      <UiInput
        label="Phụ thu (VNĐ)"
        type="number"
        :model-value="modelValue.surcharge_amount"
        :error="errors.surcharge_amount?.[0]"
        :disabled="loading"
        placeholder="0"
        @update:model-value="update('surcharge_amount', $event)"
      />
    </div>

    <!-- payment_day -->
    <UiInput
      label="Ngày thanh toán (ghi đè tòa nhà, 1–31)"
      type="number"
      :model-value="modelValue.payment_day"
      :error="errors.payment_day?.[0]"
      :disabled="loading"
      placeholder="Mặc định theo tòa nhà"
      @update:model-value="update('payment_day', $event)"
    />

    <!-- status -->
    <UiSelect
      :model-value="modelValue.status"
      label="Trạng thái"
      :options="[
        { value: 'active', label: 'Đang hiệu lực' },
        { value: 'expired', label: 'Đã hết hạn' },
        { value: 'terminated', label: 'Đã chấm dứt' },
      ]"
      :disabled="loading"
      @update:model-value="update('status', String($event) as 'active' | 'expired' | 'terminated')"
    />

    <!-- Handover meter readings (create only) -->
    <section v-if="showHandover" class="space-y-3 rounded-lg border border-dark-border bg-dark-hover/30 p-4">
      <div>
        <p class="text-sm font-semibold text-white">Số bàn giao đầu vào</p>
        <p class="text-xs text-muted mt-0.5">Đọc số điện và nước tại thời điểm bàn giao phòng cho khách thuê.</p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1">
          <UiInput
            label="Số điện (kWh)"
            type="number"
            :model-value="modelValue.handover_electricity_reading"
            :error="errors.handover_electricity_reading?.[0]"
            :disabled="loading"
            required
            placeholder="0"
            @update:model-value="update('handover_electricity_reading', $event)"
          />
          <p v-if="previousElectricity" class="text-xs text-muted">
            Số cũ: {{ previousElectricity.readingValue }} kWh (đọc {{ new Date(previousElectricity.readingDate).toLocaleDateString('vi-VN') }})
          </p>
          <p v-else-if="modelValue.room_id" class="text-xs text-muted">
            Chưa có số trước đó cho phòng này.
          </p>
          <p v-if="electricityWarning" class="text-xs text-amber-400">
            {{ electricityWarning }}
          </p>
        </div>

        <div class="flex flex-col gap-1">
          <UiInput
            label="Số nước (m³)"
            type="number"
            :model-value="modelValue.handover_water_reading"
            :error="errors.handover_water_reading?.[0]"
            :disabled="loading"
            required
            placeholder="0"
            @update:model-value="update('handover_water_reading', $event)"
          />
          <p v-if="previousWater" class="text-xs text-muted">
            Số cũ: {{ previousWater.readingValue }} m³ (đọc {{ new Date(previousWater.readingDate).toLocaleDateString('vi-VN') }})
          </p>
          <p v-else-if="modelValue.room_id" class="text-xs text-muted">
            Chưa có số trước đó cho phòng này.
          </p>
          <p v-if="waterWarning" class="text-xs text-amber-400">
            {{ waterWarning }}
          </p>
        </div>
      </div>

      <UiInput
        label="Ngày đọc số"
        type="date"
        :model-value="modelValue.handover_reading_date"
        :error="errors.handover_reading_date?.[0]"
        :disabled="loading"
        @update:model-value="update('handover_reading_date', $event)"
      />
      <p class="text-xs text-muted">Mặc định lấy theo ngày bắt đầu hợp đồng nếu để trống.</p>
    </section>

    <!-- notes -->
    <UiTextarea
      label="Ghi chú"
      :model-value="modelValue.notes"
      :disabled="loading"
      :rows="3"
      resize="none"
      placeholder="Ghi chú hợp đồng (không bắt buộc)"
      @update:model-value="update('notes', $event)"
    />

    <!-- API Error -->
    <UiAlert v-if="apiError" severity="danger">
      {{ apiError }}
    </UiAlert>

    <!-- Actions -->
    <div class="flex justify-end gap-3 pt-2">
      <UiButton type="button" variant="secondary" :disabled="loading" @click="emit('cancel')">
        Huỷ
      </UiButton>
      <UiButton type="submit" :loading="loading">
        Lưu
      </UiButton>
    </div>
  </form>
</template>
