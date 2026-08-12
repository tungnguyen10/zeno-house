<script setup lang="ts">
import type { PendingOperation } from '~/types/dashboard'
import { pendingOperationPath } from '~/utils/routes/operational'
import { formatCurrency } from '~/utils/format/currency'
import { formatPeriodDisplay } from '~/utils/format/period'
import {
  pendingOperationLabel,
  pendingOperationSeverityDotClass,
} from '~/utils/constants/dashboard-operations'

defineProps<{
  items: PendingOperation[]
}>()

</script>

<template>
  <UiEmptyState
    v-if="!items.length"
    variant="success"
    title="Không có việc tồn"
    description="Mọi kỳ vận hành đã ổn. Quay lại sau khi có cảnh báo mới."
  />
  <div v-else data-pending-list class="overflow-hidden">
    <NuxtLink
      v-for="item in items"
      :key="`${item.type}-${item.building.id}-${item.period}`"
      :to="pendingOperationPath(item)"
      class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-dark-border px-2 py-3 last:border-b-0 hover:bg-dark-hover sm:grid sm:grid-cols-[14px_minmax(7rem,_8rem)_1fr_5rem_3rem_minmax(5rem,_7rem)] sm:gap-y-0 sm:px-3"
    >
      <span class="inline-block h-2 w-2 shrink-0 rounded-full" :class="pendingOperationSeverityDotClass(item.severity)" aria-hidden="true" />
      <span class="text-xs font-medium text-white">{{ pendingOperationLabel(item.type) }}</span>
      <span class="min-w-0 flex-1 truncate text-sm text-white sm:flex-none">{{ item.building.name }}</span>
      <span class="text-xs text-muted">{{ formatPeriodDisplay(item.period) }}</span>
      <span class="ml-auto text-right text-sm tabular-nums text-muted sm:ml-0">{{ item.count }}</span>
      <span class="text-right text-sm tabular-nums" :class="item.amount && item.amount > 0 ? 'text-error-vivid font-medium' : 'text-muted'">
        {{ item.amount !== undefined ? formatCurrency(item.amount) : '—' }}
      </span>
    </NuxtLink>
  </div>
</template>
