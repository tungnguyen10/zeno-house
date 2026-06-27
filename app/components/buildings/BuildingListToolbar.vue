<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
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

// Local search input is debounced (250ms) before bubbling up to the URL/composable.
const searchInput = ref(props.q)

watch(() => props.q, (value) => {
  if (value !== searchInput.value) searchInput.value = value
})

const emitSearch = useDebounceFn((value: string) => {
  emit('update:q', value)
}, 250)

function onSearchInput(value: string) {
  searchInput.value = value
  emitSearch(value)
}

function toggleStatus(value: BuildingStatus) {
  const next = props.status.includes(value)
    ? props.status.filter(s => s !== value)
    : [...props.status, value]
  emit('update:status', next)
}

function onSortChange(value: string | number | null) {
  if (value === null) return
  emit('update:sort', String(value) as SortField)
}

function toggleOrder() {
  emit('update:order', props.order === 'asc' ? 'desc' : 'asc')
}

const statusOptions: { value: BuildingStatus; label: string }[] = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Đã lưu trữ' },
]

const sortOptions = [
  { value: 'created_at', label: 'Mới nhất' },
  { value: 'name', label: 'Tên' },
  { value: 'total_rooms', label: 'Số phòng' },
]
</script>

<template>
  <UiToolbar>
    <div class="relative w-full sm:w-72">
      <IconSearch class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        :value="searchInput"
        placeholder="Tìm theo tên, mã, địa chỉ…"
        class="block w-full rounded-md border border-dark-border bg-dark-surface py-2 pl-9 pr-3 text-sm text-white placeholder-muted focus:border-cyan/70 focus:outline-none focus:ring-2 focus:ring-cyan/30"
        aria-label="Tìm kiếm tòa nhà"
        @input="onSearchInput(($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="flex items-center gap-2" role="group" aria-label="Lọc theo trạng thái">
      <button
        v-for="option in statusOptions"
        :key="option.value"
        type="button"
        :aria-pressed="status.includes(option.value)"
        :class="[
          'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
          status.includes(option.value)
            ? 'border-cyan/40 bg-cyan/10 text-cyan'
            : 'border-dark-border bg-dark-surface text-muted hover:text-white hover:border-dark-border',
        ]"
        @click="toggleStatus(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <div class="flex items-center gap-2">
      <UiSelect
        :model-value="sort"
        :options="sortOptions"
        density="compact"
        aria-label="Sắp xếp"
        class="min-w-[10rem]"
        @update:model-value="onSortChange"
      />
      <UiButton
        variant="secondary"
        size="sm"
        :aria-label="order === 'asc' ? 'Sắp xếp tăng dần' : 'Sắp xếp giảm dần'"
        icon-only
        @click="toggleOrder"
      >
        <IconArrowUp v-if="order === 'asc'" class="h-4 w-4" aria-hidden="true" />
        <IconArrowUp v-else class="h-4 w-4 rotate-180" aria-hidden="true" />
      </UiButton>
    </div>

    <template v-if="hasActiveFilters" #actions>
      <UiButton variant="ghost" size="sm" @click="emit('reset')">
        Xoá bộ lọc
      </UiButton>
    </template>
  </UiToolbar>
</template>
