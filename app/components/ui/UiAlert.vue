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
  info: 'border-ui-accent/30 bg-ui-accent/10 text-ui-accent',
  success: 'border-status-success/30 bg-status-success/10 text-status-success',
  warning: 'border-status-warning/30 bg-status-warning/10 text-status-warning',
  danger: 'border-status-danger/40 bg-status-danger-surface text-status-danger',
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
      class="shrink-0 -m-1 rounded-md p-1 hover:bg-ui-primary/5 transition-colors"
      aria-label="Đóng thông báo"
      @click="emit('dismiss')"
    >
      <IconX class="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
</template>
