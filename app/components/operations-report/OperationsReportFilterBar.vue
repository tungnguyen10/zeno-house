<script setup lang="ts">
import type { SelectOption } from '~/components/ui/UiSelect.vue'

const props = defineProps<{
  buildingValue: string | number | null
  yearValue: string | number | null
  monthValue: string | number | null
  expenseCategoryValue: string | number | null
  buildingOptions: SelectOption[]
  yearOptions: SelectOption[]
  monthOptions: SelectOption[]
  expenseCategoryOptions: SelectOption[]
  hasActiveFilters?: boolean
}>()

const emit = defineEmits<{
  'update:buildingValue': [value: string | number | null]
  'update:yearValue': [value: string | number | null]
  'update:monthValue': [value: string | number | null]
  'update:expenseCategoryValue': [value: string | number | null]
  reset: []
}>()

// Building auto-defaults to the first assigned building (never genuinely
// "empty"), so a per-field count would misreport it as an active filter and
// mismatch between SSR (default not resolved yet) and client. Reuse the
// parent's already-correct `hasActiveFilters` instead.
const filterCount = computed(() => (props.hasActiveFilters ? 1 : 0))
</script>

<template>
  <UiToolbar class="mb-4">
    <UiFilterPopover :count="filterCount" aria-label="Bộ lọc báo cáo vận hành" panel-class="w-72">
      <div class="flex flex-col gap-3">
        <label class="flex flex-col gap-1.5 text-xs text-ui-muted">
          <span>Tòa nhà</span>
          <UiSelect
            :model-value="buildingValue"
            :options="buildingOptions"
            placeholder="Tòa nhà"
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
              @update:model-value="emit('update:yearValue', $event)"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs text-ui-muted">
            <span>Tháng</span>
            <UiSelect
              :model-value="monthValue"
              :options="monthOptions"
              density="compact"
              aria-label="Tháng"
              @update:model-value="emit('update:monthValue', $event)"
            />
          </label>
        </div>

        <label class="flex flex-col gap-1.5 text-xs text-ui-muted">
          <span>Loại chi</span>
          <UiSelect
            :model-value="expenseCategoryValue"
            :options="expenseCategoryOptions"
            density="compact"
            aria-label="Loại chi"
            @update:model-value="emit('update:expenseCategoryValue', $event)"
          />
        </label>
      </div>
    </UiFilterPopover>

    <template v-if="props.hasActiveFilters" #actions>
      <UiFilterResetButton @click="emit('reset')" />
    </template>
  </UiToolbar>
</template>