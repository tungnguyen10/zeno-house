<script setup lang="ts">
import clsx from 'clsx'
import type { StepListItem } from '~/utils/building-setup-steps'

const props = withDefaults(defineProps<{
  steps: StepListItem[]
  openId: string | null
  numbered?: boolean
}>(), { numbered: true })

const emit = defineEmits<{ 'update:openId': [id: string | null] }>()

const BADGE_VARIANT: Record<StepListItem['status'], 'success' | 'warning' | 'neutral'> = {
  ready: 'success',
  missing: 'warning',
  warning: 'warning',
  optional: 'neutral',
}

function statusLabel(step: StepListItem): string {
  if (step.statusLabel) return step.statusLabel
  if (step.locked) return 'Cần chủ tòa'
  if (step.status === 'ready') return 'Hoàn tất'
  if (step.status === 'missing') return `Thiếu ${step.missingCount} mục`
  if (step.status === 'warning') return 'Cần xem lại'
  return 'Tùy chọn'
}

function toggle(step: StepListItem) {
  if (step.locked) return
  emit('update:openId', props.openId === step.id ? null : step.id)
}
</script>

<template>
  <ol class="space-y-3">
    <li
      v-for="(step, index) in steps"
      :id="step.id"
      :key="step.id"
      :data-test="`step-${step.id}`"
      :class="clsx(
        'scroll-mt-20 rounded-xl border bg-ui-surface',
        openId === step.id ? 'border-ui-accent/40' : 'border-ui-border',
      )"
    >
      <div class="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          :disabled="step.locked"
          :class="clsx(
            'flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40',
            step.locked && 'cursor-not-allowed opacity-70',
          )"
          :aria-expanded="openId === step.id"
          :aria-controls="`${step.id}-panel`"
          :data-test="`step-toggle-${step.id}`"
          @click="toggle(step)"
        >
          <span
            v-if="numbered"
            :class="clsx(
              'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              step.status === 'ready' ? 'bg-status-success/10 text-status-success' : 'bg-ui-hover text-ui-muted',
            )"
            aria-hidden="true"
          >
            <IconCheckSmall v-if="step.status === 'ready'" class="size-4" />
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block break-words text-sm font-medium text-ui-primary">{{ step.label }}</span>
            <span class="block break-words text-xs text-ui-muted" :data-test="`step-summary-${step.id}`">{{ step.summary }}</span>
          </span>
          <UiBadge :variant="BADGE_VARIANT[step.status]" class="shrink-0">{{ statusLabel(step) }}</UiBadge>
          <IconChevronDown
            :class="clsx('size-4 shrink-0 text-ui-muted transition-transform motion-reduce:transition-none', openId === step.id && 'rotate-180')"
            aria-hidden="true"
          />
        </button>
        <slot :name="`step-${step.id}-actions`" :step="step" />
      </div>

      <div v-if="openId === step.id && !step.locked" :id="`${step.id}-panel`" class="space-y-4 border-t border-ui-border p-4">
        <slot :name="`step-${step.id}`" :step="step" />
      </div>
    </li>
  </ol>
</template>
