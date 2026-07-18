<script setup lang="ts">
import clsx from 'clsx'
import type { PortalToastSeverity } from '~/composables/tenant-portal/usePortalToast'

const { toasts, dismiss } = usePortalToast()

const toneClass: Record<PortalToastSeverity, string> = {
  success: 'border-portal-positive/30 text-portal-positive',
  error: 'border-portal-danger/30 text-portal-danger',
  info: 'border-theme/30 text-theme',
}

function containerClass(severity: PortalToastSeverity) {
  return clsx(
    'pointer-events-auto flex items-center gap-3 rounded-2xl border bg-white py-2 pl-4 pr-2 shadow-lg',
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
        enter-active-class="transition-[opacity,transform] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        leave-active-class="transition-[opacity,transform] duration-150 [transition-timing-function:cubic-bezier(0.32,0,0.67,0)] motion-reduce:transition-none"
        enter-from-class="opacity-0 translate-y-2"
        leave-to-class="opacity-0 scale-95"
        move-class="transition-transform duration-200 motion-reduce:transition-none"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="containerClass(toast.severity)"
          role="status"
        >
          <IconCheckCircle v-if="toast.severity === 'success'" class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <IconAlertCircle v-else-if="toast.severity === 'error'" class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <IconInfoCircle v-else class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p class="text-sm font-medium text-title">{{ toast.message }}</p>
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-body hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
            aria-label="Đóng thông báo"
            @click="dismiss(toast.id)"
          >
            <IconX class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
