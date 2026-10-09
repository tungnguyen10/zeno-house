<script setup lang="ts">
import type { ContractService } from '~/types/contract-services'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'

const props = defineProps<{
  services: ContractService[]
  loading?: boolean
  canDelete?: boolean
}>()

const emit = defineEmits<{
  (e: 'update', id: string, data: ContractServiceUpdateInput): void
  (e: 'delete', id: string): void
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

const columns = computed<UiTableColumn<ContractService>[]>(() => [
  { key: 'name', label: 'Dịch vụ' },
  { key: 'amount', label: 'Đơn giá', numeric: true, width: 'w-36' },
  { key: 'quantity', label: 'Số lượng', numeric: true, width: 'w-24' },
  { key: 'subtotal', label: 'Thành tiền', numeric: true },
  { key: 'toggle', label: 'Bật/Tắt', width: 'w-24' },
  { key: 'notes', label: 'Ghi chú' },
  ...(props.canDelete ? [{ key: 'actions', label: '', width: 'w-12' } as UiTableColumn<ContractService>] : []),
])
</script>

<template>
  <!-- Mobile: card list, desktop table columns don't fit comfortably at this density -->
  <div class="divide-y divide-ui-border overflow-hidden rounded-xl border border-ui-border bg-ui-surface md:hidden">
    <div v-if="loading" class="space-y-2 p-3">
      <UiSkeleton class="h-20 w-full" />
      <UiSkeleton class="h-20 w-full" />
    </div>
    <UiEmptyState
      v-else-if="services.length === 0"
      title="Chưa có dịch vụ nào"
      description="Chưa có dịch vụ nào được cấu hình cho hợp đồng này"
    />
    <div v-for="service in services" v-else :key="service.id" class="flex flex-col gap-2 p-3">
      <div class="flex items-start justify-between gap-2">
        <span :class="[!service.isEnabled && 'opacity-50', 'min-w-0 truncate text-sm font-medium text-ui-primary']">
          {{ service.catalog.name }}
        </span>
        <div class="flex shrink-0 items-center gap-2">
          <UiToggle
            :model-value="service.isEnabled"
            :aria-label="`Bật/tắt ${service.catalog.name}`"
            size="sm"
            @update:model-value="handleToggle(service)"
          />
          <UiButton
            v-if="canDelete"
            unstyled
            class="rounded p-1 text-ui-muted transition-colors hover:bg-status-danger/10 hover:text-status-danger focus-visible:outline-none"
            :aria-label="`Xoá dịch vụ ${service.catalog.name}`"
            @click="emit('delete', service.id)"
          >
            <IconTrash class="h-4 w-4" aria-hidden="true" />
          </UiButton>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <UiInput
          label="Đơn giá"
          density="compact"
          type="number"
          number-mode="currency"
          :model-value="String(service.amount)"
          @update:model-value="(v) => handleAmountInput(service, v as string)"
        />
        <UiInput
          label="Số lượng"
          density="compact"
          type="number"
          number-mode="integer"
          :model-value="String(service.quantity)"
          @update:model-value="(v) => handleQuantityInput(service, v as string)"
        />
      </div>
      <UiInput
        label="Ghi chú"
        density="compact"
        type="text"
        :model-value="service.notes ?? ''"
        placeholder="Ghi chú..."
        @update:model-value="(v) => handleNotesInput(service, v as string)"
      />
      <div class="flex items-center justify-between text-xs">
        <span class="text-ui-muted">Thành tiền</span>
        <span :class="[!service.isEnabled && 'line-through text-ui-muted', 'font-medium text-ui-primary']">
          {{ subtotal(service).toLocaleString('vi-VN') }}đ
        </span>
      </div>
    </div>
  </div>

  <!-- Desktop: dense table -->
  <UiTable
    :rows="services"
    :columns="columns"
    :loading="loading"
    empty-title="Chưa có dịch vụ nào"
    empty-description="Chưa có dịch vụ nào được cấu hình cho hợp đồng này"
    class="hidden md:block"
  >
    <template #cell-name="{ row }">
      <span :class="[!row.isEnabled && 'opacity-50', 'font-medium text-ui-primary']">{{ row.catalog.name }}</span>
    </template>

    <template #cell-amount="{ row }">
      <UiInput
        density="compact"
        type="number"
        number-mode="currency"
        :model-value="String(row.amount)"
        class="w-28"
        @update:model-value="(v) => handleAmountInput(row, v as string)"
      />
    </template>

    <template #cell-quantity="{ row }">
      <UiInput
        density="compact"
        type="number"
        number-mode="integer"
        :model-value="String(row.quantity)"
        class="w-16"
        @update:model-value="(v) => handleQuantityInput(row, v as string)"
      />
    </template>

    <template #cell-subtotal="{ row }">
      <span :class="[!row.isEnabled && 'line-through text-ui-muted', 'font-medium text-ui-primary']">
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

    <template v-if="canDelete" #cell-actions="{ row }">
      <div class="flex justify-center">
        <UiButton
          unstyled
          class="rounded p-1 text-ui-muted transition-colors hover:bg-status-danger/10 hover:text-status-danger focus-visible:outline-none"
          :aria-label="`Xoá dịch vụ ${row.catalog.name}`"
          @click="emit('delete', row.id)"
        >
          <IconTrash class="h-4 w-4" aria-hidden="true" />
        </UiButton>
      </div>
    </template>
  </UiTable>
</template>
