<script setup lang="ts">
import type { BuildingReadiness } from '~/types/building-contract-profile'
import { summarizeRequiredSteps } from '~/utils/building-setup-steps'

const props = defineProps<{ readiness: BuildingReadiness, setupPath: string, createContractPath: string }>()
const summary = computed(() => summarizeRequiredSteps(props.readiness))
</script>

<template>
  <UiSurfacePanel as="section" density="compact" data-test="building-setup-strip">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="min-w-0 text-sm" :class="summary.ready ? 'text-status-success' : 'text-ui-primary'">
        <template v-if="summary.ready">
          Sẵn sàng lập hợp đồng
        </template>
        <template v-else>
          Thiết lập {{ summary.requiredReady }}/{{ summary.requiredTotal }}
          <span class="text-ui-muted"> · Còn thiếu: {{ summary.missingLabels.join(', ') }}</span>
        </template>
      </p>
      <NuxtLink
        v-if="summary.ready"
        :to="createContractPath"
        class="inline-flex items-center justify-center rounded-md border border-ui-border bg-ui-surface px-3 py-1.5 text-xs font-medium text-ui-primary transition-colors hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
      >
        Lập hợp đồng
      </NuxtLink>
      <NuxtLink
        v-else
        :to="setupPath"
        class="inline-flex items-center justify-center rounded-md bg-ui-accent px-3 py-1.5 text-xs font-medium text-ui-on-accent transition-colors hover:bg-ui-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent"
      >
        Tiếp tục thiết lập
      </NuxtLink>
    </div>
  </UiSurfacePanel>
</template>
