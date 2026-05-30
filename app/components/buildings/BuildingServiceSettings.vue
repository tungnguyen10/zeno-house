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

const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  fixed_per_room: 'Cố định / phòng',
  per_person: 'Theo người',
  per_vehicle: 'Theo xe',
}

function getService(catalogId: string): BuildingService | undefined {
  return props.services.find(s => s.catalogId === catalogId)
}

function effectivePricingType(item: ServiceCatalogItem): PricingType {
  return getService(item.id)?.pricingType ?? item.pricingType
}

function handleToggle(catalogId: string, current: boolean) {
  emit('toggle', catalogId, !current)
}

function handleAmountBlur(catalogId: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isNaN(value) && value >= 0) {
    emit('updateAmount', catalogId, value)
  }
}

function handlePricingTypeChange(catalogId: string, event: Event) {
  const value = (event.target as HTMLSelectElement).value as PricingType
  emit('updatePricingType', catalogId, value)
}
</script>

<template>
  <div class="overflow-x-auto">
    <div v-if="loading" class="py-8 text-center text-sm text-muted">Đang tải...</div>
    <table v-else class="min-w-full divide-y divide-dark-border text-sm">
      <thead class="bg-dark-card">
        <tr>
          <th class="px-4 py-3 text-left font-medium text-muted">Dịch vụ</th>
          <th class="px-4 py-3 text-left font-medium text-muted">Loại tính phí</th>
          <th class="px-4 py-3 text-right font-medium text-muted">Đơn giá mặc định</th>
          <th class="px-4 py-3 text-center font-medium text-muted">Kích hoạt</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-dark-border bg-dark-surface">
        <tr v-for="item in catalog" :key="item.id">
          <td class="px-4 py-3 font-medium text-white">{{ item.name }}</td>
          <td class="px-4 py-3">
            <select
              :value="effectivePricingType(item)"
              class="rounded border border-dark-border bg-dark-surface px-2 py-1 text-sm text-white focus:border-cyan/70 focus:ring-1 focus:ring-cyan/30 focus:outline-none"
              @change="handlePricingTypeChange(item.id, $event)"
            >
              <option v-for="(label, type) in PRICING_TYPE_LABELS" :key="type" :value="type">
                {{ label }}
              </option>
            </select>
          </td>
          <td class="px-4 py-3 text-right">
            <input
              type="number"
              min="0"
              step="1000"
              :value="getService(item.id)?.defaultAmount ?? 0"
              class="w-32 rounded border border-dark-border bg-dark-surface px-2 py-1 text-right text-sm text-white focus:border-cyan/70 focus:ring-1 focus:ring-cyan/30 focus:outline-none"
              @blur="handleAmountBlur(item.id, $event)"
            >
          </td>
          <td class="px-4 py-3 text-center">
            <button
              type="button"
              :class="[
                'relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                getService(item.id)?.isActive ? 'bg-cyan' : 'bg-dark-border',
              ]"
              :aria-label="`Bật/tắt ${item.name}`"
              @click="handleToggle(item.id, getService(item.id)?.isActive ?? false)"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  getService(item.id)?.isActive ? 'translate-x-4' : 'translate-x-0',
                ]"
              />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
