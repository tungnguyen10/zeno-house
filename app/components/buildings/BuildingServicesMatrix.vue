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

function handleAmountBlur(service: ContractService, event: Event) {
  const amount = Number((event.target as HTMLInputElement).value)
  if (!Number.isNaN(amount) && amount >= 0) {
    emit('update', service.id, { amount })
  }
}

function handleQuantityBlur(service: ContractService, event: Event) {
  const quantity = Number((event.target as HTMLInputElement).value)
  if (Number.isInteger(quantity) && quantity >= 1) {
    emit('update', service.id, { quantity })
  }
}

function handleToggle(service: ContractService) {
  emit('update', service.id, { is_enabled: !service.isEnabled })
}
</script>

<template>
  <div class="overflow-x-auto">
    <div v-if="loading" class="py-8 text-center text-sm text-gray-500">Đang tải...</div>
    <div v-else-if="contracts.length === 0" class="py-8 text-center text-sm text-gray-500">
      Không có hợp đồng active nào.
    </div>
    <table v-else class="min-w-full divide-y divide-gray-200 text-sm">
      <thead class="bg-gray-50">
        <tr>
          <th class="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-medium text-gray-700 min-w-[160px]">
            Phòng / Khách
          </th>
          <th
            v-for="item in activeCatalog"
            :key="item.id"
            class="px-3 py-3 text-center font-medium text-gray-700 min-w-[120px]"
          >
            {{ item.name }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100 bg-white">
        <tr v-for="row in contracts" :key="row.contractId">
          <td class="sticky left-0 z-10 bg-white px-4 py-3">
            <p class="font-medium text-gray-900">Phòng {{ row.roomNumber }}</p>
            <p class="text-xs text-gray-500 truncate max-w-[140px]">{{ row.tenantName }}</p>
          </td>
          <td
            v-for="item in activeCatalog"
            :key="item.id"
            class="px-3 py-2 text-center"
          >
            <template v-if="getService(row.contractId, item.id)">
              <div class="flex flex-col items-center gap-1">
                <!-- Toggle -->
                <button
                  type="button"
                  :class="[
                    'relative inline-flex h-4 w-8 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                    getService(row.contractId, item.id)!.isEnabled ? 'bg-blue-600' : 'bg-gray-200',
                  ]"
                  @click="handleToggle(getService(row.contractId, item.id)!)"
                >
                  <span
                    :class="[
                      'pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition duration-200 ease-in-out',
                      getService(row.contractId, item.id)!.isEnabled ? 'translate-x-4' : 'translate-x-0',
                    ]"
                  />
                </button>
                <!-- Amount input -->
                <input
                  type="number"
                  min="0"
                  step="1000"
                  :value="getService(row.contractId, item.id)!.amount"
                  :disabled="!getService(row.contractId, item.id)!.isEnabled"
                  class="w-20 rounded border border-gray-200 px-1 py-0.5 text-center text-xs focus:border-blue-500 focus:outline-none disabled:opacity-40"
                  @blur="handleAmountBlur(getService(row.contractId, item.id)!, $event)"
                >
                <!-- Quantity input -->
                <input
                  type="number"
                  min="1"
                  step="1"
                  :value="getService(row.contractId, item.id)!.quantity"
                  :disabled="!getService(row.contractId, item.id)!.isEnabled"
                  class="w-12 rounded border border-gray-200 px-1 py-0.5 text-center text-xs focus:border-blue-500 focus:outline-none disabled:opacity-40"
                  title="Số lượng"
                  @blur="handleQuantityBlur(getService(row.contractId, item.id)!, $event)"
                >
              </div>
            </template>
            <span v-else class="text-xs text-gray-300">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
