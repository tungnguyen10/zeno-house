<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
  selected?: boolean
  interactive?: boolean
  disabled?: boolean
}>(), {
  tone: 'neutral',
  selected: false,
  interactive: false,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'select'): void
}>()

const toneClass = computed(() => ({
  neutral: 'border-border-light bg-smoke text-body',
  accent: 'border-theme/30 bg-theme/10 text-theme',
  success: 'border-portal-positive/30 bg-portal-positive/10 text-portal-positive',
  warning: 'border-portal-warning/30 bg-portal-warning/10 text-portal-warning',
  danger: 'border-portal-danger/30 bg-portal-danger/10 text-portal-danger',
}[props.tone]))

const chipClass = computed(() =>
  clsx(
    'inline-flex min-h-8 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold',
    toneClass.value,
    props.interactive && [
      'cursor-pointer transition-colors',
      '[transition-duration:var(--portal-motion-micro)] [transition-timing-function:var(--portal-ease-out)]',
      'hover:bg-smoke active:scale-[0.98]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40 focus-visible:ring-offset-2',
      'motion-reduce:transition-none motion-reduce:active:scale-100',
    ],
    props.selected && 'border-theme bg-smoke-blue text-theme',
    props.disabled && 'cursor-not-allowed opacity-50',
  ),
)

function select() {
  if (!props.disabled) emit('select')
}
</script>

<template>
  <component
    :is="interactive ? 'button' : 'span'"
    :type="interactive ? 'button' : undefined"
    :disabled="interactive ? disabled : undefined"
    :aria-pressed="interactive ? selected : undefined"
    :class="chipClass"
    @click="select"
  >
    <slot />
  </component>
</template>
