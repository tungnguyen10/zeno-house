<script setup lang="ts">
import type { SetupFlow, SetupStepId } from '~/utils/building-setup-steps'

const props = withDefaults(defineProps<{
  flow: SetupFlow
  createContractPath: string
  setupMode?: boolean
  buildingPath?: string
}>(), { setupMode: false, buildingPath: undefined })

const emit = defineEmits<{ 'open-step': [id: SetupStepId], 'exit-setup': [] }>()

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
      <div class="flex flex-wrap items-center gap-2">
        <template v-if="flow.ready">
          <NuxtLink v-if="setupMode && buildingPath" :to="buildingPath" data-test="setup-view-building">
            <UiButton size="sm" variant="secondary">Xem tòa nhà</UiButton>
          </NuxtLink>
          <NuxtLink :to="createContractPath" data-test="setup-create-contract">
            <UiButton size="sm">{{ setupMode ? 'Lập hợp đồng đầu tiên' : 'Lập hợp đồng' }}</UiButton>
          </NuxtLink>
        </template>
        <UiButton v-else-if="nextStep" size="sm" data-test="setup-next" @click="emit('open-step', nextStep.id)">
          Tiếp tục: {{ nextStep.label }}
        </UiButton>
        <UiButton v-if="setupMode" size="sm" variant="ghost" data-test="setup-exit" @click="emit('exit-setup')">
          Thoát thiết lập
        </UiButton>
      </div>
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
