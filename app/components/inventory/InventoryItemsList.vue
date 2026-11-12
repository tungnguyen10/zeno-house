<script setup lang="ts">
import { INVENTORY_CONDITION_LABELS, type InventoryItem } from '~/types/inventory'

withDefaults(defineProps<{
  items: InventoryItem[]
  emptyText?: string
  sourceNote?: string | null
}>(), {
  emptyText: 'Chưa có dữ liệu nội thất.',
  sourceNote: null,
})

const conditionVariant = { good: 'success', used: 'neutral', damaged: 'danger' } as const
</script>

<template>
  <div class="min-w-0 space-y-2">
    <p v-if="sourceNote" class="text-xs text-ui-muted">{{ sourceNote }}</p>
    <p v-if="items.length === 0" class="rounded-xl border border-dashed border-ui-border px-4 py-6 text-center text-sm text-ui-muted">
      {{ emptyText }}
    </p>
    <ul v-else class="divide-y divide-ui-border overflow-hidden rounded-xl border border-ui-border">
      <li v-for="item in items" :key="item.id" class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2.5">
        <div class="min-w-0">
          <p class="break-words text-sm font-medium text-ui-primary">
            {{ item.name }}
            <span class="font-normal tabular-nums text-ui-muted">× {{ item.quantity }}</span>
          </p>
          <p v-if="item.note" class="break-words text-xs text-ui-muted">{{ item.note }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span v-if="item.unitValue !== null" class="text-xs tabular-nums text-ui-muted">{{ item.unitValue.toLocaleString('vi-VN') }} đ</span>
          <UiBadge :variant="conditionVariant[item.condition]">{{ INVENTORY_CONDITION_LABELS[item.condition] }}</UiBadge>
        </div>
      </li>
    </ul>
  </div>
</template>
