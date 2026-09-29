<script setup lang="ts">
import type { SelectOption } from '~/components/ui/UiSelect.vue'

const props = defineProps<{
  buildingValue: string | number | null
  yearValue: number
  statusValue: string | number | null
  buildingOptions: SelectOption[]
  yearOptions: SelectOption[]
  statusOptions: SelectOption[]
  buildingsLoading?: boolean
  hasDebt: boolean
  activeQueueLabel?: string | null
  hasActiveFilters?: boolean
  isLoading?: boolean
  periodCount?: number
}>()

const emit = defineEmits<{
  'update:buildingValue': [value: string | number | null]
  'update:yearValue': [value: number]
  'update:statusValue': [value: string | number | null]
  toggleDebt: []
  clearQueue: []
  reset: []
  refresh: []
}>()

// Badge count on the popover trigger — a lightweight hint, not the source of
// truth for `hasActiveFilters` (parent still owns that, including the year default).
const filterCount = computed(() => {
  let n = 0
  if (props.buildingValue) n++
  if (props.statusValue) n++
  if (props.hasDebt) n++
  return n
})
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <div class="flex min-w-0 items-center gap-2">
      <UiFilterPopover :count="filterCount" aria-label="Bộ lọc kỳ vận hành" panel-class="w-72">
      <div class="flex flex-col gap-3">
        <label class="flex flex-col gap-1.5 text-xs text-ui-muted">
          <span>Tòa nhà</span>
          <UiSelect
            :model-value="buildingValue"
            :options="buildingOptions"
            placeholder="Tất cả tòa nhà"
            :disabled="buildingsLoading"
            density="compact"
            aria-label="Tòa nhà"
            @update:model-value="emit('update:buildingValue', $event)"
          />
        </label>

        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1.5 text-xs text-ui-muted">
            <span>Năm</span>
            <UiSelect
              :model-value="yearValue"
              :options="yearOptions"
              density="compact"
              aria-label="Năm"
              @update:model-value="emit('update:yearValue', Number($event))"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs text-ui-muted">
            <span>Trạng thái</span>
            <UiSelect
              :model-value="statusValue"
              :options="statusOptions"
              placeholder="Tất cả"
              density="compact"
              aria-label="Trạng thái"
              @update:model-value="emit('update:statusValue', $event)"
            />
          </label>
        </div>

        <UiToggle
          :model-value="hasDebt"
          label="Chỉ kỳ có công nợ"
          size="sm"
          @update:model-value="emit('toggleDebt')"
        />
      </div>
    </UiFilterPopover>

      <UiButton
        v-if="activeQueueLabel"
        unstyled
        class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-ui-accent/60 bg-ui-accent/10 px-3 text-sm text-ui-accent transition hover:bg-ui-accent/20"
        @click="emit('clearQueue')"
      >
        <span class="whitespace-nowrap">{{ activeQueueLabel }}</span>
        <IconX class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <UiFilterResetButton v-if="hasActiveFilters" label="Xóa lọc" @click="emit('reset')" />
      <span v-if="periodCount !== undefined && !isLoading" class="text-xs tabular-nums text-ui-muted">
        {{ periodCount }} kỳ
      </span>
      <UiButton
        unstyled
        :class="[
          'inline-flex h-9 items-center gap-1.5 rounded-md border border-ui-border px-3 text-sm text-ui-muted transition hover:bg-ui-hover hover:text-ui-primary',
          isLoading && 'pointer-events-none opacity-50',
        ]"
        :aria-label="isLoading ? 'Đang tải' : 'Làm mới danh sách'"
        @click="emit('refresh')"
      >
        <IconRefresh class="h-4 w-4" :class="isLoading && 'animate-spin'" aria-hidden="true" />
        <span class="hidden sm:inline">Làm mới</span>
      </UiButton>
    </div>
  </div>
</template>