<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { RoomStatus } from '~/types/rooms'
import type { ApiSuccess } from '~/types/api'

type SortField = 'room_number' | 'floor' | 'monthly_rent' | 'created_at'
type SortOrder = 'asc' | 'desc'

const props = defineProps<{
  q: string
  status: RoomStatus[]
  sort: SortField
  order: SortOrder
  buildingId?: string
  floor?: number
  hasActiveFilters?: boolean
}>()

const emit = defineEmits<{
  'update:q': [value: string]
  'update:status': [value: RoomStatus[]]
  'update:sort': [value: SortField]
  'update:order': [value: SortOrder]
  'update:buildingId': [value: string | undefined]
  'update:floor': [value: number | undefined]
  'reset': []
}>()

const { data: buildingsData } = useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
  '/api/buildings',
  { query: { limit: 100 } },
)

const buildingOptions = computed(() => [
  { value: '', label: 'Tất cả tòa nhà' },
  ...(buildingsData.value?.data ?? []).map(b => ({ value: b.id, label: b.name })),
])

const floorInput = ref(props.floor !== undefined ? String(props.floor) : '')

watch(() => props.floor, (value) => {
  const next = value !== undefined ? String(value) : ''
  if (next !== floorInput.value) floorInput.value = next
})

function onFloorInput(value: string | number) {
  const str = String(value)
  floorInput.value = str
  emit('update:floor', str ? Number(str) : undefined)
}

function onBuildingChange(value: string | number | null) {
  emit('update:buildingId', value ? String(value) : undefined)
}

const statusOptions: { value: RoomStatus; label: string }[] = [
  { value: 'available', label: 'Trống' },
  { value: 'occupied', label: 'Đang ở' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'archived', label: 'Đã lưu trữ' },
]

const sortOptions = [
  { value: 'floor', label: 'Tầng' },
  { value: 'room_number', label: 'Số phòng' },
  { value: 'monthly_rent', label: 'Giá thuê' },
  { value: 'created_at', label: 'Ngày tạo' },
]

const activeFilterCount = computed(() => {
  let n = 0
  if (props.buildingId) n++
  if (props.floor !== undefined) n++
  n += props.status.length
  return n
})
</script>

<template>
  <UiToolbar>
    <UiSearchInput
      :model-value="q"
      placeholder="Tìm số phòng, mã, mô tả..."
      aria-label="Tìm kiếm phòng"
      :debounce="250"
      class="w-full sm:w-72"
      @update:model-value="emit('update:q', $event)"
    />

    <UiFilterPopover :count="activeFilterCount" aria-label="Bộ lọc phòng">
      <div class="flex flex-col gap-3">
        <label class="flex flex-col gap-1.5 text-xs text-muted">
          <span>Tòa nhà</span>
          <UiSelect
            :model-value="buildingId ?? ''"
            :options="buildingOptions"
            density="compact"
            aria-label="Lọc theo tòa nhà"
            @update:model-value="onBuildingChange"
          />
        </label>

        <label class="flex flex-col gap-1.5 text-xs text-muted">
          <span>Tầng</span>
          <UiInput
            :model-value="floorInput"
            type="number"
            number-mode="integer"
            placeholder="Mọi tầng"
            density="compact"
            aria-label="Lọc theo tầng"
            @update:model-value="onFloorInput"
          />
        </label>

        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-muted">Trạng thái</span>
          <UiFilterChips
            :model-value="status"
            :options="statusOptions"
            aria-label="Lọc theo trạng thái"
            @update:model-value="emit('update:status', $event)"
          />
        </div>
      </div>
    </UiFilterPopover>

    <UiSortControl
      :model-value="sort"
      :order="order"
      :options="sortOptions"
      class="sm:ml-auto"
      @update:model-value="emit('update:sort', $event as SortField)"
      @update:order="emit('update:order', $event)"
    />

    <template v-if="hasActiveFilters" #actions>
      <UiButton variant="ghost" size="sm" @click="emit('reset')">
        Xoá bộ lọc
      </UiButton>
    </template>
  </UiToolbar>
</template>
