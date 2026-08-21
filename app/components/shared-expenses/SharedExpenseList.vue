<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { Building } from '~/types/buildings'
import type { SharedExpenseListItem } from '~/types/shared-expenses'
import { EXPENSE_CATEGORY_LABELS } from '~/utils/constants/operations-report'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  items: SharedExpenseListItem[]
  buildings: Building[]
  loading: boolean
  canWrite: boolean
  canAllocate: boolean
  allocatingId: string | null
  deactivatingId: string | null
  reactivatingId: string | null
}>()

const emit = defineEmits<{
  create: []
  allocate: [item: SharedExpenseListItem]
  edit: [item: SharedExpenseListItem]
  deactivate: [item: SharedExpenseListItem]
  reactivate: [item: SharedExpenseListItem]
}>()

const columns: UiTableColumn<SharedExpenseListItem>[] = [
  { key: 'name', label: 'Khoản chi' },
  { key: 'category', label: 'Loại' },
  { key: 'buildings', label: 'Tòa nhà' },
  { key: 'amount', label: 'Số tiền', numeric: true },
  { key: 'lifecycle', label: 'Sử dụng' },
  { key: 'allocation', label: 'Kỳ đã chọn' },
  { key: 'actions', action: true, width: 'w-48' },
]

function buildingNames(item: SharedExpenseListItem) {
  const names = item.buildingIds.map(id =>
    props.buildings.find(building => building.id === id)?.name ?? id,
  )
  return names.join(', ')
}
</script>

<template>
  <div data-shared-expenses-desktop class="hidden md:block">
    <UiTable
      :rows="items"
      :columns="columns"
      :loading="loading"
      :loading-rows="4"
      empty-title="Chưa có chi phí dùng chung"
      empty-description="Tạo khoản đầu tiên để phân bổ cho nhiều tòa nhà."
      caption="Danh sách chi phí dùng chung"
    >
      <template #cell-name="{ row }">
        <div class="min-w-0">
          <div class="font-medium text-ui-primary">{{ row.name }}</div>
          <p v-if="row.note" class="mt-0.5 max-w-xs truncate text-xs text-ui-muted">{{ row.note }}</p>
        </div>
      </template>

      <template #cell-category="{ row }">
        <span class="whitespace-nowrap text-ui-muted">{{ EXPENSE_CATEGORY_LABELS[row.category] }}</span>
      </template>

      <template #cell-buildings="{ row }">
        <span class="whitespace-nowrap text-ui-muted" :title="buildingNames(row)">
          {{ row.buildingIds.length }} tòa nhà
        </span>
      </template>

      <template #cell-amount="{ row }">
        <span class="whitespace-nowrap tabular-nums font-medium text-ui-primary">
          {{ formatCurrency(row.amount) }}
        </span>
      </template>

      <template #cell-lifecycle="{ row }">
        <UiStatusBadge :status="row.isActive ? 'active' : 'inactive'" context="entity" />
      </template>

      <template #cell-allocation="{ row }">
        <UiStatusBadge
          :status="row.isAllocatedForPeriod ? 'allocated' : 'not_allocated'"
          context="shared-expense-allocation"
        />
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <UiButton
            v-if="canAllocate"
            size="sm"
            variant="secondary"
            :loading="allocatingId === row.id"
            :disabled="!row.isActive || row.isAllocatedForPeriod"
            :title="!row.isActive ? 'Khoản chi đã ngừng sử dụng' : row.isAllocatedForPeriod ? 'Kỳ này đã được phân bổ' : undefined"
            @click="emit('allocate', row)"
          >
            <IconLayers class="size-4" aria-hidden="true" />
            {{ row.isAllocatedForPeriod ? 'Đã phân bổ' : 'Phân bổ' }}
          </UiButton>

          <UiDropdownMenu v-if="canWrite" aria-label="Hành động khoản chi">
            <UiDropdownMenuItem @click="emit('edit', row)">
              <template #icon><IconPencilSquare class="size-4" aria-hidden="true" /></template>
              Sửa
            </UiDropdownMenuItem>
            <UiDropdownMenuItem
              v-if="row.isActive"
              variant="danger"
              :loading="deactivatingId === row.id"
              @click="emit('deactivate', row)"
            >
              <template #icon><IconXCircle class="size-4" aria-hidden="true" /></template>
              Ngừng sử dụng
            </UiDropdownMenuItem>
            <UiDropdownMenuItem
              v-else
              :loading="reactivatingId === row.id"
              @click="emit('reactivate', row)"
            >
              <template #icon><IconPlay class="size-4" aria-hidden="true" /></template>
              Kích hoạt lại
            </UiDropdownMenuItem>
          </UiDropdownMenu>
        </div>
      </template>

      <template v-if="canWrite" #emptyAction>
        <UiButton size="sm" @click="emit('create')">
          <IconPlus class="size-4" aria-hidden="true" />
          Tạo khoản chi
        </UiButton>
      </template>
    </UiTable>
  </div>

  <div data-shared-expenses-mobile class="space-y-3 md:hidden" :aria-busy="loading">
    <template v-if="loading">
      <UiSurfacePanel v-for="index in 4" :key="index" density="compact" class="space-y-3">
        <UiSkeleton class="h-5 w-2/3" />
        <UiSkeleton class="h-4 w-full" />
        <UiSkeleton class="h-8 w-full" />
      </UiSurfacePanel>
    </template>
    <SharedExpenseMobileRow
      v-for="item in items"
      v-else
      :key="item.id"
      :item="item"
      :building-count="item.buildingIds.length"
      :can-write="canWrite"
      :can-allocate="canAllocate"
      :allocating="allocatingId === item.id"
      :deactivating="deactivatingId === item.id"
      :reactivating="reactivatingId === item.id"
      @allocate="emit('allocate', item)"
      @edit="emit('edit', item)"
      @deactivate="emit('deactivate', item)"
      @reactivate="emit('reactivate', item)"
    />
    <UiEmptyState
      v-if="!loading && items.length === 0"
      title="Chưa có chi phí dùng chung"
      description="Tạo khoản đầu tiên để phân bổ cho nhiều tòa nhà."
    >
      <template v-if="canWrite" #action>
        <UiButton size="sm" @click="emit('create')">
          <IconPlus class="size-4" aria-hidden="true" />
          Tạo khoản chi
        </UiButton>
      </template>
    </UiEmptyState>
  </div>
</template>
