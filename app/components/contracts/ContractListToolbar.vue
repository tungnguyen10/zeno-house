<script setup lang="ts">
import type { ContractStatus } from '~/types/contracts'

type SortField = 'start_date' | 'end_date' | 'created_at' | 'monthly_rent'
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
  <UiToolbar>
    <UiSearchInput
      :model-value="q"
      placeholder="Tìm mã HĐ, tên khách thuê, số phòng…"
      aria-label="Tìm kiếm hợp đồng"
      :debounce="250"
      class="w-full sm:w-72"
      @update:model-value="emit('update:q', $event)"
    />

    <UiFilterPopover :count="activeFilterCount" aria-label="Bộ lọc hợp đồng">
      <div class="flex flex-col gap-3">
        <label class="flex flex-col gap-1.5 text-xs text-muted">
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
