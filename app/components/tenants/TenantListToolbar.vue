<script setup lang="ts">
import type { TenantStatus } from '~/types/tenants'

type SortField = 'full_name' | 'created_at' | 'code'
type SortOrder = 'asc' | 'desc'
type ContractState = '' | 'with_contract' | 'without_contract'

interface BuildingOption {
  value: string
  label: string
}

const props = defineProps<{
  q: string
  buildingFilter: string
  contractStateFilter: ContractState
  status: TenantStatus[]
  sort: SortField
  order: SortOrder
  hasActiveFilters?: boolean
  buildingOptions: BuildingOption[]
}>()

const emit = defineEmits<{
  'update:q': [value: string]
  'update:buildingFilter': [value: string]
  'update:contractStateFilter': [value: ContractState]
  'update:status': [value: TenantStatus[]]
  'update:sort': [value: SortField]
  'update:order': [value: SortOrder]
  'reset': []
}>()

function onBuildingChange(value: string | number | null) {
  emit('update:buildingFilter', value == null ? '' : String(value))
}

function onContractStateChange(value: string | number | null) {
  emit('update:contractStateFilter', (value == null ? '' : String(value)) as ContractState)
}

const statusOptions: { value: TenantStatus; label: string }[] = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'archived', label: 'Đã lưu trữ' },
]

const contractStateOptions = [
  { value: '', label: 'Tất cả HĐ' },
  { value: 'with_contract', label: 'Có HĐ' },
  { value: 'without_contract', label: 'Chưa có HĐ' },
]

const sortOptions = [
  { value: 'full_name', label: 'Tên A → Z' },
  { value: 'created_at', label: 'Mới nhất' },
  { value: 'code', label: 'Mã KH' },
]

const buildingSelectOptions = computed(() => [
  { value: '', label: 'Tất cả tòa nhà' },
  ...props.buildingOptions,
])

const activeFilterCount = computed(() => {
  let n = 0
  if (props.buildingFilter) n++
  if (props.contractStateFilter) n++
  n += props.status.length
  return n
})
</script>

<template>
  <UiToolbar>
    <UiSearchInput
      :model-value="q"
      placeholder="Tìm theo tên, SĐT, email, CCCD, mã KH…"
      aria-label="Tìm kiếm khách thuê"
      :debounce="250"
      class="w-full sm:w-72"
      @update:model-value="emit('update:q', $event)"
    />

    <UiFilterPopover :count="activeFilterCount" aria-label="Bộ lọc khách thuê">
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

        <label class="flex flex-col gap-1.5 text-xs text-muted">
          <span>Hợp đồng</span>
          <UiSelect
            :model-value="contractStateFilter"
            :options="contractStateOptions"
            density="compact"
            aria-label="Trạng thái hợp đồng"
            @update:model-value="onContractStateChange"
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
      <UiFilterResetButton @click="emit('reset')" />
    </template>
  </UiToolbar>
</template>
