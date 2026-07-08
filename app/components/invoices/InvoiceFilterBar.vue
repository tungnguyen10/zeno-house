<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { InvoiceStatus } from '~/utils/constants/billing'

const props = defineProps<{
  buildings: Building[]
  buildingsLoading?: boolean
  buildingId: string
  periodYear: number
  periodMonth?: number
  allMonths: boolean
  statuses: InvoiceStatus[]
  tenantSearch: string
  hasActiveFilters?: boolean
}>()

const emit = defineEmits<{
  'update:buildingId': [value: string]
  'update:periodYear': [value: number]
  'update:periodMonth': [value: number | undefined]
  'update:allMonths': [value: boolean]
  'update:statuses': [value: InvoiceStatus[]]
  'update:tenantSearch': [value: string]
  'reset': []
}>()

const now = new Date()
const { yearOptions, monthOptions } = usePeriodOptions({
  selectedYear: computed(() => props.periodYear),
})
const buildingOptions = computed(() => [
  { value: '', label: 'Tất cả tòa nhà' },
  ...props.buildings.map(building => ({ value: building.id, label: building.name })),
])

const statusOptions: Array<{ value: InvoiceStatus; label: string }> = [
  { value: 'issued', label: 'Chưa thu' },
  { value: 'partial', label: 'Một phần' },
  { value: 'paid', label: 'Đã thu' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'void', label: 'Huỷ' },
]

const activeFilterCount = computed(() => {
  let n = 0
  if (props.buildingId) n++
  if (props.allMonths) n++
  if (props.periodYear !== now.getFullYear()) n++
  if (!props.allMonths && props.periodMonth !== now.getMonth() + 1) n++
  n += props.statuses.length
  return n
})

function onBuildingChange(value: string | number | null) {
  emit('update:buildingId', value == null ? '' : String(value))
}

function updateAllMonths(value: boolean) {
  emit('update:allMonths', value)
  if (value) emit('update:periodMonth', undefined)
  else if (!props.periodMonth) emit('update:periodMonth', now.getMonth() + 1)
}
</script>

<template>
  <UiToolbar>
    <UiSearchInput
      :model-value="tenantSearch"
      placeholder="Tìm khách hoặc SĐT"
      aria-label="Tìm kiếm hoá đơn theo khách thuê hoặc số điện thoại"
      :debounce="300"
      class="w-full sm:w-72"
      @update:model-value="emit('update:tenantSearch', $event)"
    />

    <UiFilterPopover :count="activeFilterCount" aria-label="Bộ lọc hoá đơn">
      <div class="flex flex-col gap-3">
        <label class="flex flex-col gap-1.5 text-xs text-muted">
          <span>Tòa nhà</span>
          <UiSelect
            :model-value="buildingId"
            :options="buildingOptions"
            :disabled="buildingsLoading"
            density="compact"
            aria-label="Lọc theo tòa nhà"
            @update:model-value="onBuildingChange"
          />
        </label>

        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1.5 text-xs text-muted">
            <span>Năm</span>
            <UiSelect
              :model-value="periodYear"
              :options="yearOptions"
              density="compact"
              aria-label="Lọc theo năm"
              @update:model-value="emit('update:periodYear', Number($event))"
            />
          </label>

          <label class="flex flex-col gap-1.5 text-xs text-muted">
            <span>Tháng</span>
            <UiSelect
              :model-value="periodMonth ?? null"
              :options="monthOptions"
              :disabled="allMonths"
              placeholder="Tất cả tháng"
              density="compact"
              aria-label="Lọc theo tháng"
              @update:model-value="emit('update:periodMonth', $event === null ? undefined : Number($event))"
            />
          </label>
        </div>

        <UiToggle
          :model-value="allMonths"
          label="Tất cả tháng trong năm"
          size="sm"
          @update:model-value="updateAllMonths"
        />

        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-muted">Trạng thái</span>
          <UiFilterChips
            :model-value="statuses"
            :options="statusOptions"
            aria-label="Lọc theo trạng thái hoá đơn"
            @update:model-value="emit('update:statuses', $event)"
          />
        </div>
      </div>
    </UiFilterPopover>

    <template v-if="hasActiveFilters" #actions>
      <UiFilterResetButton @click="emit('reset')" />
    </template>
  </UiToolbar>
</template>
