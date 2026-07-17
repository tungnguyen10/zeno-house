<script setup lang="ts">
import clsx from 'clsx'
import type { PortalToastSeverity } from '~/composables/tenant-portal/usePortalToast'

const { toasts, dismiss } = usePortalToast()

const toneClass: Record<PortalToastSeverity, string> = {
  success: 'border-success/30 text-success',
  error: 'border-error/30 text-error',
  info: 'border-theme/30 text-theme',
}

function containerClass(severity: PortalToastSeverity) {
  return clsx(
    'pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 shadow-lg',
    toneClass[severity],
  )
}
</script>

<template>
  <Teleport to="body">
    <div
      class="portal-safe-bottom pointer-events-none fixed inset-x-0 bottom-16 z-[80] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
      aria-label="Thông báo"
    >
      <TransitionGroup
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 translate-y-2"
        leave-to-class="opacity-0 scale-95"
        move-class="transition-all duration-200"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="containerClass(toast.severity)"
          role="status"
          @click="dismiss(toast.id)"
        >
          <IconCheckCircle v-if="toast.severity === 'success'" class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <IconAlertCircle v-else-if="toast.severity === 'error'" class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <IconInfoCircle v-else class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p class="text-sm font-medium text-title">{{ toast.message }}</p>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
