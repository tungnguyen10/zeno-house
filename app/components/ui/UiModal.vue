<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Trap focus and handle Escape key
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

// Auto-focus dialog when opened so keydown events are received
function onAfterEnter(el: Element) {
  (el as HTMLElement).focus()
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      @after-enter="onAfterEnter"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-label="title"
        @keydown="onKeydown"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50"
          aria-hidden="true"
          @click="emit('close')"
        />

        <!-- Dialog panel -->
          <div class="relative z-10 w-full max-w-lg rounded-2xl bg-dark-card shadow-xl">
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-dark-border px-6 py-4">
            <h2 class="text-base font-semibold text-white">
              {{ title }}
            </h2>
            <button
              type="button"
              class="rounded-md p-1 text-muted hover:bg-dark-hover hover:text-white transition-colors"
              aria-label="Đóng"
              @click="emit('close')"
            >
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-4">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="flex justify-end gap-3 border-t border-dark-border px-6 py-4">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
