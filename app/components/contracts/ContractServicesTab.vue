<script setup lang="ts">
import type { ContractService } from '~/types/contract-services'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'

defineProps<{
  services: ContractService[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update', id: string, data: ContractServiceUpdateInput): void
}>()

function subtotal(s: ContractService): number {
  return s.isEnabled ? s.amount * s.quantity : 0
}

function handleAmountInput(s: ContractService, value: string) {
  const amount = Number(value)
  if (!Number.isNaN(amount) && amount >= 0) {
    emit('update', s.id, { amount })
  }
}

function handleQuantityInput(s: ContractService, value: string) {
  const quantity = Number(value)
  if (Number.isInteger(quantity) && quantity >= 1) {
    emit('update', s.id, { quantity })
  }
}

function handleToggle(s: ContractService) {
  emit('update', s.id, { is_enabled: !s.isEnabled })
}

function handleNotesInput(s: ContractService, value: string) {
  const notes = value.trim() || null
  emit('update', s.id, { notes })
}

const columns: UiTableColumn<ContractService>[] = [
  { key: 'name', label: 'Dịch vụ' },
  { key: 'amount', label: 'Đơn giá', numeric: true, width: 'w-36' },
  { key: 'quantity', label: 'Số lượng', numeric: true, width: 'w-24' },
  { key: 'subtotal', label: 'Thành tiền', numeric: true },
  { key: 'toggle', label: 'Bật/Tắt', width: 'w-24' },
  { key: 'notes', label: 'Ghi chú' },
]
</script>

<template>
  <UiTable
    :rows="services"
    :columns="columns"
    :loading="loading"
    empty-title="Chưa có dịch vụ nào"
    empty-description="Chưa có dịch vụ nào được cấu hình cho hợp đồng này"
  >
    <template #cell-name="{ row }">
      <span :class="[!row.isEnabled && 'opacity-50', 'font-medium text-white']">{{ row.catalog.name }}</span>
    </template>

    <template #cell-amount="{ row }">
      <UiInput
        density="compact"
        type="number"
        :model-value="String(row.amount)"
        class="w-28"
        @update:model-value="(v) => handleAmountInput(row, v as string)"
      />
    </template>

    <template #cell-quantity="{ row }">
      <UiInput
        density="compact"
        type="number"
        :model-value="String(row.quantity)"
        class="w-16"
        @update:model-value="(v) => handleQuantityInput(row, v as string)"
      />
    </template>

    <template #cell-subtotal="{ row }">
      <span :class="[!row.isEnabled && 'line-through text-muted', 'font-medium text-white']">
        {{ subtotal(row).toLocaleString('vi-VN') }}đ
      </span>
    </template>

    <template #cell-toggle="{ row }">
      <div class="flex justify-center">
        <UiToggle
          :model-value="row.isEnabled"
          :aria-label="`Bật/tắt ${row.catalog.name}`"
          size="sm"
          @update:model-value="handleToggle(row)"
        />
      </div>
    </template>

    <template #cell-notes="{ row }">
      <UiInput
        density="compact"
        type="text"
        :model-value="row.notes ?? ''"
        placeholder="Ghi chú..."
        @update:model-value="(v) => handleNotesInput(row, v as string)"
      />
    </template>
  </UiTable>
</template>
