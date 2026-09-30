<script setup lang="ts">
import type { BuildingStatus } from '~/types/buildings'

type SortField = 'name' | 'created_at' | 'total_rooms'
type SortOrder = 'asc' | 'desc'

const props = defineProps<{
  q: string
  status: BuildingStatus[]
  sort: SortField
  order: SortOrder
  hasActiveFilters?: boolean
}>()

const emit = defineEmits<{
  'update:q': [value: string]
  'update:status': [value: BuildingStatus[]]
  'update:sort': [value: SortField]
  'update:order': [value: SortOrder]
  'reset': []
}>()

const statusOptions: { value: BuildingStatus; label: string }[] = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Đã lưu trữ' },
]

const sortOptions = [
  { value: 'created_at', label: 'Mới nhất' },
  { value: 'name', label: 'Tên' },
  { value: 'total_rooms', label: 'Số phòng' },
]

const activeFilterCount = computed(() => props.status.length)
</script>

<template>
  <UiListToolbar
    :search="q"
    search-placeholder="Tìm theo tên, mã, địa chỉ…"
    search-aria-label="Tìm kiếm tòa nhà"
    :filter-count="activeFilterCount"
    filter-aria-label="Bộ lọc tòa nhà"
    :has-active-filters="hasActiveFilters"
    @update:search="emit('update:q', $event)"
    @reset="emit('reset')"
  >
    <template #filters>
      <div class="flex flex-col gap-1.5">
        <span class="text-xs text-ui-muted">Trạng thái</span>
        <UiFilterChips
          :model-value="status"
          :options="statusOptions"
          aria-label="Lọc theo trạng thái"
          @update:model-value="emit('update:status', $event)"
        />
      </div>
    </template>

    <template #sort>
      <UiSortControl
        :model-value="sort"
        :order="order"
        :options="sortOptions"
        class="shrink-0 sm:ml-auto"
        @update:model-value="emit('update:sort', $event as SortField)"
        @update:order="emit('update:order', $event)"
      />
    </template>
  </UiListToolbar>
</template>
