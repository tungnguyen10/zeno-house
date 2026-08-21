<script setup lang="ts">
import type { SharedExpenseListItem } from '~/types/shared-expenses'
import { EXPENSE_CATEGORY_LABELS } from '~/utils/constants/operations-report'
import { formatCurrency } from '~/utils/format/currency'

defineProps<{
  item: SharedExpenseListItem
  buildingCount: number
  canWrite: boolean
  canAllocate: boolean
  allocating: boolean
  deactivating: boolean
  reactivating: boolean
}>()

const emit = defineEmits<{
  allocate: []
  edit: []
  deactivate: []
  reactivate: []
}>()
</script>

<template>
  <UiSurfacePanel as="article" density="compact" class="space-y-3">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate text-sm font-semibold text-ui-primary">{{ item.name }}</h3>
        <p v-if="item.note" class="mt-0.5 line-clamp-2 text-xs text-ui-muted">{{ item.note }}</p>
      </div>
      <span class="shrink-0 tabular-nums text-sm font-semibold text-ui-primary">
        {{ formatCurrency(item.amount) }}
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-1.5 text-xs text-ui-muted">
      <span>{{ EXPENSE_CATEGORY_LABELS[item.category] }}</span>
      <span aria-hidden="true">·</span>
      <span>{{ buildingCount }} tòa nhà</span>
      <UiStatusBadge :status="item.isActive ? 'active' : 'inactive'" context="entity" />
      <UiStatusBadge
        :status="item.isAllocatedForPeriod ? 'allocated' : 'not_allocated'"
        context="shared-expense-allocation"
      />
    </div>

    <div class="flex items-center justify-between gap-2 border-t border-ui-border pt-3">
      <UiButton
        v-if="canAllocate"
        size="sm"
        variant="secondary"
        class="min-h-11 whitespace-nowrap"
        :loading="allocating"
        :disabled="!item.isActive || item.isAllocatedForPeriod"
        :title="!item.isActive ? 'Khoản chi đã ngừng sử dụng' : item.isAllocatedForPeriod ? 'Kỳ này đã được phân bổ' : undefined"
        @click="emit('allocate')"
      >
        <IconLayers class="size-4" aria-hidden="true" />
        {{ item.isAllocatedForPeriod ? 'Đã phân bổ' : 'Phân bổ' }}
      </UiButton>
      <span v-else />

      <UiDropdownMenu
        v-if="canWrite"
        class="[&>button]:size-11"
        aria-label="Hành động khoản chi"
      >
        <UiDropdownMenuItem @click="emit('edit')">
          <template #icon><IconPencilSquare class="size-4" aria-hidden="true" /></template>
          Sửa
        </UiDropdownMenuItem>
        <UiDropdownMenuItem
          v-if="item.isActive"
          variant="danger"
          :loading="deactivating"
          @click="emit('deactivate')"
        >
          <template #icon><IconXCircle class="size-4" aria-hidden="true" /></template>
          Ngừng sử dụng
        </UiDropdownMenuItem>
        <UiDropdownMenuItem v-else :loading="reactivating" @click="emit('reactivate')">
          <template #icon><IconPlay class="size-4" aria-hidden="true" /></template>
          Kích hoạt lại
        </UiDropdownMenuItem>
      </UiDropdownMenu>
    </div>
  </UiSurfacePanel>
</template>
