<script setup lang="ts">
import type { Room } from '~/types/rooms'
import type { Tenant } from '~/types/tenants'
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { ContractStatus, ContractWithDetails } from '~/types/contracts'

export interface ContractFormData {
  room_id: string
  tenant_id: string
  start_date: string
  end_date: string
  monthly_rent: string
  deposit: string
  status: ContractStatus
  notes: string
}

const props = withDefaults(defineProps<{
  modelValue: ContractFormData
  loading?: boolean
  errors?: Record<string, string[]>
  apiError?: string | null
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
  query: computed(() => ({ limit: 100 })),
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

const filteredRooms = computed(() => {
  const available = (roomsData.value?.data ?? []).filter(
    (r) => !occupiedRoomIds.value.has(r.id),
  )
  const q = roomSearch.value.trim().toLowerCase()
  if (!q) return available
  return available.filter((r) => {
    const buildingName = buildingMap.value[r.buildingId] ?? ''
    return (
      r.roomNumber.toLowerCase().includes(q) ||
      buildingName.toLowerCase().includes(q)
    )
  })
})

// Tenants
const tenantSearch = ref('')
const { data: tenantsData } = useFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
  query: computed(() => ({ q: tenantSearch.value || undefined, limit: 50 })),
  watch: [tenantSearch],
})
const filteredTenants = computed(() => tenantsData.value?.data ?? [])

function update<K extends keyof ContractFormData>(field: K, value: ContractFormData[K]) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function onSubmit() {
  emit('submit', props.modelValue)
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <!-- room_id -->
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-muted">
        Phòng <span class="text-error ml-0.5" aria-hidden="true">*</span>
      </label>
      <input
        v-model="roomSearch"
        type="text"
        placeholder="Tìm số phòng hoặc tòa nhà..."
        :disabled="loading"
        class="block w-full rounded-md border border-dark-border px-3 py-2 bg-dark-surface text-white placeholder-muted focus:outline-none focus:ring-2 focus:border-cyan/70 focus:ring-cyan/30 text-sm disabled:bg-dark-hover disabled:text-muted disabled:cursor-not-allowed"
      >
      <select
        :value="modelValue.room_id"
        :disabled="loading"
        :class="[
          'block w-full rounded-md border px-3 py-2 bg-dark-surface text-white focus:outline-none focus:ring-2 focus:border-cyan/70 focus:ring-cyan/30 text-sm',
          errors.room_id ? 'border-error/50' : 'border-dark-border',
          loading && 'bg-dark-hover text-muted cursor-not-allowed',
        ]"
        size="4"
        @change="update('room_id', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="r in filteredRooms" :key="r.id" :value="r.id">
          Phòng {{ r.roomNumber }} — {{ buildingMap[r.buildingId] ?? r.buildingId }}
        </option>
      </select>
      <p v-if="errors.room_id" class="text-xs text-error">{{ errors.room_id[0] }}</p>
    </div>

    <!-- tenant_id -->
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-muted">
        Khách thuê <span class="text-error ml-0.5" aria-hidden="true">*</span>
      </label>
      <input
        v-model="tenantSearch"
        type="text"
        placeholder="Tìm theo tên hoặc số điện thoại..."
        :disabled="loading"
        class="block w-full rounded-md border border-dark-border px-3 py-2 bg-dark-surface text-white placeholder-muted focus:outline-none focus:ring-2 focus:border-cyan/70 focus:ring-cyan/30 text-sm disabled:bg-dark-hover disabled:text-muted disabled:cursor-not-allowed"
      >
      <select
        :value="modelValue.tenant_id"
        :disabled="loading"
        :class="[
          'block w-full rounded-md border px-3 py-2 bg-dark-surface text-white focus:outline-none focus:ring-2 focus:border-cyan/70 focus:ring-cyan/30 text-sm',
          errors.tenant_id ? 'border-error/50' : 'border-dark-border',
          loading && 'bg-dark-hover text-muted cursor-not-allowed',
        ]"
        size="4"
        @change="update('tenant_id', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="t in filteredTenants" :key="t.id" :value="t.id">
          {{ t.fullName }} — {{ t.phone }}
        </option>
      </select>
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

    <!-- status -->
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-muted">Trạng thái</label>
      <select
        :value="modelValue.status"
        :disabled="loading"
        class="block w-full rounded-md border border-dark-border px-3 py-2 bg-dark-surface text-white focus:outline-none focus:ring-2 focus:border-cyan/70 focus:ring-cyan/30 text-sm disabled:bg-dark-hover disabled:text-muted disabled:cursor-not-allowed"
        @change="update('status', ($event.target as HTMLSelectElement).value as ContractStatus)"
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
