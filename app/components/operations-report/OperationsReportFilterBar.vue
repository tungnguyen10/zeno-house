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
</script>

<template>
  <UiToolbar class="mb-4">
    <UiSelect
      :model-value="buildingValue"
      aria-label="Tòa nhà"
      :options="buildingOptions"
      placeholder="Tòa nhà"
      class="w-full sm:min-w-[200px] sm:max-w-[260px]"
      @update:model-value="emit('update:buildingValue', $event)"
    />
    <UiSelect
      :model-value="yearValue"
      aria-label="Năm"
      :options="yearOptions"
      class="w-full sm:w-28"
      @update:model-value="emit('update:yearValue', $event)"
    />
    <UiSelect
      :model-value="monthValue"
      aria-label="Tháng"
      :options="monthOptions"
      class="w-full sm:w-32"
      @update:model-value="emit('update:monthValue', $event)"
    />
    <UiSelect
      :model-value="expenseCategoryValue"
      aria-label="Loại chi"
      :options="expenseCategoryOptions"
      class="w-full sm:min-w-[170px] sm:max-w-[220px]"
      @update:model-value="emit('update:expenseCategoryValue', $event)"
    />

    <template v-if="props.hasActiveFilters" #actions>
      <UiFilterResetButton @click="emit('reset')" />
    </template>
  </UiToolbar>
</template>