<script setup lang="ts">
import type { Room } from '~/types/rooms'
import type { Tenant } from '~/types/tenants'
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { ContractWithDetails } from '~/types/contracts'
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
}

const props = withDefaults(defineProps<{
  modelValue: ContractFormData
  loading?: boolean
  errors?: Record<string, string[]>
  apiError?: string | null
  excludeContractId?: string
}>(), {
  loading: false,
  errors: () => ({}),
  apiError: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: ContractFormData]
  'submit': [value: ContractFormData]
  'cancel': []
}>()

// Rooms with buildings lookup
const roomSearch = ref('')
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

const filteredRooms = computed(() => {
  const q = roomSearch.value.trim().toLowerCase()
  if (!q) return availableRooms.value
  return availableRooms.value.filter((r) => {
    const buildingName = buildingMap.value[r.buildingId] ?? ''
    return (
      r.roomNumber.toLowerCase().includes(q) ||
      buildingName.toLowerCase().includes(q)
    )
  })
})

const selectedRoom = computed(() =>
  (roomsData.value?.data ?? []).find((r) => r.id === props.modelValue.room_id),
)

// Tenants
const tenantSearch = ref('')
const { data: tenantsData } = useFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
  query: computed(() => ({
    q: tenantSearch.value || undefined,
    limit: 50,
    available: true,
    excludeContractId: props.excludeContractId || undefined,
  })),
  watch: [tenantSearch],
})
const filteredTenants = computed(() => tenantsData.value?.data ?? [])

const selectedTenant = computed(() =>
  filteredTenants.value.find((t) => t.id === props.modelValue.tenant_id),
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

function onSubmit() {
  emit('submit', props.modelValue)
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">

    <!-- Room picker -->
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-muted">
        Phòng <span class="text-error ml-0.5" aria-hidden="true">*</span>
      </label>

      <!-- Selected room chip -->
      <div
        v-if="selectedRoom"
        class="flex items-center justify-between px-3 py-2.5 rounded-lg border border-cyan/30 bg-cyan/5"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="size-8 rounded-md bg-cyan/10 flex items-center justify-center shrink-0">
            <span class="text-cyan text-xs font-bold">{{ selectedRoom.roomNumber }}</span>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-white">Phòng {{ selectedRoom.roomNumber }}</p>
            <p class="text-xs text-muted truncate">
              {{ buildingMap[selectedRoom.buildingId] ?? '' }}
              · {{ formatCurrency(selectedRoom.monthlyRent) }}/tháng
            </p>
          </div>
        </div>
        <button
          type="button"
          :disabled="loading"
          class="text-muted hover:text-white transition-colors shrink-0 ml-2 disabled:opacity-40"
          @click="update('room_id', '')"
        >
          ✕
        </button>
      </div>

      <!-- Search + list -->
      <div
        :class="[
          'rounded-lg border overflow-hidden',
          errors.room_id ? 'border-error/50' : 'border-dark-border',
        ]"
      >
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">🔍</span>
          <input
            v-model="roomSearch"
            type="text"
            placeholder="Tìm số phòng hoặc tòa nhà..."
            :disabled="loading"
            class="block w-full pl-7 pr-3 py-2 bg-dark-surface text-white placeholder-muted focus:outline-none focus:ring-0 text-sm border-b border-dark-border disabled:text-muted disabled:cursor-not-allowed"
          >
        </div>
        <div class="max-h-44 overflow-y-auto bg-dark-surface">
          <button
            v-for="r in filteredRooms"
            :key="r.id"
            type="button"
            :disabled="loading"
            :class="[
              'flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors text-sm border-b border-dark-border/50 last:border-0',
              modelValue.room_id === r.id
                ? 'bg-cyan/10 text-cyan'
                : 'text-white hover:bg-dark-hover',
            ]"
            @click="selectRoom(r.id)"
          >
            <span class="font-medium">
              Phòng {{ r.roomNumber }}
              <span class="font-normal text-muted ml-1.5">{{ buildingMap[r.buildingId] ?? '' }}</span>
            </span>
            <span class="text-muted text-xs shrink-0 ml-2">{{ formatCurrency(r.monthlyRent) }}/tháng</span>
          </button>
          <div v-if="filteredRooms.length === 0" class="px-3 py-5 text-center text-muted text-sm">
            Không tìm thấy phòng trống nào
          </div>
        </div>
      </div>
      <p v-if="errors.room_id" class="text-xs text-error">{{ errors.room_id[0] }}</p>
    </div>

    <!-- Tenant picker -->
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-muted">
        Khách thuê <span class="text-error ml-0.5" aria-hidden="true">*</span>
      </label>

      <!-- Selected tenant chip -->
      <div
        v-if="selectedTenant"
        class="flex items-center justify-between px-3 py-2.5 rounded-lg border border-cyan/30 bg-cyan/5"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="size-8 rounded-full bg-cyan/10 flex items-center justify-center shrink-0">
            <span class="text-cyan text-xs font-bold">{{ selectedTenant.fullName.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-white">{{ selectedTenant.fullName }}</p>
            <p class="text-xs text-muted">{{ selectedTenant.phone }}</p>
          </div>
        </div>
        <button
          type="button"
          :disabled="loading"
          class="text-muted hover:text-white transition-colors shrink-0 ml-2 disabled:opacity-40"
          @click="update('tenant_id', '')"
        >
          ✕
        </button>
      </div>

      <!-- Search + list -->
      <div
        :class="[
          'rounded-lg border overflow-hidden',
          errors.tenant_id ? 'border-error/50' : 'border-dark-border',
        ]"
      >
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">🔍</span>
          <input
            v-model="tenantSearch"
            type="text"
            placeholder="Tìm theo tên hoặc số điện thoại..."
            :disabled="loading"
            class="block w-full pl-7 pr-3 py-2 bg-dark-surface text-white placeholder-muted focus:outline-none focus:ring-0 text-sm border-b border-dark-border disabled:text-muted disabled:cursor-not-allowed"
          >
        </div>
        <div class="max-h-44 overflow-y-auto bg-dark-surface">
          <button
            v-for="t in filteredTenants"
            :key="t.id"
            type="button"
            :disabled="loading"
            :class="[
              'flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors text-sm border-b border-dark-border/50 last:border-0',
              modelValue.tenant_id === t.id
                ? 'bg-cyan/10'
                : 'hover:bg-dark-hover',
            ]"
            @click="update('tenant_id', t.id)"
          >
            <div class="size-7 rounded-full bg-dark-hover flex items-center justify-center shrink-0 text-xs font-bold text-muted">
              {{ t.fullName.charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <p :class="['font-medium truncate', modelValue.tenant_id === t.id ? 'text-cyan' : 'text-white']">
                {{ t.fullName }}
              </p>
              <p class="text-xs text-muted">{{ t.phone }}</p>
            </div>
          </button>
          <div v-if="filteredTenants.length === 0" class="px-3 py-5 text-center text-muted text-sm">
            Không tìm thấy khách thuê nào
          </div>
        </div>
      </div>
      <p v-if="errors.tenant_id" class="text-xs text-error">{{ errors.tenant_id[0] }}</p>
    </div>

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
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-muted">Trạng thái</label>
      <select
        :value="modelValue.status"
        :disabled="loading"
        class="block w-full rounded-md border border-dark-border px-3 py-2 bg-dark-surface text-white focus:outline-none focus:ring-2 focus:border-cyan/70 focus:ring-cyan/30 text-sm disabled:bg-dark-hover disabled:text-muted disabled:cursor-not-allowed"
        @change="update('status', ($event.target as HTMLSelectElement).value as 'active' | 'expired' | 'terminated')"
      >
        <option value="active">Đang hiệu lực</option>
        <option value="expired">Đã hết hạn</option>
        <option value="terminated">Đã chấm dứt</option>
      </select>
    </div>

    <!-- notes -->
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-muted">Ghi chú</label>
      <textarea
        :value="modelValue.notes"
        :disabled="loading"
        rows="3"
        placeholder="Ghi chú hợp đồng (không bắt buộc)"
        class="block w-full rounded-md border border-dark-border px-3 py-2 bg-dark-surface text-white placeholder-muted focus:outline-none focus:ring-2 focus:border-cyan/70 focus:ring-cyan/30 text-sm resize-none disabled:bg-dark-hover disabled:text-muted disabled:cursor-not-allowed"
        @input="update('notes', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- API Error -->
    <div v-if="apiError" class="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
      {{ apiError }}
    </div>

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
