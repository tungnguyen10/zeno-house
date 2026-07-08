<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  ariaLabel?: string
  /** Width preset. Defaults to `md` (max-w-lg) for backwards compatibility. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), {
  size: 'md',
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const dialogRef = ref<HTMLElement | null>(null)
const previousFocus = ref<HTMLElement | null>(null)
const generatedId = useId()
const titleId = computed(() => props.title ? `${generatedId}-title` : undefined)
const accessibleLabel = computed(() => props.title ? undefined : (props.ariaLabel ?? 'Hộp thoại'))

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

function focusableElements(): HTMLElement[] {
  if (!dialogRef.value) return []
  return Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true')
}

function focusDialog() {
  const first = focusableElements()[0]
  if (first) first.focus()
  else dialogRef.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return

  const items = focusableElements()
  if (items.length === 0) {
    event.preventDefault()
    dialogRef.value?.focus()
    return
  }

  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

async function onAfterEnter() {
  await nextTick()
  focusDialog()
}

// Prevent SSR/client hydration mismatch: don't render Teleport content on server
const mounted = ref(false)
onMounted(() => { mounted.value = true })

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus.value = document.activeElement as HTMLElement | null
      await nextTick()
      focusDialog()
    }
    else {
      previousFocus.value?.focus?.()
    }
  },
)
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
        ref="dialogRef"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-labelledby="titleId"
        :aria-label="accessibleLabel"
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
            <h2 :id="titleId" class="text-base font-semibold text-white">
              {{ title }}
            </h2>
            <button
              type="button"
              class="rounded-md p-1 text-muted hover:bg-dark-hover hover:text-white transition-colors"
              aria-label="Đóng"
              @click="emit('close')"
            >
              <IconX class="size-5" aria-hidden="true" />
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
