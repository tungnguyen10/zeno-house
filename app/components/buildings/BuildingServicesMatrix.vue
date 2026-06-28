<script setup lang="ts">
import type { ServiceCatalogItem } from '~/types/service-catalog'
import type { ContractService } from '~/types/contract-services'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'

interface ContractRow {
  contractId: string
  roomNumber: string
  tenantName: string
}

const props = defineProps<{
  buildingId: string
  catalog: ServiceCatalogItem[]          // active catalog items for this building
  contracts: ContractRow[]               // active contracts
  services: ContractService[]            // all contract_services rows for this building
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update', id: string, data: ContractServiceUpdateInput): void
}>()

// Only show services that are active at building level
const activeCatalog = computed(() =>
  props.catalog.filter(item =>
    props.services.some(s => s.catalogId === item.id),
  ),
)

function getService(contractId: string, catalogId: string): ContractService | undefined {
  return props.services.find(s => s.contractId === contractId && s.catalogId === catalogId)
}

function handleAmountInput(service: ContractService, value: string) {
  const amount = Number(value)
  if (!Number.isNaN(amount) && amount >= 0) {
    emit('update', service.id, { amount })
  }
}

function handleQuantityInput(service: ContractService, value: string) {
  const quantity = Number(value)
  if (Number.isInteger(quantity) && quantity >= 1) {
    emit('update', service.id, { quantity })
  }
}

function handleToggle(service: ContractService) {
  emit('update', service.id, { is_enabled: !service.isEnabled })
}
</script>

<template>
  <!-- Note: This component uses a raw <table> with sticky first column, which cannot
       be cleanly represented by UiTable (which does not support sticky columns).
       The cell controls (toggles, inputs) use ui primitives. -->
  <div class="overflow-x-auto">
    <div v-if="loading" class="py-8 text-center text-sm text-muted">Đang tải...</div>
    <UiEmptyState
      v-else-if="contracts.length === 0"
      title="Không có hợp đồng active nào"
    />
    <table v-else class="min-w-full divide-y divide-dark-border text-sm">
      <thead class="bg-dark-card">
        <tr>
          <th class="sticky left-0 z-10 bg-dark-card px-4 py-3 text-left font-medium text-muted min-w-[160px]">
            Phòng / Khách
          </th>
          <th
            v-for="item in activeCatalog"
            :key="item.id"
            class="px-3 py-3 text-center font-medium text-muted min-w-[120px]"
          >
            {{ item.name }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-dark-border bg-dark-surface">
        <tr v-for="row in contracts" :key="row.contractId">
          <td class="sticky left-0 z-10 bg-dark-surface px-4 py-3">
            <p class="font-medium text-white">Phòng {{ row.roomNumber }}</p>
            <p class="text-xs text-muted truncate max-w-[140px]">{{ row.tenantName }}</p>
          </td>
          <td
            v-for="item in activeCatalog"
            :key="item.id"
            class="px-3 py-2 text-center"
          >
            <template v-if="getService(row.contractId, item.id)">
              <div class="flex flex-col items-center gap-1">
                <!-- Toggle -->
                <UiToggle
                  :model-value="getService(row.contractId, item.id)!.isEnabled"
                  size="sm"
                  :aria-label="`Bật/tắt ${item.name} cho phòng ${row.roomNumber}`"
                  @update:model-value="handleToggle(getService(row.contractId, item.id)!)"
                />
                <!-- Amount input -->
                <UiInput
                  density="compact"
                  type="number"
                  :model-value="String(getService(row.contractId, item.id)!.amount)"
                  :disabled="!getService(row.contractId, item.id)!.isEnabled"
                  class="w-20 text-center"
                  @change="(v) => handleAmountInput(getService(row.contractId, item.id)!, v as string)"
                />
                <!-- Quantity input -->
                <UiInput
                  density="compact"
                  type="number"
                  :model-value="String(getService(row.contractId, item.id)!.quantity)"
                  :disabled="!getService(row.contractId, item.id)!.isEnabled"
                  class="w-12 text-center"
                  @change="(v) => handleQuantityInput(getService(row.contractId, item.id)!, v as string)"
                />
              </div>
            </template>
            <span v-else class="text-xs text-dark-border">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
