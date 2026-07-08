<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  ariaLabel?: string
  width?: string
}>(), {
  width: 'w-96',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const drawerRef = ref<HTMLElement | null>(null)
const previousFocus = ref<HTMLElement | null>(null)
const generatedId = useId()
const titleId = computed(() => props.title ? `${generatedId}-title` : undefined)
const accessibleLabel = computed(() => props.title ? undefined : (props.ariaLabel ?? 'Ngăn chi tiết'))

const panelClass = computed(() =>
  clsx(
    'fixed inset-y-0 right-0 z-10 flex h-full max-h-full w-full flex-col bg-dark-card shadow-xl',
    'sm:max-w-full',
    props.width,
  ),
)

function close() {
  emit('update:modelValue', false)
}

function focusableElements(): HTMLElement[] {
  if (!drawerRef.value) return []
  return Array.from(
    drawerRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const items = focusableElements()
  if (items.length === 0) {
    event.preventDefault()
    drawerRef.value?.focus()
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

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      previousFocus.value = document.activeElement as HTMLElement | null
      await nextTick()
      const first = focusableElements()[0]
      if (first) first.focus()
      else drawerRef.value?.focus()
    }
    else {
      previousFocus.value?.focus?.()
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-label="accessibleLabel"
        @keydown="onKeydown"
      >
        <div class="absolute inset-0 bg-black/50" aria-hidden="true" @click="close" />

        <Transition
          appear
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="translate-x-full"
          enter-to-class="translate-x-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="translate-x-0"
          leave-to-class="translate-x-full"
        >
          <aside
            v-if="modelValue"
            ref="drawerRef"
            :class="panelClass"
            tabindex="-1"
          >
            <header class="flex items-center justify-between border-b border-dark-border px-5 py-4">
              <div :id="titleId" class="min-w-0">
                <slot name="header">
                  <h2 class="text-base font-semibold text-white">{{ title }}</h2>
                </slot>
              </div>
              <UiButton variant="ghost" size="sm" icon-only aria-label="Đóng" @click="close">
                ×
              </UiButton>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <slot />
            </div>

            <footer v-if="$slots.footer" class="border-t border-dark-border px-5 py-4">
              <slot name="footer" />
            </footer>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
