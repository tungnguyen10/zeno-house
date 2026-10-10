<script setup lang="ts">
import type { ContractStatus } from '~/types/contracts'

type SortField = 'location' | 'start_date' | 'end_date' | 'created_at' | 'monthly_rent'
type SortOrder = 'asc' | 'desc'

interface BuildingOption {
  value: string
  label: string
}

const props = defineProps<{
  q: string
  buildingFilter: string
  status: ContractStatus[]
  sort: SortField
  order: SortOrder
  hasActiveFilters?: boolean
  buildingOptions: BuildingOption[]
}>()

const emit = defineEmits<{
  'update:q': [value: string]
  'update:buildingFilter': [value: string]
  'update:status': [value: ContractStatus[]]
  'update:sort': [value: SortField]
  'update:order': [value: SortOrder]
  'reset': []
}>()

function onBuildingChange(value: string | number | null) {
  emit('update:buildingFilter', value == null ? '' : String(value))
}

const statusOptions: { value: ContractStatus; label: string }[] = [
  { value: 'active', label: 'Đang hiệu lực' },
  { value: 'expired', label: 'Đã hết hạn' },
  { value: 'terminated', label: 'Đã chấm dứt' },
  { value: 'renewed', label: 'Đã gia hạn' },
]

const sortOptions = [
  { value: 'location', label: 'Tòa nhà & phòng' },
  { value: 'created_at', label: 'Mới nhất' },
  { value: 'start_date', label: 'Ngày bắt đầu' },
  { value: 'end_date', label: 'Ngày kết thúc' },
  { value: 'monthly_rent', label: 'Giá thuê' },
]

const buildingSelectOptions = computed(() => [
  { value: '', label: 'Tất cả tòa nhà' },
  ...props.buildingOptions,
])

const activeFilterCount = computed(() => {
  let n = 0
  if (props.buildingFilter) n++
  n += props.status.length
  return n
})
</script>

<template>
  <UiListToolbar
    :search="q"
    search-placeholder="Tìm mã HĐ, tên khách thuê, số phòng…"
    search-aria-label="Tìm kiếm hợp đồng"
    :filter-count="activeFilterCount"
    filter-aria-label="Bộ lọc hợp đồng"
    :has-active-filters="hasActiveFilters"
    @update:search="emit('update:q', $event)"
    @reset="emit('reset')"
  >
    <template #filters>
      <div class="flex flex-col gap-3">
        <label class="flex flex-col gap-1.5 text-xs text-ui-muted">
          <span>Tòa nhà</span>
          <UiSelect
            :model-value="buildingFilter"
            :options="buildingSelectOptions"
            density="compact"
            aria-label="Lọc theo tòa nhà"
            @update:model-value="onBuildingChange"
          />
        </label>

        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-ui-muted">Trạng thái</span>
          <UiFilterChips
            :model-value="status"
            :options="statusOptions"
            aria-label="Lọc theo trạng thái"
            @update:model-value="emit('update:status', $event)"
          />
        </div>
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
