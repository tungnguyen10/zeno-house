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
    size="sm"
    title="Không có việc tồn"
    description="Mọi kỳ vận hành đã ổn. Quay lại sau khi có cảnh báo mới."
  />
  <div v-else data-pending-list class="overflow-hidden">
    <NuxtLink
      v-for="item in items"
      :key="`${item.type}-${item.building.id}-${item.period}`"
      :to="pendingOperationPath(item)"
      class="grid grid-cols-[0.5rem_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-ui-border px-1 py-3 last:border-b-0 hover:bg-ui-hover active:bg-ui-hover sm:grid-cols-[14px_minmax(7rem,_8rem)_1fr_5rem_3rem_minmax(5rem,_7rem)] sm:gap-y-0 sm:px-3"
    >
      <span class="col-start-1 row-span-2 row-start-1 inline-block h-2 w-2 shrink-0 rounded-full sm:col-start-auto sm:row-span-1 sm:row-start-auto" :class="pendingOperationSeverityDotClass(item.severity)" aria-hidden="true" />
      <span class="col-start-2 row-start-2 text-xs text-ui-muted sm:col-start-auto sm:row-start-auto sm:font-medium sm:text-ui-primary">{{ pendingOperationLabel(item.type) }}</span>
      <span class="col-span-2 col-start-2 row-start-1 min-w-0 truncate text-sm font-medium text-ui-primary sm:col-span-1 sm:col-start-auto sm:row-start-auto sm:font-normal">{{ item.building.name }}</span>
      <span class="col-start-3 row-start-2 truncate text-xs text-ui-muted sm:col-start-auto sm:row-start-auto">{{ formatPeriodDisplay(item.period) }}</span>
      <span class="col-start-4 row-start-2 text-right text-xs tabular-nums text-ui-muted sm:col-start-auto sm:row-start-auto sm:text-sm">{{ item.count }}</span>
      <span class="col-start-4 row-start-1 whitespace-nowrap text-right text-sm tabular-nums sm:col-start-auto sm:row-start-auto" :class="item.amount && item.amount > 0 ? 'text-status-danger font-medium' : 'text-ui-muted'">
        {{ item.amount !== undefined ? formatCurrency(item.amount) : '—' }}
      </span>
    </NuxtLink>
  </div>
</template>
