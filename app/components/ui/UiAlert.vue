<script setup lang="ts">
import clsx from 'clsx'

type AlertSeverity = 'info' | 'success' | 'warning' | 'danger'

const props = withDefaults(defineProps<{
  severity?: AlertSeverity
  title?: string
  /** When true, renders a close button that emits `dismiss`. */
  dismissible?: boolean
}>(), {
  severity: 'info',
  dismissible: false,
})

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()

const severityClass: Record<AlertSeverity, string> = {
  info: 'border-cyan/30 bg-cyan/10 text-cyan',
  success: 'border-success-neon/30 bg-success-neon/10 text-success-neon',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-error/40 bg-error-bg text-error-vivid',
}

const wrapperClass = computed(() =>
  clsx(
    'flex items-start gap-3 rounded-md border px-4 py-3 text-sm',
    severityClass[props.severity],
  ),
)
</script>

<template>
  <div :class="wrapperClass" role="alert">
    <div class="flex-1 min-w-0">
      <p v-if="title" class="font-semibold mb-0.5">{{ title }}</p>
      <div class="text-sm">
        <slot />
      </div>
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="shrink-0 -m-1 rounded-md p-1 hover:bg-white/5 transition-colors"
      aria-label="Đóng thông báo"
      @click="emit('dismiss')"
    >
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    </button>
  </div>
</template>
