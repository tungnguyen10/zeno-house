<script setup lang="ts">
import type { PricingType, ServiceCatalogItem } from '~/types/service-catalog'
import type { BuildingService } from '~/types/building-services'

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

const UNIT_LABELS: Record<PricingType, string> = {
  fixed_per_room: 'phòng',
  per_person: 'người',
  per_vehicle: 'xe',
}

function getService(catalogId: string): BuildingService | undefined {
  return props.services.find(s => s.catalogId === catalogId)
}

function effectivePricingType(item: ServiceCatalogItem): PricingType {
  return getService(item.id)?.pricingType ?? item.pricingType
}

function isActive(item: ServiceCatalogItem): boolean {
  return getService(item.id)?.isActive ?? false
}

function amountOf(item: ServiceCatalogItem): number {
  return getService(item.id)?.defaultAmount ?? item.defaultAmount
}

function needsPrice(item: ServiceCatalogItem): boolean {
  return isActive(item) && amountOf(item) === 0
}

function handleAmountInput(catalogId: string, value: string) {
  const num = Number(value)
  if (!Number.isNaN(num) && num >= 0) {
    emit('updateAmount', catalogId, num)
  }
}
</script>

<template>
  <div v-if="loading" class="space-y-2" aria-busy="true">
    <UiSkeleton v-for="n in 5" :key="n" class="h-14 w-full" />
  </div>

  <UiEmptyState v-else-if="catalog.length === 0" title="Chưa có dịch vụ nào" size="sm" />

  <ul v-else class="divide-y divide-ui-border">
    <li
      v-for="row in catalog"
      :key="row.id"
      class="grid gap-x-4 gap-y-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_11rem_12rem] sm:items-start"
      :data-test="`service-row-${row.id}`"
    >
      <div class="flex min-w-0 items-center gap-3 sm:pt-1">
        <UiToggle
          :model-value="isActive(row)"
          :aria-label="`Bật/tắt ${row.name}`"
          size="sm"
          @update:model-value="(value) => emit('toggle', row.id, value)"
        />
        <span class="truncate text-sm font-medium" :class="isActive(row) ? 'text-ui-primary' : 'text-ui-muted'">
          {{ row.name }}
        </span>
        <UiBadge v-if="row.isCustom" variant="neutral">Riêng</UiBadge>
      </div>

      <div class="grid grid-cols-2 gap-2 sm:contents">
        <UiSelect
          :model-value="effectivePricingType(row)"
          :options="PRICING_TYPE_OPTIONS"
          density="compact"
          :aria-label="`Cách tính phí ${row.name}`"
          @update:model-value="(value) => emit('updatePricingType', row.id, value as PricingType)"
        />

        <div>
          <UiInput
            density="compact"
            type="number"
            number-mode="currency"
            :model-value="String(amountOf(row))"
            :aria-label="`Đơn giá ${row.name}`"
            input-class="text-right"
            @change="(v) => handleAmountInput(row.id, v as string)"
          >
            <template #suffix>
              <span class="whitespace-nowrap pr-3 pl-1 text-xs text-ui-muted">₫/{{ UNIT_LABELS[effectivePricingType(row)] }}</span>
            </template>
          </UiInput>
          <p v-if="needsPrice(row)" class="mt-1 text-xs text-status-warning">Chưa đặt giá</p>
        </div>
      </div>
    </li>
  </ul>
</template>
