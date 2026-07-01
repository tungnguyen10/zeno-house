<script setup lang="ts">
interface WizardStep {
  value: number
  label: string
}

const props = defineProps<{
  currentStep: number
  completedSteps?: number[]
  steps?: WizardStep[]
}>()

const emit = defineEmits<{
  change: [step: number]
}>()

const steps = computed(() => props.steps ?? [
  { value: 1, label: 'Hợp đồng' },
  { value: 2, label: 'Khách ở cùng' },
  { value: 3, label: 'Dịch vụ' },
])

function canVisit(step: number) {
  return step <= props.currentStep || (props.completedSteps ?? []).includes(step)
}
</script>

<template>
  <nav aria-label="Tiến trình tạo hợp đồng" class="rounded-lg border border-dark-border bg-dark-surface p-3">
    <ol class="grid grid-cols-3 gap-2">
      <li v-for="step in steps" :key="step.value">
        <UiButton
          unstyled
          class="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors"
          :class="[
            step.value === currentStep
              ? 'border-cyan/60 bg-cyan/10 text-white'
              : canVisit(step.value)
                ? 'border-dark-border bg-dark-hover/50 text-white hover:border-cyan/40'
                : 'border-dark-border bg-dark-deep/40 text-muted',
          ]"
          :disabled="!canVisit(step.value)"
          @click="emit('change', step.value)"
        >
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
            :class="(completedSteps ?? []).includes(step.value)
              ? 'border-cyan bg-cyan text-dark-deep'
              : step.value === currentStep
                ? 'border-cyan text-cyan'
                : 'border-dark-border text-muted'"
          >
            {{ (completedSteps ?? []).includes(step.value) ? '✓' : step.value }}
          </span>
          <span class="truncate">{{ step.label }}</span>
        </UiButton>
      </li>
    </ol>
  </nav>
</template>
