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

function handleAmountInput(catalogId: string, value: string) {
  const num = Number(value)
  if (!Number.isNaN(num) && num >= 0) {
    emit('updateAmount', catalogId, num)
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
      <div class="flex items-center gap-2">
        <span class="font-medium text-white">{{ row.name }}</span>
        <UiBadge v-if="row.isCustom" variant="neutral">Riêng</UiBadge>
      </div>
    </template>

    <template #cell-pricingType="{ row }">
      <UiSelect
        :model-value="effectivePricingType(row)"
        :options="PRICING_TYPE_OPTIONS"
        density="compact"
        :aria-label="`Cách tính phí ${row.name}`"
        class="w-44"
        @update:model-value="(value) => emit('updatePricingType', row.id, value as PricingType)"
      />
    </template>

    <template #cell-amount="{ row }">
      <UiInput
        density="compact"
        type="number"
        number-mode="currency"
        :model-value="String(getService(row.id)?.defaultAmount ?? 0)"
        class="w-32 text-right"
        @change="(v) => handleAmountInput(row.id, v as string)"
      />
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
