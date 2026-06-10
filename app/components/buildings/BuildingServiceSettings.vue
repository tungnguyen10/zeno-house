<script setup lang="ts">
import type { PricingType, ServiceCatalogItem } from '~/types/service-catalog'
import type { BuildingService } from '~/types/building-services'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'

const props = defineProps<{
  buildingId: string
  catalog: ServiceCatalogItem[]
  services: BuildingService[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle', catalogId: string, isActive: boolean): void
  (e: 'updateAmount', catalogId: string, amount: number): void
  (e: 'updatePricingType', catalogId: string, pricingType: PricingType): void
}>()

const PRICING_TYPE_OPTIONS: { value: PricingType, label: string }[] = [
  { value: 'fixed_per_room', label: 'Cố định / phòng' },
  { value: 'per_person', label: 'Theo người' },
  { value: 'per_vehicle', label: 'Theo xe' },
]

function getService(catalogId: string): BuildingService | undefined {
  return props.services.find(s => s.catalogId === catalogId)
}

function effectivePricingType(item: ServiceCatalogItem): PricingType {
  return getService(item.id)?.pricingType ?? item.pricingType
}

function handleAmountBlur(catalogId: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isNaN(value) && value >= 0) {
    emit('updateAmount', catalogId, value)
  }
}

const columns: UiTableColumn<ServiceCatalogItem>[] = [
  { key: 'name', label: 'Dịch vụ' },
  { key: 'pricingType', label: 'Loại tính phí' },
  { key: 'amount', label: 'Đơn giá mặc định', numeric: true, width: 'w-44' },
  { key: 'active', label: 'Kích hoạt', width: 'w-24' },
]
</script>

<template>
  <UiTable
    :rows="catalog"
    :columns="columns"
    :loading="loading"
    empty-title="Chưa có dịch vụ nào"
  >
    <template #cell-name="{ row }">
      <span class="font-medium text-white">{{ row.name }}</span>
    </template>

    <template #cell-pricingType="{ row }">
      <UiSelect
        :model-value="effectivePricingType(row)"
        :options="PRICING_TYPE_OPTIONS"
        class="w-44"
        @update:model-value="(value) => emit('updatePricingType', row.id, value as PricingType)"
      />
    </template>

    <template #cell-amount="{ row }">
      <input
        type="number"
        min="0"
        step="1000"
        :value="getService(row.id)?.defaultAmount ?? 0"
        class="w-32 rounded-md border border-dark-border bg-dark-surface px-2 py-1.5 text-right text-sm text-white focus:border-cyan/70 focus:ring-2 focus:ring-cyan/30 focus:outline-none"
        @blur="handleAmountBlur(row.id, $event)"
      >
    </template>

    <template #cell-active="{ row }">
      <UiToggle
        :model-value="getService(row.id)?.isActive ?? false"
        :aria-label="`Bật/tắt ${row.name}`"
        size="sm"
        @update:model-value="(value) => emit('toggle', row.id, value)"
      />
    </template>
  </UiTable>
</template>

