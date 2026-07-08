<script setup lang="ts">
const { toasts, dismiss, pause, resume } = useToast()

interface ToneConfig {
  container: string
  bar: string
  icon: string
}

const toneMap: Record<string, ToneConfig> = {
  success: {
    container: 'border-success-neon/25 bg-dark-surface',
    bar: 'bg-success-neon',
    icon: 'text-success-neon',
  },
  danger: {
    container: 'border-error-vivid/25 bg-dark-surface',
    bar: 'bg-error-vivid',
    icon: 'text-error-vivid',
  },
  info: {
    container: 'border-cyan/25 bg-dark-surface',
    bar: 'bg-cyan',
    icon: 'text-cyan',
  },
}

function tone(severity: string): ToneConfig {
  return toneMap[severity] ?? toneMap.info!
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-x-3 bottom-4 z-[70] flex flex-col-reverse gap-2
             sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:w-80 sm:flex-col"
      aria-live="polite"
      aria-label="Thông báo"
    >
      <TransitionGroup
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 translate-y-2 sm:translate-y-0 sm:translate-x-3"
        leave-to-class="opacity-0 scale-95"
        move-class="transition-all duration-200"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'relative overflow-hidden rounded-lg border shadow-xl',
            tone(toast.severity).container,
          ]"
          role="status"
          @mouseenter="pause(toast.id)"
          @mouseleave="resume(toast.id)"
        >
          <!-- Progress bar -->
          <div
            :class="['toast-progress absolute inset-x-0 bottom-0 h-0.5', tone(toast.severity).bar]"
          />

          <!-- Content row -->
          <div class="flex items-start gap-3 px-4 py-3">
            <!-- Icon -->
            <span :class="['mt-px shrink-0', tone(toast.severity).icon]">
              <IconCheckCircle v-if="toast.severity === 'success'" class="size-4" aria-hidden="true" />
              <IconXCircle v-else-if="toast.severity === 'danger'" class="size-4" aria-hidden="true" />
              <IconInfoCircle v-else class="size-4" aria-hidden="true" />
            </span>

            <!-- Message -->
            <p class="flex-1 text-sm leading-5 text-white">{{ toast.message }}</p>

            <!-- Dismiss -->
            <button
              type="button"
              class="shrink-0 text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
              aria-label="Đóng thông báo"
              @click="dismiss(toast.id)"
            >
              <IconXCircle class="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-progress {
  animation: toast-drain var(--duration, 4s) linear forwards;
}

@keyframes toast-drain {
  from { transform: scaleX(1); transform-origin: left }
  to   { transform: scaleX(0); transform-origin: left }
}
</style>
