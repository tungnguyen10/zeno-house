<script setup lang="ts">
import clsx from 'clsx'

type Tone = 'default' | 'accent' | 'success' | 'warning' | 'danger'

const props = withDefaults(defineProps<{
  label: string
  /** Shorter label for the mobile chip. */
  shortLabel?: string
  value: string | number
  tone?: Tone
  /** Whether this tile is the active filter. */
  pressed?: boolean
  loading?: boolean
}>(), {
  tone: 'default',
})

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const toneClass: Record<Tone, { value: string, ring: string, dot: string }> = {
  warning: { value: 'text-status-warning', ring: 'md:ring-status-warning/50', dot: 'bg-status-warning' },
  accent: { value: 'text-ui-accent', ring: 'md:ring-ui-accent/50', dot: 'bg-ui-accent' },
  default: { value: 'text-ui-primary', ring: 'md:ring-ui-muted/40', dot: 'bg-ui-muted/60' },
  danger: { value: 'text-status-danger', ring: 'md:ring-status-danger/50', dot: 'bg-status-danger' },
  success: { value: 'text-status-success', ring: 'md:ring-status-success/50', dot: 'bg-status-success' },
}

const styles = computed(() => toneClass[props.tone])
const isEmpty = computed(() => props.value === 0)

function onClick(event: MouseEvent) {
  // Keep a partially hidden chip fully visible once selected.
  (event.currentTarget as HTMLElement | null)?.scrollIntoView?.({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  emit('click', event)
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="pressed ? 'true' : 'false'"
    :class="clsx(
      'flex min-w-0 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40',
      // Mobile: filter chip
      'max-md:h-9 max-md:shrink-0 max-md:snap-start max-md:items-center max-md:gap-2 max-md:whitespace-nowrap max-md:rounded-full max-md:border max-md:px-3.5 max-md:active:scale-[0.97]',
      // Desktop: grid cell
      'md:flex-col md:gap-1 md:bg-ui-surface md:px-3.5 md:py-2 md:text-left md:shadow-[0_0_0_0.5px_rgb(var(--ui-border))] md:focus-visible:ring-inset',
      pressed
        ? clsx('max-md:border-transparent max-md:bg-ui-primary md:bg-ui-hover/40 md:ring-2 md:ring-inset', styles.ring)
        : 'max-md:border-ui-border max-md:bg-ui-surface hover:bg-ui-hover/40',
    )"
    @click="onClick"
  >
    <span
      :class="clsx(
        'flex items-center gap-1.5 font-medium',
        'max-md:text-[13px]',
        'md:text-[10px] md:uppercase md:tracking-wide md:text-ui-muted',
        pressed ? 'max-md:text-ui-canvas' : 'max-md:text-ui-primary',
      )"
    >
      <span :class="clsx('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)" />
      <span data-label="short" class="md:hidden">{{ shortLabel ?? label }}</span>
      <span data-label="full" class="max-md:hidden">{{ label }}</span>
    </span>
    <UiSkeleton v-if="loading" class="h-4 w-6 md:h-5 md:w-10" />
    <span
      v-else
      :class="clsx(
        'font-semibold tabular-nums leading-none',
        'max-md:text-[13px] md:text-lg',
        isEmpty ? 'text-ui-muted' : styles.value,
        pressed && (isEmpty ? 'max-md:text-ui-canvas/70' : 'max-md:text-ui-canvas'),
      )"
    >{{ value }}</span>
  </button>
</template>
