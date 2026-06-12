<script setup lang="ts">
const { toasts, dismiss, pause, resume } = useToast()

function toneClass(severity: string) {
  switch (severity) {
    case 'success':
      return 'border-success/40 bg-success/10 text-success-neon'
    case 'danger':
      return 'border-error/40 bg-error/10 text-error-vivid'
    default:
      return 'border-cyan/40 bg-cyan/10 text-cyan'
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-x-3 bottom-3 z-[70] flex flex-col gap-2 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:w-96">
      <TransitionGroup
        enter-active-class="transition duration-150"
        leave-active-class="transition duration-150"
        enter-from-class="translate-y-2 opacity-0 sm:translate-x-2 sm:translate-y-0"
        leave-to-class="translate-y-2 opacity-0 sm:translate-x-2 sm:translate-y-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['flex items-start justify-between gap-3 rounded-md border px-3 py-2 shadow-lg backdrop-blur', toneClass(toast.severity)]"
          role="status"
          @mouseenter="pause(toast.id)"
          @mouseleave="resume(toast.id)"
        >
          <p class="text-sm leading-5 text-white">{{ toast.message }}</p>
          <UiButton variant="ghost" size="sm" icon-only aria-label="Đóng thông báo" @click="dismiss(toast.id)">
            ×
          </UiButton>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
