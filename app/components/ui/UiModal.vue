<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  /** Width preset. Defaults to `md` (max-w-lg) for backwards compatibility. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), {
  size: 'md',
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const panelClass = computed(() =>
  clsx(
    'relative z-10 flex w-full max-h-[calc(100vh-2rem)] flex-col rounded-2xl bg-dark-card shadow-xl',
    {
      'max-w-md': props.size === 'sm',
      'max-w-lg': props.size === 'md',
      'max-w-2xl': props.size === 'lg',
      'max-w-4xl': props.size === 'xl',
    },
  ),
)

// Trap focus and handle Escape key
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

// Auto-focus dialog when opened so keydown events are received
function onAfterEnter(el: Element) {
  (el as HTMLElement).focus()
}

// Prevent SSR/client hydration mismatch: don't render Teleport content on server
const mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>

<template>
  <Teleport v-if="mounted" to="body">
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
        <div :class="panelClass">
          <!-- Header -->
          <div class="flex shrink-0 items-center justify-between border-b border-dark-border px-6 py-4">
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
          <div class="flex-1 overflow-y-auto px-6 py-4">
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="flex shrink-0 flex-col-reverse gap-2 border-t border-dark-border px-6 py-4 sm:flex-row sm:justify-end sm:gap-3"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
