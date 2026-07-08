<script setup lang="ts">
import type { SelectOption } from '~/components/ui/UiSelect.vue'

defineProps<{
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
</script>

<template>
  <UiToolbar class="rounded-xl border border-dark-border bg-dark-surface/40 p-2.5">
    <div class="w-full sm:w-56">
      <UiSelect
        :model-value="buildingValue"
        :options="buildingOptions"
        placeholder="Tất cả tòa nhà"
        :disabled="buildingsLoading"
        aria-label="Tòa nhà"
        class="w-full"
        @update:model-value="emit('update:buildingValue', $event)"
      >
        <template #prefix>
          <IconBuilding class="h-4 w-4" />
        </template>
      </UiSelect>
    </div>

    <div class="w-full sm:w-28">
      <UiSelect
        :model-value="yearValue"
        :options="yearOptions"
        aria-label="Năm"
        class="w-full"
        @update:model-value="emit('update:yearValue', Number($event))"
      >
        <template #prefix>
          <IconClock class="h-4 w-4" />
        </template>
      </UiSelect>
    </div>

    <div class="w-full sm:w-48">
      <UiSelect
        :model-value="statusValue"
        :options="statusOptions"
        placeholder="Tất cả trạng thái"
        aria-label="Trạng thái"
        class="w-full"
        @update:model-value="emit('update:statusValue', $event)"
      >
        <template #prefix>
          <IconTag class="h-4 w-4" />
        </template>
      </UiSelect>
    </div>

    <UiButton
      unstyled
      :aria-pressed="hasDebt"
      :class="[
        'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/30',
        hasDebt
          ? 'border-error/60 bg-error/10 text-error-vivid'
          : 'border-dark-border bg-dark-surface text-muted hover:border-dark-hover hover:text-white',
      ]"
      @click="emit('toggleDebt')"
    >
      <IconAlertCircle class="h-4 w-4" aria-hidden="true" />
      <span class="whitespace-nowrap">Có công nợ</span>
    </UiButton>

    <UiButton
      v-if="activeQueueLabel"
      unstyled
      class="inline-flex h-9 items-center gap-1.5 rounded-md border border-cyan/60 bg-cyan/10 px-3 text-sm text-cyan transition hover:bg-cyan/20"
      @click="emit('clearQueue')"
    >
      <span class="whitespace-nowrap">{{ activeQueueLabel }}</span>
      <IconX class="h-3.5 w-3.5" aria-hidden="true" />
    </UiButton>

    <template #actions>
      <UiFilterResetButton v-if="hasActiveFilters" label="Xóa lọc" @click="emit('reset')" />
      <span v-if="periodCount !== undefined && !isLoading" class="text-xs tabular-nums text-muted">
        {{ periodCount }} kỳ
      </span>
      <UiButton
        unstyled
        :class="[
          'inline-flex h-9 items-center gap-1.5 rounded-md border border-dark-border px-3 text-sm text-muted transition hover:bg-dark-hover hover:text-white',
          isLoading && 'pointer-events-none opacity-50',
        ]"
        :aria-label="isLoading ? 'Đang tải' : 'Làm mới danh sách'"
        @click="emit('refresh')"
      >
        <IconRefresh class="h-4 w-4" :class="isLoading && 'animate-spin'" aria-hidden="true" />
        <span class="hidden sm:inline">Làm mới</span>
      </UiButton>
    </template>
  </UiToolbar>
</template>