<script setup lang="ts">
import { computed } from 'vue'
import type { InventoryItem } from '~/types/inventory'
import { INVENTORY_CONDITION_LABELS } from '~/types/inventory'
import { inventoryTotalValue } from '~/utils/mappers/inventory'
import { formatCurrency } from '~/utils/format/currency'

const props = withDefaults(defineProps<{
  items: InventoryItem[]
  emptyText?: string
  sourceNote?: string | null
}>(), {
  emptyText: 'Không có dữ liệu',
  sourceNote: null,
})

const total = computed(() => inventoryTotalValue(props.items))
</script>

<template>
  <div class="space-y-3">
    <p v-if="sourceNote" class="text-xs text-ui-muted">{{ sourceNote }}</p>

    <p v-if="items.length === 0" class="text-sm text-ui-muted">{{ emptyText }}</p>

    <template v-else>
      <ul class="divide-y divide-ui-border rounded-lg border border-ui-border">
        <li v-for="item in items" :key="item.id" class="flex items-start justify-between gap-3 p-3">
          <div class="min-w-0">
            <p class="truncate font-medium text-ui-primary">{{ item.name }}</p>
            <p class="text-xs text-ui-muted">
              SL {{ item.quantity }} · {{ INVENTORY_CONDITION_LABELS[item.condition] }}
              <span v-if="item.note"> · {{ item.note }}</span>
            </p>
          </div>
          <p v-if="item.unitValue !== null" class="shrink-0 text-sm text-ui-secondary">
            {{ formatCurrency(item.unitValue * item.quantity) }}
          </p>
        </li>
      </ul>
      <p class="text-right text-sm text-ui-muted">
        Tổng giá trị tham chiếu:
        <span class="font-medium text-ui-primary">{{ formatCurrency(total) }}</span>
      </p>
    </template>
  </div>
</template>
