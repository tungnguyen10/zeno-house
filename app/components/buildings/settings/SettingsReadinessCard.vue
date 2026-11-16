<script setup lang="ts">
import type { SetupFlow, SetupStepId } from '~/utils/building-setup-steps'

const props = defineProps<{
  flow: SetupFlow
  createContractPath: string
}>()

const emit = defineEmits<{ 'open-step': [id: SetupStepId] }>()

const nextStep = computed(() => props.flow.steps.find(step => step.id === props.flow.nextStepId) ?? null)
const percent = computed(() =>
  props.flow.requiredTotal === 0 ? 0 : Math.round((props.flow.requiredReady / props.flow.requiredTotal) * 100),
)
</script>

<template>
  <UiSurfacePanel as="section" density="compact" data-test="setup-readiness">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold" :class="flow.ready ? 'text-status-success' : 'text-ui-primary'">
          {{ flow.ready ? 'Sẵn sàng lập hợp đồng' : 'Chưa sẵn sàng lập hợp đồng' }}
        </h2>
        <p class="mt-0.5 text-xs text-ui-muted" data-test="setup-progress">
          {{ flow.requiredReady }}/{{ flow.requiredTotal }} bước bắt buộc đã xong
        </p>
      </div>
      <NuxtLink
        v-if="flow.ready"
        :to="createContractPath"
        data-test="setup-create-contract"
        class="inline-flex items-center justify-center rounded-md bg-ui-accent px-3 py-1.5 text-xs font-medium text-ui-on-accent transition-colors hover:bg-ui-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent"
      >
        Lập hợp đồng
      </NuxtLink>
      <UiButton v-else-if="nextStep" size="sm" data-test="setup-next" @click="emit('open-step', nextStep.id)">
        Tiếp tục: {{ nextStep.label }}
      </UiButton>
    </div>
    <div
      class="mt-3 h-1.5 overflow-hidden rounded-full bg-ui-border"
      role="progressbar"
      aria-label="Tiến độ thiết lập"
      :aria-valuemin="0"
      :aria-valuemax="flow.requiredTotal"
      :aria-valuenow="flow.requiredReady"
    >
      <div class="h-full rounded-full bg-ui-accent transition-[width] motion-reduce:transition-none" :style="{ width: `${percent}%` }" />
    </div>
  </UiSurfacePanel>
</template>
